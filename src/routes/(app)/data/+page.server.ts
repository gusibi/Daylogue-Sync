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

  let query = `
    SELECT r.type, r.id, r.v, r.data, r.deleted, r.hlc, r.ts, r.device_id, r.seq, r.updated_at, r.uid,
           COALESCE(u.name, r.uid) as user_name
    FROM records r
    LEFT JOIN users u ON u.id = r.uid
    WHERE 1=1
  `;
  const params: any[] = [];

  // Tab 筛选
  if (tab === 'my_message') {
    query += " AND r.type = 'message' AND json_extract(r.data, '$.role') = 0";
  } else if (tab === 'ai_message') {
    query += " AND r.type = 'message' AND json_extract(r.data, '$.role') = 1";
  } else if (tab === 'other') {
    query += " AND r.type NOT IN ('message', 'diary', 'todo', 'bill', 'session', 'tag', 'setting')";
  } else if (tab !== 'all') {
    query += ' AND r.type = ?';
    params.push(tab);
  }

  // 是否显示已删除
  if (!showDeleted) {
    query += ' AND r.deleted = 0';
  }

  // 关键词检索
  if (q.trim()) {
    query += ' AND (r.id LIKE ? OR r.data LIKE ?)';
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  // 排序与分页
  query += ' ORDER BY r.ts DESC LIMIT ? OFFSET ?';
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
    uid: string;
    user_name: string;
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
    uid: r.uid || 'usr_default',
    userName: r.user_name || r.uid || '默认用户',
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
