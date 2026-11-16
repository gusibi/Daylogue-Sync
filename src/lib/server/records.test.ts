import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { pushBatch, pullSince, wipeSpace, deleteRecord, type SyncEnvelope } from './records';
import { getCurrentSeq } from './db';
import { WIPE_PHRASE } from '$lib/confirm';

let runtime: Miniflare;
let db: D1Database;

beforeAll(async () => {
  runtime = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("local sync test"); } }',
    compatibilityDate: '2024-11-01',
    d1Databases: ['DB']
  });
  db = await runtime.getD1Database('DB');
  for (const file of ['0001_init.sql', '0002_add_users.sql']) {
    const sql = readFileSync(new URL(`../../../migrations/${file}`, import.meta.url), 'utf8');
    const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
    await db.batch(statements.map((statement) => db.prepare(statement)));
  }
}, 20_000);

afterAll(async () => { await runtime?.dispose(); });
beforeEach(async () => {
  await db.batch([
    db.prepare('DROP TRIGGER IF EXISTS reject_test_record'),
    ...['records', 'devices', 'sync_log', 'blobs'].map((table) => db.prepare(`DELETE FROM ${table}`)),
    db.prepare("UPDATE meta SET value='0' WHERE key='seq'")
  ]);
});

function message(id: string, counter = 1): SyncEnvelope {
  return {
    type: 'message', id, hlc: `1763184000100-${String(counter).padStart(4, '0')}-test`,
    data: { content: `${id}-${counter}` }, uid: 'test-user', ts: 1763184000100
  };
}
function push(database: D1Database, records: SyncEnvelope[]) {
  return pushBatch(database, { spaceId: 'test-space', deviceId: 'test-device', records });
}

/** Pause the real D1 transaction before it commits, without replacing its SQL. */
function pauseFirstBatch(database: D1Database) {
  let resume!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  let first = true;
  const paused = new Proxy(database, {
    get(target, property) {
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          if (first) { first = false; entered(); await gate; }
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  return { db: paused, ready, resume };
}

describe('D1 committed sync cursors', () => {
  it('a delayed writer remains visible after another device advances its cursor', async () => {
    const delayed = pauseFirstBatch(db);
    const writing = push(delayed.db, [message('delayed')]);
    try {
      await delayed.ready;
      await push(db, [message('fast')]);
      const before = await pullSince(db, 'test-space', 0);
      expect(before.records.map((r) => r.id)).toEqual(['fast']);
      delayed.resume();
      await writing;
      const after = await pullSince(db, 'test-space', before.next);
      expect(after.records.map((r) => r.id)).toEqual(['delayed']);
      expect(after.next).toBeGreaterThan(before.next);
    } finally { delayed.resume(); await writing; }
  });

  it('an older write delayed behind a newer write cannot overwrite it', async () => {
    const delayed = pauseFirstBatch(db);
    const writing = push(delayed.db, [message('same', 1)]);
    try {
      await delayed.ready;
      await push(db, [message('same', 2)]);
      delayed.resume();
      const result = await writing;
      expect(result.accepted).toEqual([]);
      expect(result.conflicts[0]?.hlc).toBe(message('same', 2).hlc);
      const pulled = await pullSince(db, 'test-space', 0);
      expect(pulled.records[0]?.data?.content).toBe('same-2');
      expect(await getCurrentSeq(db)).toBe(1);
    } finally { delayed.resume(); await writing; }
  });

  it('a failed batch rolls back both records and allocated sequence numbers', async () => {
    await db.prepare(`CREATE TRIGGER reject_test_record BEFORE INSERT ON records
      WHEN NEW.id = 'reject' BEGIN SELECT RAISE(ABORT, 'intentional test failure'); END`).run();
    await expect(push(db, [message('good'), message('reject')])).rejects.toThrow();
    expect(await getCurrentSeq(db)).toBe(0);
    expect((await pullSince(db, 'test-space', 0)).records).toEqual([]);
  });

  it('wipe tombstones cannot arrive behind an already observed cursor', async () => {
    await push(db, [message('remove-me')]);
    const delayed = pauseFirstBatch(db);
    const wiping = wipeSpace(delayed.db, undefined, 'test-space', WIPE_PHRASE);
    try {
      await delayed.ready;
      await push(db, [message('fast')]);
      const before = await pullSince(db, 'test-space', 1);
      delayed.resume();
      await wiping;
      const after = await pullSince(db, 'test-space', before.next);
      expect(after.records.find((r) => r.id === 'remove-me')?.deleted).toBe(true);
    } finally { delayed.resume(); await wiping; }
  });

  it('serving a page does not claim the device has already saved it', async () => {
    await push(db, [message('page')]);
    const page = await pullSince(db, 'test-space', 0, 500, 'test-device');
    const before = await db.prepare('SELECT last_pull_seq FROM devices WHERE id=?1')
      .bind('test-device').first<{ last_pull_seq: number }>();
    expect(before?.last_pull_seq).toBe(0);
    await pullSince(db, 'test-space', page.next, 500, 'test-device');
    const after = await db.prepare('SELECT last_pull_seq FROM devices WHERE id=?1')
      .bind('test-device').first<{ last_pull_seq: number }>();
    expect(after?.last_pull_seq).toBe(page.next);
  });
  it('a full 200-record batch and its retry keep stable, unique sequences', async () => {
    const records = Array.from({ length: 200 }, (_, i) => message(`bulk-${i}`));
    const result = await push(db, records);
    expect(result.accepted).toHaveLength(200);
    expect(result.cursor).toBe(200);
    const retry = await push(db, records);
    expect(retry.accepted).toEqual([]);
    expect(retry.conflicts).toHaveLength(200);
    expect(retry.cursor).toBe(200);
    let cursor = 0;
    const seen: string[] = [];
    do {
      const page = await pullSince(db, 'test-space', cursor, 50);
      seen.push(...page.records.map((r) => r.id));
      expect(page.next).toBeGreaterThan(cursor);
      cursor = page.next;
      if (!page.hasMore) break;
    } while (true);
    expect(new Set(seen).size).toBe(200);
    expect(cursor).toBe(200);
  });

  it('concurrent commits produce distinct sequences visible through pagination', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => push(db, [message(`parallel-${i}`)])));
    const page = await pullSince(db, 'test-space', 0);
    expect(page.records).toHaveLength(12);
    expect(page.records.map((r) => r.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(await getCurrentSeq(db)).toBe(12);
  });

  it('wipe advances a future HLC and leaves other spaces untouched', async () => {
    const future = { ...message('future'), hlc: '9000000000000-9999-clock-ahead' };
    await push(db, [future]);
    await pushBatch(db, { spaceId: 'other-space', deviceId: 'other-device', records: [message('other')] });
    const wiped = await wipeSpace(db, undefined, 'test-space', WIPE_PHRASE);
    expect(wiped).toMatchObject({ ok: true, cursor: 3 });
    const removed = (await pullSince(db, 'test-space', 1)).records[0];
    expect(removed.deleted).toBe(true);
    expect(removed.data).toBeNull();
    expect(removed.hlc > future.hlc).toBe(true);
    const other = (await pullSince(db, 'other-space', 0)).records[0];
    expect(other.deleted).toBe(false);
    expect(other.seq).toBe(2);
  });

  it('a failed wipe rolls back tombstones and the sequence counter together', async () => {
    await push(db, [message('good'), message('reject')]);
    await db.prepare(`CREATE TRIGGER reject_test_record BEFORE UPDATE ON records
      WHEN NEW.id = 'reject' AND NEW.deleted = 1
      BEGIN SELECT RAISE(ABORT, 'intentional wipe failure'); END`).run();
    await expect(wipeSpace(db, undefined, 'test-space', WIPE_PHRASE)).rejects.toThrow();
    expect(await getCurrentSeq(db)).toBe(2);
    const page = await pullSince(db, 'test-space', 0);
    expect(page.records).toHaveLength(2);
    expect(page.records.every((r) => !r.deleted)).toBe(true);
  });

  it('wipe requires the exact phrase and an empty wipe does not reset the counter', async () => {
    await push(db, [message('keep')]);
    expect((await wipeSpace(db, undefined, 'test-space', 'wrong')).ok).toBe(false);
    expect((await pullSince(db, 'test-space', 0)).records[0].deleted).toBe(false);
    expect((await wipeSpace(db, undefined, 'empty-space', WIPE_PHRASE)).cursor).toBe(1);
    expect(await getCurrentSeq(db)).toBe(1);
  });

  it('admin deletion commits after concurrent writes without deleting unrelated records', async () => {
    await push(db, [message('admin-target')]);
    const delayed = pauseFirstBatch(db);
    const deleting = deleteRecord(delayed.db, 'test-space', 'message', 'admin-target');
    try {
      await delayed.ready;
      await push(db, [message('unrelated')]);
      const before = await pullSince(db, 'test-space', 1);
      delayed.resume();
      await deleting;
      const after = await pullSince(db, 'test-space', before.next);
      expect(after.records.map((r) => [r.id, r.deleted])).toEqual([['admin-target', true]]);
      expect((await pullSince(db, 'test-space', 0)).records.find((r) => r.id === 'unrelated')?.deleted).toBe(false);
      const cursor = await getCurrentSeq(db);
      await deleteRecord(db, 'test-space', 'message', 'missing');
      expect(await getCurrentSeq(db)).toBe(cursor);
    } finally { delayed.resume(); await deleting; }
  });

});
