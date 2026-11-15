# Daylogue · 数据同步服务 (Cloudflare 全家桶)

本模块是 **Daylogue** 的可自部署增量数据同步服务端与管理后台，完全基于 Cloudflare 全家桶构建：
- **Runtime**：Cloudflare Workers (SvelteKit 2 + `@sveltejs/adapter-cloudflare`)
- **数据库 (DB)**：Cloudflare D1 (SQLite 原生分布式数据库，支持纯本地离线运行)
- **大文件与媒体**：Cloudflare R2 (对象存储，按 SHA-256 去重托管图片与语音文件)
- **UI 设计**：NSH Neutral 极简高质感设计系统

---

## 💻 本地纯离线预览（无需 Cloudflare 远程数据库）

你**不需要**先在 Cloudflare 上开通任何资源，利用 Cloudflare 本地仿真环境（基于本地 SQLite）即可直接在电脑上完整预览并测试后台所有功能与 API：

```bash
cd sync

# 1. 应用本地数据库迁移（仅需首次执行一次，自动生成本地 SQLite 表结构）
npm run db:migrate:local

# 2. 注入演示种子数据（可选：预设示例记录与测试 Token）
npm run db:seed:local

# 3. 启动本地预览服务
npm run local
```

启动后在浏览器打开：**`http://localhost:8787`**
- **默认管理密钥**：`admin123`（在 `wrangler.toml` 中配置）
- **预设测试 Token**：`sync_local_dev_token_1234567890`

在本地后台中，你可以：
- 查看各类型记录统计与结构化字段明细；
- 预览图片与播放录音；
- 创建新的 Sync Token 并进行吊销测试；
- 导出 JSON 备份；
- 测试输入「我知道要删除远端数据」进行危险区数据清空。

---

## 🚀 部署到 Cloudflare 线上

在本地预览满意后，执行以下步骤即可一键上线：

### 1. 登录 Cloudflare
```bash
npx wrangler login
```

### 2. 创建线上 D1 数据库与 R2 存储桶
```bash
npx wrangler d1 create daylogue-sync
npx wrangler r2 bucket create daylogue-blobs
```
> 将输出的 `database_id` 填入 `wrangler.toml` 中的 `database_id`。

### 3. 应用线上数据库迁移
```bash
npx wrangler d1 migrations apply daylogue-sync --remote
```

### 4. 设置线上安全密钥 (Secrets)
```bash
npx wrangler secret put ADMIN_KEY        # 后台管理登录密钥
npx wrangler secret put SESSION_SECRET   # Cookie 签名密钥（32 位以上随机串）
```

### 5. 一键打包并部署
```bash
npm run deploy
```
部署完成后，Cloudflare 会生成类似 `https://daylogue-sync.<your-subdomain>.workers.dev` 的正式访问链接。
