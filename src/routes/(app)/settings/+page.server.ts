import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { wipeSpace } from '$lib/server/records';
import { WIPE_PHRASE } from '$lib/confirm';

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  let currentSeq = 0;
  if (db) {
    const row = await db.prepare("SELECT value FROM meta WHERE key = 'seq'").first<{ value: string }>();
    currentSeq = parseInt(row?.value || '0', 10);
  }

  return {
    protocol: 1,
    serverVersion: '0.1.0',
    currentSeq,
    wipePhrase: WIPE_PHRASE
  };
};

export const actions: Actions = {
  wipeRemote: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return fail(500, { error: 'Database unavailable' });

    const form = await request.formData();
    const phrase = form.get('phrase')?.toString()?.trim();

    if (phrase !== WIPE_PHRASE) {
      return fail(400, { error: '确认短语不正确，必须完整输入“我知道要删除远端数据”' });
    }

    const res = await wipeSpace(db, platform?.env?.BLOBS, 'default', phrase);
    if (!res.ok) {
      return fail(400, { error: res.error || '清空失败' });
    }

    return { wiped: true, cursor: res.cursor };
  }
};
