import { isHlcNewer } from './hlc';
import { getNextSeqBatch, getCurrentSeq } from './db';
import { WIPE_PHRASE } from '$lib/confirm';

export interface SyncEnvelope {
  type: string;
  id: string;
  v?: number;
  hlc: string;
  ts?: number;
  deleted?: boolean;
  data: Record<string, unknown> | null;
  seq?: number;
}

export interface PushOptions {
  spaceId: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  tokenId?: string;
  records: SyncEnvelope[];
}

export interface PushResult {
  accepted: string[];
  conflicts: SyncEnvelope[];
  cursor: number;
}

/**
 * 批量处理推送过来的记录（LWW 规则）
 */
export async function pushBatch(db: D1Database, opts: PushOptions): Promise<PushResult> {
  const startTime = Date.now();
  const { spaceId, deviceId, deviceName, platform, tokenId, records } = opts;

  if (!records || records.length === 0) {
    const cur = await getCurrentSeq(db);
    return { accepted: [], conflicts: [], cursor: cur };
  }

  // 1. 查询库中已有记录的 hlc 及完整记录，用于冲突检测
  const acceptedRecords: SyncEnvelope[] = [];
  const conflictRecords: SyncEnvelope[] = [];

  for (const item of records) {
    const existing = await db
      .prepare('SELECT type, id, v, data, deleted, hlc, ts, seq FROM records WHERE space_id = ?1 AND type = ?2 AND id = ?3')
      .bind(spaceId, item.type, item.id)
      .first<{
        type: string;
        id: string;
        v: number;
        data: string | null;
        deleted: number;
        hlc: string;
        ts: number;
        seq: number;
      }>();

    if (!existing) {
      // 库中尚无此记录，直接接受
      acceptedRecords.push(item);
    } else {
      if (isHlcNewer(item.hlc, existing.hlc)) {
        // 新传入记录更晚，胜出
        acceptedRecords.push(item);
      } else {
        // 库中已有记录更加新，判定为冲突，返回服务端版本让客户端更新覆盖
        conflictRecords.push({
          type: existing.type,
          id: existing.id,
          v: existing.v,
          hlc: existing.hlc,
          ts: existing.ts,
          deleted: existing.deleted === 1,
          data: existing.data ? JSON.parse(existing.data) : null,
          seq: existing.seq
        });
      }
    }
  }

  let finalSeq = await getCurrentSeq(db);

  if (acceptedRecords.length > 0) {
    const { startSeq, endSeq } = await getNextSeqBatch(db, acceptedRecords.length);
    finalSeq = endSeq;

    const stmts: D1PreparedStatement[] = [];
    const now = Date.now();

    for (let i = 0; i < acceptedRecords.length; i++) {
      const rec = acceptedRecords[i];
      const assignedSeq = startSeq + i;
      const isDeleted = rec.deleted ? 1 : 0;
      const dataStr = isDeleted ? null : JSON.stringify(rec.data ?? {});
      const ts = rec.ts ?? now;
      const v = rec.v ?? 1;

      stmts.push(
        db
          .prepare(
            `INSERT INTO records (space_id, type, id, v, data, deleted, hlc, ts, device_id, seq, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(space_id, type, id) DO UPDATE SET
               v = ?4,
               data = ?5,
               deleted = ?6,
               hlc = ?7,
               ts = ?8,
               device_id = ?9,
               seq = ?10,
               updated_at = ?11`
          )
          .bind(
            spaceId,
            rec.type,
            rec.id,
            v,
            dataStr,
            isDeleted,
            rec.hlc,
            ts,
            deviceId,
            assignedSeq,
            now
          )
      );
    }

    // 批量执行
    await db.batch(stmts);
  }

  // 2. 更新设备活跃状态
  await db
    .prepare(
      `INSERT INTO devices (space_id, id, name, platform, token_id, first_seen, last_seen, last_push)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?6)
       ON CONFLICT(space_id, id) DO UPDATE SET
         name = COALESCE(?3, name),
         platform = COALESCE(?4, platform),
         token_id = COALESCE(?5, token_id),
         last_seen = ?6,
         last_push = ?6`
    )
    .bind(spaceId, deviceId, deviceName ?? null, platform ?? null, tokenId ?? null, Date.now())
    .run()
    .catch(() => {});

  // 3. 记录同步统计日志
  const elapsed = Date.now() - startTime;
  await db
    .prepare(
      'INSERT INTO sync_log (at, device_id, kind, count, conflicts, ms, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)'
    )
    .bind(Date.now(), deviceId, 'push', acceptedRecords.length, conflictRecords.length, elapsed)
    .run()
    .catch(() => {});

  // 清理多余的旧日志，保持在 1000 条以内
  db.prepare('DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY id DESC LIMIT 1000)')
    .run()
    .catch(() => {});

  return {
    accepted: acceptedRecords.map((r) => r.id),
    conflicts: conflictRecords,
    cursor: finalSeq
  };
}

/**
 * 增量拉取自上次游标以来的记录
 */
export async function pullSince(
  db: D1Database,
  spaceId: string,
  since: number,
  limit: number = 500,
  deviceId?: string
): Promise<{ records: SyncEnvelope[]; next: number; hasMore: boolean }> {
  const safeLimit = Math.min(Math.max(1, limit), 1000);
  const rows = await db
    .prepare(
      `SELECT type, id, v, data, deleted, hlc, ts, seq
       FROM records
       WHERE space_id = ?1 AND seq > ?2
       ORDER BY seq ASC
       LIMIT ?3`
    )
    .bind(spaceId, since, safeLimit + 1)
    .all<{
      type: string;
      id: string;
      v: number;
      data: string | null;
      deleted: number;
      hlc: string;
      ts: number;
      seq: number;
    }>();

  const results = rows.results || [];
  const hasMore = results.length > safeLimit;
  const sliced = hasMore ? results.slice(0, safeLimit) : results;

  const records: SyncEnvelope[] = sliced.map((r) => ({
    type: r.type,
    id: r.id,
    v: r.v,
    hlc: r.hlc,
    ts: r.ts,
    deleted: r.deleted === 1,
    data: r.data ? JSON.parse(r.data) : null,
    seq: r.seq
  }));

  const nextCursor = records.length > 0 ? (records[records.length - 1].seq ?? since) : since;

  if (deviceId) {
    db.prepare('UPDATE devices SET last_seen = ?1, last_pull_seq = ?2 WHERE space_id = ?3 AND id = ?4')
      .bind(Date.now(), nextCursor, spaceId, deviceId)
      .run()
      .catch(() => {});
  }

  return {
    records,
    next: nextCursor,
    hasMore
  };
}

/**
 * 清空远端数据（必须输入精确短语）
 */
export async function wipeSpace(
  db: D1Database,
  blobs: R2Bucket | undefined,
  spaceId: string,
  phrase: string
): Promise<{ ok: boolean; error?: string; cursor?: number }> {
  if (phrase !== WIPE_PHRASE) {
    return { ok: false, error: '确认短语不匹配，无法执行清空操作' };
  }

  // 1. 查询出所有目前未被删除的记录，全部置为墓碑并赋予新的 seq，让已同步的端能接收到删除事件
  const activeRecords = await db
    .prepare('SELECT type, id FROM records WHERE space_id = ?1 AND deleted = 0')
    .bind(spaceId)
    .all<{ type: string; id: string }>();

  const list = activeRecords.results || [];
  let cursor = await getCurrentSeq(db);

  if (list.length > 0) {
    const { startSeq, endSeq } = await getNextSeqBatch(db, list.length);
    cursor = endSeq;
    const now = Date.now();
    const stmts: D1PreparedStatement[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const seq = startSeq + i;
      const hlc = `${now}-${String(i).padStart(4, '0')}-wipe`;

      stmts.push(
        db
          .prepare(
            `UPDATE records SET deleted = 1, data = NULL, hlc = ?1, seq = ?2, updated_at = ?3
             WHERE space_id = ?4 AND type = ?5 AND id = ?6`
          )
          .bind(hlc, seq, now, spaceId, item.type, item.id)
      );
    }
    await db.batch(stmts);
  }

  // 2. 清理 R2 中的媒体并清空 blobs 表
  if (blobs) {
    try {
      const blobRows = await db.prepare('SELECT hash FROM blobs WHERE space_id = ?1').bind(spaceId).all<{ hash: string }>();
      const hashes = (blobRows.results || []).map((b) => b.hash);
      for (const h of hashes) {
        await blobs.delete(h).catch(() => {});
      }
    } catch {
      // 忽略单个文件清理异常
    }
  }
  await db.prepare('DELETE FROM blobs WHERE space_id = ?1').bind(spaceId).run().catch(() => {});

  return { ok: true, cursor };
}
