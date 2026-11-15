import { sha256 } from './auth';

/**
 * 针对二进制数据计算 sha256 字符串
 */
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 检查 Blob 是否存在
 */
export async function hasBlob(
  db: D1Database,
  blobs: R2Bucket | undefined,
  spaceId: string,
  hash: string
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM blobs WHERE space_id = ?1 AND hash = ?2')
    .bind(spaceId, hash)
    .first();
  if (row) return true;

  if (blobs) {
    const obj = await blobs.head(hash);
    return obj !== null;
  }
  return false;
}

/**
 * 上传 Blob 到 R2 并记入 D1
 */
export async function putBlob(
  db: D1Database,
  blobs: R2Bucket | undefined,
  spaceId: string,
  expectedHash: string,
  buffer: ArrayBuffer,
  mime: string
): Promise<{ ok: boolean; error?: string }> {
  // 1. 严格校验传入的 SHA-256 哈希
  const actualHash = await computeBufferSha256(buffer);
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    return { ok: false, error: `哈希校验失败: 预期 ${expectedHash}, 实际 ${actualHash}` };
  }

  // 2. 写入 R2
  if (blobs) {
    await blobs.put(actualHash, buffer, {
      httpMetadata: {
        contentType: mime || 'application/octet-stream'
      }
    });
  }

  // 3. 记入 blobs 元数据表
  await db
    .prepare(
      `INSERT INTO blobs (space_id, hash, mime, size, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(space_id, hash) DO NOTHING`
    )
    .bind(spaceId, actualHash, mime || 'application/octet-stream', buffer.byteLength, Date.now())
    .run();

  return { ok: true };
}

/**
 * 读取 R2 中的 Blob
 */
export async function getBlob(
  blobs: R2Bucket | undefined,
  hash: string
): Promise<{ body: ReadableStream | null; mime?: string; size?: number } | null> {
  if (!blobs) return null;
  const obj = await blobs.get(hash);
  if (!obj) return null;

  return {
    body: obj.body,
    mime: obj.httpMetadata?.contentType || 'application/octet-stream',
    size: obj.size
  };
}
