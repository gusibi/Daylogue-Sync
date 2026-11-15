import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return {
      stats: { total: 0, byType: {}, devices: 0, blobsCount: 0, blobsBytes: 0, lastSyncAt: null },
      recentLogs: []
    };
  }

  // 1. 各类型记录数统计（仅统计未删除）
  const typeCounts = await db
    .prepare('SELECT type, COUNT(*) as cnt FROM records WHERE deleted = 0 GROUP BY type')
    .all<{ type: string; cnt: number }>();

  const byType: Record<string, number> = {};
  let totalActive = 0;
  for (const r of typeCounts.results || []) {
    byType[r.type] = r.cnt;
    totalActive += r.cnt;
  }

  // 2. 统计设备数
  const devRow = await db.prepare('SELECT COUNT(*) as cnt FROM devices').first<{ cnt: number }>();
  const devices = devRow?.cnt || 0;

  // 3. 统计媒体文件
  const blobRow = await db
    .prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(size), 0) as totalBytes FROM blobs')
    .first<{ cnt: number; totalBytes: number }>();

  // 4. 最新同步时间
  const lastSyncRow = await db.prepare('SELECT MAX(updated_at) as lastAt FROM records').first<{ lastAt: number }>();

  // 5. 最近同步日志
  const recentLogs = await db
    .prepare('SELECT id, at, device_id, kind, count, conflicts, ms, error FROM sync_log ORDER BY id DESC LIMIT 5')
    .all<{
      id: number;
      at: number;
      device_id: string;
      kind: string;
      count: number;
      conflicts: number;
      ms: number;
      error: string | null;
    }>();

  return {
    stats: {
      total: totalActive,
      byType,
      devices,
      blobsCount: blobRow?.cnt || 0,
      blobsBytes: blobRow?.totalBytes || 0,
      lastSyncAt: lastSyncRow?.lastAt || null
    },
    recentLogs: recentLogs.results || []
  };
};
