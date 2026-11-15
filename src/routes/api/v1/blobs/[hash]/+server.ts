import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';
import { hasBlob, putBlob, getBlob } from '$lib/server/blobs';

export const HEAD: RequestHandler = async ({ params, platform, request }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return new Response(null, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok || !auth.spaceId) {
    return new Response(null, { status: 401 });
  }

  const hash = params.hash || '';
  const exists = await hasBlob(db, platform?.env?.BLOBS, auth.spaceId, hash);
  if (exists) {
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 404 });
};

export const PUT: RequestHandler = async ({ params, request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok || !auth.spaceId) {
    return json({ ok: false, error: 'Invalid or revoked token' }, { status: 401 });
  }

  const hash = params.hash || '';
  const mime = request.headers.get('Content-Type') || 'application/octet-stream';

  const buffer = await request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    return json({ ok: false, error: 'Empty file payload' }, { status: 422 });
  }

  const res = await putBlob(db, platform?.env?.BLOBS, auth.spaceId, hash, buffer, mime);
  if (!res.ok) {
    return json({ ok: false, error: res.error }, { status: 400 });
  }

  return json({ ok: true, hash });
};

export const GET: RequestHandler = async ({ params, platform, request, locals }) => {
  const hash = params.hash || '';

  // 支持两种鉴权：1. 同步端 Bearer Token；2. 后台已登录 Cookie 会话
  let authorized = locals.isAdmin;
  if (!authorized) {
    const db = platform?.env?.DB;
    if (db) {
      const authHeader = request.headers.get('Authorization') || '';
      const auth = await verifySyncToken(db, authHeader);
      authorized = auth.ok;
    }
  }

  if (!authorized) {
    return new Response('Unauthorized', { status: 401 });
  }

  const blob = await getBlob(platform?.env?.BLOBS, hash);
  if (!blob || !blob.body) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(blob.body, {
    headers: {
      'Content-Type': blob.mime || 'application/octet-stream',
      'Content-Length': blob.size ? String(blob.size) : '',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
