import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { sha256 } from '$lib/server/auth';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { tokens: [] };
  }

  const rows = await db
    .prepare(`
      SELECT 
        t.id, 
        t.name, 
        t.prefix, 
        t.created_at, 
        t.last_used, 
        t.revoked_at,
        t.user_id,
        COALESCE(u.name, t.name) as user_name,
        COALESCE(u.id, t.user_id, 'usr_' || substr(t.id, 5)) as uid,
        (SELECT COUNT(*) FROM devices d WHERE d.token_id = t.id) as device_count
      FROM tokens t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
    `)
    .all<{
      id: string;
      name: string;
      prefix: string;
      created_at: number;
      last_used: number | null;
      revoked_at: number | null;
      user_id: string | null;
      user_name: string;
      uid: string;
      device_count: number;
    }>();

  return {
    tokens: rows.results || []
  };
};

export const actions: Actions = {
  createToken: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return fail(500, { error: 'Database unavailable' });

    const form = await request.formData();
    const name = form.get('name')?.toString()?.trim();
    if (!name) {
      return fail(400, { error: '请提供用户名称' });
    }

    // 生成随机 32 字节 Token 与唯一 UID
    const rand = crypto.getRandomValues(new Uint8Array(24));
    const rawToken = 'sync_' + Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256(rawToken);
    const prefix = rawToken.slice(0, 10);
    const tokenId = 'tok_' + crypto.randomUUID().slice(0, 8);
    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const now = Date.now();

    await db.batch([
      db
        .prepare(
          'INSERT INTO users (id, space_id, name, token_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)'
        )
        .bind(userId, 'default', name, tokenId, now),
      db
        .prepare(
          'INSERT INTO tokens (id, space_id, name, hash, prefix, user_id, created_at, last_used, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)'
        )
        .bind(tokenId, 'default', name, tokenHash, prefix, userId, now)
    ]);

    return {
      created: true,
      rawToken,
      name,
      userId
    };
  },

  revokeToken: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return fail(500, { error: 'Database unavailable' });

    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return fail(400, { error: 'Missing token ID' });

    await db.prepare('UPDATE tokens SET revoked_at = ?1 WHERE id = ?2').bind(Date.now(), id).run();

    return { revoked: true };
  }
};
