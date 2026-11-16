import { getCurrentSeq } from './db';
import { WIPE_PHRASE } from '$lib/confirm';

export interface SyncEnvelope {
  type: string;
  id: string;
  v?: number;
  uid?: string;
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
  userId?: string;
  records: SyncEnvelope[];
}

export interface PushResult {
  accepted: string[];
  conflicts: SyncEnvelope[];
  cursor: number;
}

interface StoredRecord {
  type: string;
  id: string;
  v: number;
  uid: string;
  hlc: string;
  ts: number;
  deleted: number;
  data: string | null;
  seq: number;
}

function envelope(row: Partial<StoredRecord> | undefined): SyncEnvelope {
  if (!row || typeof row.type !== 'string' || typeof row.id !== 'string'
    || typeof row.hlc !== 'string' || typeof row.seq !== 'number') {
    throw new Error('Missing stored conflict record');
  }
  return {
    type: row.type, id: row.id, v: row.v ?? 1, uid: row.uid || 'usr_default',
    hlc: row.hlc, ts: row.ts, deleted: row.deleted === 1,
    data: row.data ? JSON.parse(row.data) : null, seq: row.seq
  };
}

/** Version comparison, sequence allocation and writes share one D1 transaction. */
export async function pushBatch(db: D1Database, opts: PushOptions): Promise<PushResult> {
  const startTime = Date.now();
  const { spaceId, deviceId, deviceName, platform, tokenId, records } = opts;
  if (!records || records.length === 0) {
    return { accepted: [], conflicts: [], cursor: await getCurrentSeq(db) };
  }

  const statements: D1PreparedStatement[] = [];
  const now = Date.now();
  for (const rec of records) {
    // Decide against the version present at commit time, not a previous SELECT.
    statements.push(db.prepare(
      `UPDATE meta SET value = CAST(value AS INTEGER) + 1
       WHERE key = 'seq' AND NOT EXISTS (
         SELECT 1 FROM records
         WHERE space_id = ?1 AND type = ?2 AND id = ?3 AND hlc >= ?4
       )`
    ).bind(spaceId, rec.type, rec.id, rec.hlc));
    statements.push(db.prepare(
      `INSERT INTO records (space_id, type, id, v, data, deleted, hlc, ts, device_id, uid, seq, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
         (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'seq'), ?11)
       ON CONFLICT(space_id, type, id) DO UPDATE SET
         v = excluded.v, data = excluded.data, deleted = excluded.deleted,
         hlc = excluded.hlc, ts = excluded.ts, device_id = excluded.device_id,
         uid = excluded.uid, seq = excluded.seq, updated_at = excluded.updated_at
       WHERE excluded.hlc > records.hlc
       RETURNING id`
    ).bind(spaceId, rec.type, rec.id, rec.v ?? 1,
      rec.deleted ? null : JSON.stringify(rec.data ?? {}), rec.deleted ? 1 : 0,
      rec.hlc, rec.ts ?? now, deviceId, rec.uid || opts.userId || 'usr_default', now));
    // Return conflicts from the same transaction, including the actual winner.
    statements.push(db.prepare(
      'SELECT type, id, v, uid, hlc, ts, deleted, data, seq FROM records WHERE space_id = ?1 AND type = ?2 AND id = ?3'
    ).bind(spaceId, rec.type, rec.id));
  }
  statements.push(db.prepare("SELECT CAST(value AS INTEGER) AS seq FROM meta WHERE key = 'seq'"));
  const results = await db.batch<Partial<StoredRecord>>(statements);
  const accepted: string[] = [];
  const conflicts: SyncEnvelope[] = [];
  records.forEach((rec, i) => {
    if (results[i * 3 + 1].results.length > 0) {
      accepted.push(rec.id);
    } else {
      const winner = results[i * 3 + 2].results[0];
      conflicts.push(envelope(winner));
    }
  });
  const finalSeq = Number(results[results.length - 1].results[0]?.seq);
  if (!Number.isSafeInteger(finalSeq)) throw new Error('Invalid committed sync sequence');

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
    .bind(Date.now(), deviceId, 'push', accepted.length, conflicts.length, elapsed)
    .run()
    .catch(() => {});

  // 清理多余的旧日志，保持在 1000 条以内
  db.prepare('DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY id DESC LIMIT 1000)')
    .run()
    .catch(() => {});

  return {
    accepted,
    conflicts,
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
      `SELECT type, id, v, data, deleted, hlc, ts, seq, uid
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
      uid: string;
    }>();

  const results = rows.results || [];
  const hasMore = results.length > safeLimit;
  const sliced = hasMore ? results.slice(0, safeLimit) : results;

  const records: SyncEnvelope[] = sliced.map((r) => {
    let parsedData: Record<string, unknown> | null = null;
    if (r.data) {
      try {
        parsedData = JSON.parse(r.data);
      } catch {
        parsedData = null;
      }
    }
    return {
      type: r.type,
      id: r.id,
      v: r.v ?? 1,
      uid: r.uid || 'usr_default',
      hlc: r.hlc,
      ts: r.ts ?? Date.now(),
      deleted: r.deleted === 1,
      data: parsedData,
      seq: r.seq
    };
  });

  const nextCursor = records.length > 0 ? (records[records.length - 1].seq ?? since) : since;

  if (deviceId) {
    // Only `since` acknowledges a cursor already saved by this device.
    // The response's `next` is not acknowledged until a subsequent request.
    await db.prepare('UPDATE devices SET last_seen = ?1, last_pull_seq = ?2 WHERE space_id = ?3 AND id = ?4')
      .bind(Date.now(), since, spaceId, deviceId)
      .run()
      .catch(() => {});
  }

  return {
    records,
    next: nextCursor,
    hasMore
  };
}

async function tombstoneRecords(
  db: D1Database, spaceId: string, target?: { type: string; id: string }
): Promise<number> {
  const now = Date.now();
  const wipeHlc = `${String(now).padStart(13, '0')}-0000-server_delete`;
  const type = target?.type ?? null;
  const id = target?.id ?? null;
  const results = await db.batch<{ seq: number }>([
    // Count and allocate inside the same transaction as the tombstone writes.
    db.prepare(`UPDATE meta SET value = CAST(value AS INTEGER) +
      (SELECT COUNT(*) FROM records WHERE space_id = ?1 AND deleted = 0 AND (?2 IS NULL OR (type = ?2 AND id = ?3)))
      WHERE key = 'seq'`).bind(spaceId, type, id),
    db.prepare(`WITH active AS MATERIALIZED (
        SELECT type, id, ROW_NUMBER() OVER (ORDER BY type, id) AS ordinal
        FROM records WHERE space_id = ?1 AND deleted = 0 AND (?4 IS NULL OR (type = ?4 AND id = ?5))
      )
      UPDATE records SET deleted = 1, data = NULL,
        hlc = CASE WHEN hlc < ?2 THEN ?2 ELSE
          printf('%013d-%04d-server_delete',
            CAST(substr(hlc, 1, 13) AS INTEGER) + CASE WHEN CAST(substr(hlc, 15, 4) AS INTEGER) >= 9999 THEN 1 ELSE 0 END,
            CASE WHEN CAST(substr(hlc, 15, 4) AS INTEGER) >= 9999 THEN 0 ELSE CAST(substr(hlc, 15, 4) AS INTEGER) + 1 END)
          END,
        seq = (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'seq')
          - (SELECT COUNT(*) FROM active)
          + (SELECT ordinal FROM active WHERE active.type = records.type AND active.id = records.id),
        updated_at = ?3
      WHERE space_id = ?1 AND deleted = 0 AND (?4 IS NULL OR (type = ?4 AND id = ?5))`).bind(spaceId, wipeHlc, now, type, id),
    db.prepare("SELECT CAST(value AS INTEGER) AS seq FROM meta WHERE key = 'seq'")
  ]);
  const cursor = Number(results[2].results[0]?.seq);
  if (!Number.isSafeInteger(cursor)) throw new Error('Invalid committed deletion sequence');

  return cursor;
}

/** Admin single-record deletions use the same committed cursor rules as wipe. */
export async function deleteRecord(db: D1Database, spaceId: string, type: string, id: string): Promise<void> {
  await tombstoneRecords(db, spaceId, { type, id });
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

  const cursor = await tombstoneRecords(db, spaceId);

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
