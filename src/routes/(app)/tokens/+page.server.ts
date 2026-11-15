import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { sha256 } from '$lib/server/auth';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { tokens: [] };
  }

  const rows = await db
    .prepare('SELECT id, name, prefix, created_at, last_used, revoked_at FROM tokens ORDER BY created_at DESC')
    .all<{
      id: string;
      name: string;
      prefix: string;
      created_at: number;
      last_used: number | null;
      revoked_at: number | null;
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
      return fail(400, { error: '请提供令牌名称' });
    }

    // 生成随机 32 字节 Token
    const rand = crypto.getRandomValues(new Uint8Array(24));
    const rawToken = 'sync_' + Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256(rawToken);
    const prefix = rawToken.slice(0, 10);
    const id = 'tok_' + crypto.randomUUID().slice(0, 8);

    await db
      .prepare(
        'INSERT INTO tokens (id, space_id, name, hash, prefix, created_at, last_used, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL)'
      )
      .bind(id, 'default', name, tokenHash, prefix, Date.now())
      .run();

    return {
      created: true,
      rawToken,
      name
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
