import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';
import { pullSince } from '$lib/server/records';

export const GET: RequestHandler = async ({ url, request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok || !auth.spaceId) {
    return json({ ok: false, error: 'Invalid or revoked token' }, { status: 401 });
  }

  const sinceParam = url.searchParams.get('since') || '0';
  const since = parseInt(sinceParam, 10);
  if (isNaN(since) || since < 0) {
    return json({ ok: false, error: 'Invalid since parameter' }, { status: 422 });
  }

  const limitParam = url.searchParams.get('limit') || '500';
  const limit = parseInt(limitParam, 10);
  const deviceId = request.headers.get('X-Device-Id') || undefined;

  try {
    const result = await pullSince(db, auth.spaceId, since, limit, deviceId);
    return json({
      ok: true,
      records: result.records,
      next: result.next,
      hasMore: result.hasMore
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'Pull failed' }, { status: 500 });
  }
};
