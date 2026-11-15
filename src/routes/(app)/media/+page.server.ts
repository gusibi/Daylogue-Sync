import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { blobs: [] };
  }

  const rows = await db
    .prepare('SELECT hash, mime, size, created_at FROM blobs ORDER BY created_at DESC LIMIT 100')
    .all<{
      hash: string;
      mime: string;
      size: number;
      created_at: number;
    }>();

  return {
    blobs: rows.results || []
  };
};
