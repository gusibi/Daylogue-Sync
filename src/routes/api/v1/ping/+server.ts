import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok) {
    return json({ ok: false, error: 'Invalid or revoked token' }, { status: 401 });
  }

  return json({
    ok: true,
    protocol: 1,
    server: '0.1.0',
    time: Date.now(),
    user: {
      id: auth.userId,
      name: auth.userName
    }
  });
};
