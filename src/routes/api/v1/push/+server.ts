import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';
import { pushBatch } from '$lib/server/records';

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

  const { deviceId, deviceName, platform: clientPlatform, records } = body || {};
  if (!deviceId || typeof deviceId !== 'string') {
    return json({ ok: false, error: 'Missing or invalid deviceId' }, { status: 422 });
  }

  if (!Array.isArray(records)) {
    return json({ ok: false, error: 'records must be an array' }, { status: 422 });
  }

  if (records.length > 200) {
    return json({ ok: false, error: 'Record batch exceeds 200 items limit' }, { status: 413 });
  }

  try {
    const result = await pushBatch(db, {
      spaceId: auth.spaceId,
      deviceId,
      deviceName,
      platform: clientPlatform,
      tokenId: auth.tokenId,
      userId: auth.userId,
      records
    });

    return json({
      ok: true,
      accepted: result.accepted,
      conflicts: result.conflicts,
      cursor: result.cursor
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'Push failed' }, { status: 500 });
  }
};
