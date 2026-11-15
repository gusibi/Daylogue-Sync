import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(__dirname, '../protocol/fixtures/upsert_records.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

console.log('🌱 开始向本地 D1 数据库注入 Daylogue 演示种子数据...');

// 1. 创建默认测试 Token
const defaultToken = 'sync_local_dev_token_1234567890';
const tokenHash = createHash('sha256').update(defaultToken).digest('hex');
const tokenPrefix = defaultToken.slice(0, 10);
const now = Date.now();

const tokenSql = `INSERT INTO tokens (id, space_id, name, hash, prefix, created_at, last_used, revoked_at)
VALUES ('tok_local_demo', 'default', '本地开发测试设备', '${tokenHash}', '${tokenPrefix}', ${now}, ${now}, NULL)
ON CONFLICT(hash) DO NOTHING;`;

// 2. 注入设备
const deviceSql = `INSERT INTO devices (space_id, id, name, platform, token_id, first_seen, last_seen, last_push, last_pull_seq)
VALUES ('default', 'dev_macos_demo', '我的 MacBook Pro', 'macos', 'tok_local_demo', ${now}, ${now}, ${now}, 10)
ON CONFLICT(space_id, id) DO NOTHING;`;

// 3. 注入业务记录
let seq = 1;
const recordSqls = fixtures.map((item) => {
  const isDeleted = item.deleted ? 1 : 0;
  const dataStr = isDeleted ? 'NULL' : `'${JSON.stringify(item.data).replace(/'/g, "''")}'`;
  const currentSeq = seq++;
  return `INSERT INTO records (space_id, type, id, v, data, deleted, hlc, ts, device_id, seq, updated_at)
VALUES ('default', '${item.type}', '${item.id}', ${item.v || 1}, ${dataStr}, ${isDeleted}, '${item.hlc}', ${item.ts}, 'dev_macos_demo', ${currentSeq}, ${now})
ON CONFLICT(space_id, type, id) DO UPDATE SET data=${dataStr}, hlc='${item.hlc}', seq=${currentSeq}, updated_at=${now};`;
});

// 4. 更新 meta.seq
const metaSql = `UPDATE meta SET value = '${seq}' WHERE key = 'seq';`;

const allSql = [tokenSql, deviceSql, ...recordSqls, metaSql].join('\n\n');

const tempSqlPath = resolve(__dirname, 'temp_seed.sql');
writeFileSync(tempSqlPath, allSql, 'utf-8');

try {
  execSync(`npx wrangler d1 execute daylogue-sync --local --file="${tempSqlPath}"`, {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('✅ 种子数据注入成功！');
  console.log(`🔑 预设本地测试 Token: ${defaultToken}`);
} catch (err) {
  console.error('❌ 注入失败:', err);
} finally {
  try {
    unlinkSync(tempSqlPath);
  } catch {}
}
