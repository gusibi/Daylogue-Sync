import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getNextSeqBatch } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { records: [], total: 0, tab: 'all', q: '', showDeleted: false };
  }

  const tab = url.searchParams.get('tab') || 'all';
  const q = url.searchParams.get('q') || '';
  const showDeleted = url.searchParams.get('deleted') === '1';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  let query = 'SELECT type, id, v, data, deleted, hlc, ts, device_id, seq, updated_at FROM records WHERE 1=1';
  const params: any[] = [];

  // Tab 筛选
  if (tab === 'my_message') {
    query += " AND type = 'message' AND json_extract(data, '$.role') = 0";
  } else if (tab === 'ai_message') {
    query += " AND type = 'message' AND json_extract(data, '$.role') = 1";
  } else if (tab === 'other') {
    query += " AND type NOT IN ('message', 'diary', 'todo', 'bill', 'session', 'tag', 'setting')";
  } else if (tab !== 'all') {
    query += ' AND type = ?';
    params.push(tab);
  }

  // 是否显示已删除
  if (!showDeleted) {
    query += ' AND deleted = 0';
  }

  // 关键词检索
  if (q.trim()) {
    query += ' AND (id LIKE ? OR data LIKE ?)';
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  // 排序与分页
  query += ' ORDER BY ts DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const stmt = db.prepare(query);
  const rows = await stmt.bind(...params).all<{
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

  return {
    records,
    tab,
    q,
    showDeleted,
    page
  };
};

export const actions: Actions = {
  deleteRecord: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return fail(500, { error: 'Database unavailable' });

    const form = await request.formData();
    const type = form.get('type')?.toString();
    const id = form.get('id')?.toString();

    if (!type || !id) {
      return fail(400, { error: 'Missing type or id' });
    }

    const { startSeq } = await getNextSeqBatch(db, 1);
    const now = Date.now();
    const hlc = `${now}-0001-admin_del`;

    await db
      .prepare(
        `UPDATE records SET deleted = 1, data = NULL, hlc = ?1, seq = ?2, updated_at = ?3
         WHERE space_id = 'default' AND type = ?4 AND id = ?5`
      )
      .bind(hlc, startSeq, now, type, id)
      .run();

    return { success: true };
  }
};
