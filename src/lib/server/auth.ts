/**
 * 鉴权与安全工具库
 */

export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 恒定时间比较两个字符串，防止时序侧信道攻击
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyAdminKey(inputKey: string, targetKey: string): Promise<boolean> {
  if (!inputKey || !targetKey) return false;
  return timingSafeEqual(inputKey.trim(), targetKey.trim());
}

/**
 * 基于 HMAC-SHA256 生成与校验管理员 Session Cookie
 */
export async function createSessionCookie(secret: string): Promise<string> {
  const payload = `admin:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret || 'default-secret-key-32-chars-at-least'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${btoa(payload)}.${sigHex}`;
}

export async function verifySessionCookie(cookie: string | undefined, secret: string): Promise<boolean> {
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 2) return false;
  try {
    const payload = atob(parts[0]);
    const sigHex = parts[1];
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret || 'default-secret-key-32-chars-at-least'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
    if (!valid) return false;

    // Cookie 7 天过期校验
    const timestamp = parseInt(payload.split(':')[1] || '0', 10);
    const now = Date.now();
    if (now - timestamp > 7 * 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验 Sync Token (Bearer)，并返回 token 及用户元数据
 */
export async function verifySyncToken(
  db: D1Database,
  rawToken: string
): Promise<{
  ok: boolean;
  tokenId?: string;
  spaceId?: string;
  name?: string;
  userId?: string;
  userName?: string;
}> {
  if (!rawToken || !rawToken.trim()) {
    return { ok: false };
  }
  const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();
  const tokenHash = await sha256(cleanToken);

  const row = await db
    .prepare(
      `SELECT t.id, t.space_id, t.name, t.revoked_at, t.user_id, u.name as user_name
       FROM tokens t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.hash = ?1`
    )
    .bind(tokenHash)
    .first<{
      id: string;
      space_id: string;
      name: string;
      revoked_at: number | null;
      user_id: string | null;
      user_name: string | null;
    }>();

  if (!row || row.revoked_at !== null) {
    return { ok: false };
  }

  // 异步更新上次使用时间
  db.prepare('UPDATE tokens SET last_used = ?1 WHERE id = ?2')
    .bind(Date.now(), row.id)
    .run()
    .catch(() => {});

  const userId = row.user_id || `usr_${row.id.replace(/^tok_/, '')}`;
  const userName = row.user_name || row.name;

  return {
    ok: true,
    tokenId: row.id,
    spaceId: row.space_id,
    name: row.name,
    userId,
    userName
  };
}

/**
 * IP 登录限速：10 分钟内失败不得超过 5 次
 */
export async function checkRateLimit(db: D1Database, ip: string): Promise<boolean> {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const row = await db
    .prepare('SELECT fails, window_start FROM login_attempts WHERE ip = ?1')
    .bind(ip)
    .first<{ fails: number; window_start: number }>();

  if (!row) return true;
  if (now - row.window_start > windowMs) {
    return true;
  }
  return row.fails < 5;
}

export async function recordLoginFail(db: D1Database, ip: string): Promise<void> {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const row = await db
    .prepare('SELECT fails, window_start FROM login_attempts WHERE ip = ?1')
    .bind(ip)
    .first<{ fails: number; window_start: number }>();

  if (!row || now - row.window_start > windowMs) {
    await db
      .prepare(
        'INSERT INTO login_attempts (ip, fails, window_start) VALUES (?1, 1, ?2) ON CONFLICT(ip) DO UPDATE SET fails = 1, window_start = ?2'
      )
      .bind(ip, now)
      .run();
  } else {
    await db
      .prepare('UPDATE login_attempts SET fails = fails + 1 WHERE ip = ?1')
      .bind(ip)
      .run();
  }
}

export async function resetLoginFail(db: D1Database, ip: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?1').bind(ip).run().catch(() => {});
}
