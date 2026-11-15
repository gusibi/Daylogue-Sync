# Daylogue · 数据同步协议规范 (v1)

本文档定义了 Daylogue 客户端（macOS / iOS / Android / Desktop）与服务端（Cloudflare Workers + D1 + R2）之间进行增量数据同步的公共协议。

---

## 1. 核心设计原则

1. **本地优先 (Local-First)**：所有业务写操作先落本地 SQLite，随后后台异步推送，离线完全可用。
2. **单一记录信封 (Unified Record Envelope)**：所有业务数据类型（消息、日记、待办、账本、会话、标签、设置）包装在统一信封中传输。
3. **混合逻辑时钟与 LWW (HLC & Last-Write-Wins)**：
   - 记录粒度解决冲突。
   - `incoming.hlc > existing.hlc` 时胜出，更新并赋予新的 `seq`。
   - 格式：`<毫秒时间戳13位>-<计数4位>-<设备ID>`（例：`1763184000123-0001-dev_macos_01`），支持直接字典序比较。
4. **软删除墓碑 (Tombstone)**：删除操作上传 `deleted: true`，服务端永久保留墓碑记录，防止离线设备重新写入已删除数据。
5. **增量拉取游标 (Cursor Pull)**：服务端为每次生效的变更分配单调递增的整数 `seq`，客户端保存上一次同步成功的最大 `seq` 作为游标。
6. **媒体解耦 (Content-Addressable Blobs)**：图片与语音等大文件通过 SHA-256 去重并独立流式上传/下载到 R2，记录只引用 `media.hash`。
7. **危险区确认**：删除所有远端数据必须由调用方传递精确的确认短语 `我知道要删除远端数据`。

---

## 2. 记录信封格式 (Record Envelope)

```typescript
interface SyncEnvelope<T = Record<string, unknown>> {
  /** 记录类型：session | message | diary | todo | bill | tag | setting | (未知扩展) */
  type: string;
  /** 记录主键：uuid / dateString / name / settingKey */
  id: string;
  /** Schema 版本号，默认 1 */
  v: number;
  /** 所属用户 ID (UID)，如 usr_01jk... */
  uid: string;
  /** 混合逻辑时钟：<timestamp_ms>-<counter_4digits>-<deviceId> */
  hlc: string;
  /** 业务时间戳（毫秒），用于后台过滤与时间线排序 */
  ts: number;
  /** 是否已删除 */
  deleted: boolean;
  /** 业务数据负载（deleted 为 true 时为 null） */
  data: T | null;
}
```

### 各类型 ID 与 data 字段定义

| type | id 规则 | data 字段 (camelCase) | ts 取值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `session` | `dateString` (例: `2026-11-15`) | `dateString`, `diaryMarkdown`, `moodScore`, `keywords`, `lastSummarizedAt`, `lastUpdatedAt`, `lastMessagePreview` | `lastUpdatedAt` | 每日会话元信息 |
| `message` | `uuid` | `sessionKey`, `timestamp`, `role` (0=用户, 1=AI), `type` (0=文字, 1=语音, 2=图片, 3=日记, 4=重置), `status`, `content`, `media`, `mediaMetadata`, `quoteMessageUuid`, `generatedEntities`, `intent`, `isInspire`, `isSystem`, `diaryRecordId`, `errorCode`, `errorMessage` | `timestamp` | 对话记录。含 `media: {hash, mime, size, kind}` |
| `diary` | `uuid` | `sessionKey`, `content`, `moodScore`, `moodLabel`, `keywords`, `createdAt`, `updatedAt`, `isEnabled` | `createdAt` | 结构化日记 |
| `todo` | `uuid` | `content`, `isCompleted`, `isGoal`, `dueDate`, `reminderTimeText`, `reminderTime`, `tags`, `sourceMessageUuid`, `createdAt` | `createdAt` | 待办项 |
| `bill` | `uuid` | `amount`, `category`, `description`, `occurredAt`, `sourceMessageUuid`, `isIncome` | `occurredAt` | 记账记录 |
| `tag` | `name` | `name`, `createdAt` | `createdAt` | 标签 |
| `setting` | `key` (`language` \| `models` \| `ai`) | 根据 key 不同：<br>- `language`: `{language: string}`<br>- `models`: `{providers: object, assignments: object}`<br>- `ai`: `{thinkingEffort: string, timeoutSecs: number}` | 客户端修改时间 | 模型配置含 API Key |

---

## 3. API 接口定义

所有接口均基于 HTTP/HTTPS，Base Path 为 `/api/v1`。
同步接口均需要通过 Header 传递身份凭证与设备信息：
- `Authorization: Bearer <SyncToken>`
- `X-Device-Id: <deviceId>`

### 3.1 连通性测试：`GET /api/v1/ping`
验证 Token 是否有效及获取服务端状态。

- **Response 200**:
```json
{
  "ok": true,
  "protocol": 1,
  "server": "0.1.0",
  "time": 1763184000000,
  "user": {
    "id": "usr_01jk98az",
    "name": "爸爸"
  }
}
```
- **Response 401**: Token 无效或已吊销。

---

### 3.2 推送变更：`POST /api/v1/push`
客户端将本地待上传的变更打包推送到服务端（单次最多 200 条）。

- **Request Body**:
```json
{
  "deviceId": "dev_macos_01",
  "deviceName": "MacBook Pro",
  "platform": "macos",
  "records": [
    /* SyncEnvelope 数组 */
  ]
}
```

- **服务端处理逻辑**：
  1. 开启 D1 单一事务或批处理。
  2. 针对每条记录对比 `incoming.hlc` 与 `existing.hlc`。
  3. 若 `incoming.hlc > existing.hlc` 或记录尚不存在：
     - 分配最新递增的 `seq`。
     - 写入 `records` 表（如果是删除操作则更新 `deleted=1, data=NULL`）。
     - 加入 `accepted` 列表。
  4. 若 `incoming.hlc <= existing.hlc`：
     - 将服务端的较新记录放入 `conflicts` 列表（客户端收到后需覆写本地并取消发件箱）。
  5. 更新设备信息 `last_seen`, `last_push`。
  6. 记录同步统计日志到 `sync_log`。

- **Response 200**:
```json
{
  "ok": true,
  "accepted": ["msg_uuid_1", "todo_uuid_2"],
  "conflicts": [
    /* 发生冲突时服务端保留的 SyncEnvelope */
  ],
  "cursor": 128
}
```

---

### 3.3 拉取变更：`GET /api/v1/pull`
客户端拉取自上次游标以来的所有增量变更。

- **Query Parameters**:
  - `since`: 整数，起始游标 `seq`（不含），首次同步传 `0`。
  - `limit`: 返回数量限制，默认 500，最大 1000。

- **Response 200**:
```json
{
  "ok": true,
  "records": [
    /* SyncEnvelope 附带 seq 字段 */
  ],
  "next": 150,
  "hasMore": false
}
```

---

### 3.4 媒体文件：`HEAD / PUT / GET /api/v1/blobs/:sha256`
- **HEAD `/api/v1/blobs/:sha256`**：
  - 检查文件是否存在。200 表示已存在，404 表示需上传。
- **PUT `/api/v1/blobs/:sha256`**：
  - 上传媒体原始流，带 Header `Content-Type`。
  - 服务端计算哈希校验，匹配则存入 R2 及 `blobs` 表，不匹配返回 400。
- **GET `/api/v1/blobs/:sha256`**：
  - 下载媒体文件流。

---

### 3.5 危险区清空远端：`POST /api/v1/wipe`
清空或墓碑化所有远端数据，需要精确确认短语。

- **Request Body**:
```json
{
  "confirm": "我知道要删除远端数据"
}
```
- **服务端处理逻辑**：
  1. 比对 `confirm === "我知道要删除远端数据"`，不一致返回 `400 Bad Request`。
  2. 将所有活跃记录标记为 `deleted=1, data=NULL`（或清空并分配新基线 seq）。
  3. 清理 R2 中的媒体文件。
  4. 返回更新后的游标。
- **Response 200**:
```json
{
  "ok": true,
  "wiped": true,
  "cursor": 200
}
```

---

## 4. 确认短语常量 (Wipe Phrase)

全系统严格统一使用以下短语：
```typescript
export const WIPE_PHRASE = "我知道要删除远端数据";
```
