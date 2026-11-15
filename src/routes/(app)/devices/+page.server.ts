import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { devices: [], logs: [] };
  }

  const devRows = await db
    .prepare(
      `SELECT d.id, d.name, d.platform, d.first_seen, d.last_seen, d.last_push, d.last_pull_seq, t.name as token_name
       FROM devices d
       LEFT JOIN tokens t ON d.token_id = t.id
       ORDER BY d.last_seen DESC`
    )
    .all<{
      id: string;
      name: string | null;
      platform: string | null;
      first_seen: number;
      last_seen: number;
      last_push: number | null;
      last_pull_seq: number | null;
      token_name: string | null;
    }>();

  const logRows = await db
    .prepare('SELECT id, at, device_id, kind, count, conflicts, ms, error FROM sync_log ORDER BY id DESC LIMIT 100')
    .all<{
      id: number;
      at: number;
      device_id: string;
      kind: string;
      count: number;
      conflicts: number;
      ms: number;
      error: string | null;
    }>();

  return {
    devices: devRows.results || [],
    logs: logRows.results || []
  };
};
