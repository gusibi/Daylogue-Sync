import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';
import { wipeSpace } from '$lib/server/records';
import { WIPE_PHRASE } from '$lib/confirm';

export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok || !auth.spaceId) {
    return json({ ok: false, error: 'Invalid or revoked token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON payload' }, { status: 422 });
  }

  const { confirm } = body || {};
  if (confirm !== WIPE_PHRASE) {
    return json({ ok: false, error: '确认短语不正确，必须完整输入“我知道要删除远端数据”' }, { status: 400 });
  }

  try {
    const res = await wipeSpace(db, platform?.env?.BLOBS, auth.spaceId, confirm);
    if (!res.ok) {
      return json({ ok: false, error: res.error }, { status: 400 });
    }
    return json({
      ok: true,
      wiped: true,
      cursor: res.cursor
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'Wipe failed' }, { status: 500 });
  }
};
