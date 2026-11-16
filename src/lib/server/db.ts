/**
 * D1 数据库公共辅助
 */

// Never reserve sequence numbers in a separate request. Writers update this
// counter in the same D1 batch as their records (see records.ts).
export async function getCurrentSeq(db: D1Database): Promise<number> {
  const res = await db
    .prepare("SELECT value FROM meta WHERE key = 'seq'")
    .first<{ value: string }>();
  return parseInt(res?.value || '0', 10);
}
