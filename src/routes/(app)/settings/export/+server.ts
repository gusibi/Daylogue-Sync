import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform, locals }) => {
  if (!locals.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = platform?.env?.DB;
  if (!db) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const rows = await db
    .prepare('SELECT type, id, v, data, deleted, hlc, ts, device_id, seq, updated_at FROM records')
    .all<{
      type: string;
      id: string;
      v: number;
      data: string | null;
      deleted: number;
      hlc: string;
      ts: number;
      device_id: string;
      seq: number;
      updated_at: number;
    }>();

  const records = (rows.results || []).map((r) => ({
    type: r.type,
    id: r.id,
    v: r.v,
    deleted: r.deleted === 1,
    hlc: r.hlc,
    ts: r.ts,
    deviceId: r.device_id,
    seq: r.seq,
    updatedAt: r.updated_at,
    data: r.data ? JSON.parse(r.data) : null
  }));

  const exportPayload = {
    exportAt: new Date().toISOString(),
    version: '1.0',
    recordCount: records.length,
    records
  };

  const filename = `daylogue-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
};
