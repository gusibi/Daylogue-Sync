import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySyncToken } from '$lib/server/auth';
import { pullSince } from '$lib/server/records';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Device-Id'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

async function handlePull(url: URL, request: Request, platform: any) {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503, headers: corsHeaders });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const auth = await verifySyncToken(db, authHeader);
  if (!auth.ok || !auth.spaceId) {
    return json({ ok: false, error: 'Invalid or revoked token' }, { status: 401, headers: corsHeaders });
  }

  let sinceParam = url.searchParams.get('since');
  let limitParam = url.searchParams.get('limit');

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        if (body.since !== undefined) sinceParam = String(body.since);
        if (body.limit !== undefined) limitParam = String(body.limit);
      }
    } catch {
      // fallback to url query
    }
  }

  const since = parseInt(sinceParam || '0', 10);
  if (isNaN(since) || since < 0) {
    return json({ ok: false, error: 'Invalid since parameter' }, { status: 422, headers: corsHeaders });
  }

  const limit = parseInt(limitParam || '500', 10);
  const deviceId = request.headers.get('X-Device-Id') || undefined;

  try {
    const result = await pullSince(db, auth.spaceId, since, limit, deviceId);
    return json(
      {
        ok: true,
        records: result.records,
        next: result.next,
        hasMore: result.hasMore
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'Pull failed' }, { status: 500, headers: corsHeaders });
  }
}

export const GET: RequestHandler = async ({ url, request, platform }) => {
  return handlePull(url, request, platform);
};

export const POST: RequestHandler = async ({ url, request, platform }) => {
  return handlePull(url, request, platform);
};
