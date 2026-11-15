/**
 * D1 数据库公共辅助
 */

export async function getNextSeqBatch(db: D1Database, count: number): Promise<{ startSeq: number; endSeq: number }> {
  // 通过单次原子递增分配连续的 seq 段
  const res = await db
    .prepare("UPDATE meta SET value = CAST(value AS INTEGER) + ?1 WHERE key = 'seq' RETURNING value")
    .bind(count)
    .first<{ value: string }>();

  const endSeq = parseInt(res?.value || '0', 10);
  const startSeq = endSeq - count + 1;
  return { startSeq, endSeq };
}

export async function getCurrentSeq(db: D1Database): Promise<number> {
  const res = await db
    .prepare("SELECT value FROM meta WHERE key = 'seq'")
    .first<{ value: string }>();
  return parseInt(res?.value || '0', 10);
}
