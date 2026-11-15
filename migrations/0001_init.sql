-- 0001_init.sql: Sync Engine Base Tables

CREATE TABLE IF NOT EXISTS records (
  space_id   TEXT    NOT NULL DEFAULT 'default',
  type       TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  v          INTEGER NOT NULL DEFAULT 1,
  data       TEXT,                       -- JSON; deleted 为 1 时为 NULL
  deleted    INTEGER NOT NULL DEFAULT 0,
  hlc        TEXT    NOT NULL,
  ts         INTEGER,                    -- 业务时间戳 (ms)，用于按时间排序与过滤
  device_id  TEXT    NOT NULL,
  seq        INTEGER NOT NULL,           -- 全局单调递增，作为增量拉取游标
  updated_at INTEGER NOT NULL,           -- 服务端接收与写入时间
  PRIMARY KEY (space_id, type, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_seq ON records(space_id, seq);
CREATE INDEX IF NOT EXISTS idx_records_type_ts ON records(space_id, type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_records_msg_role ON records(space_id, json_extract(data, '$.role')) WHERE type = 'message';

CREATE TABLE IF NOT EXISTS blobs (
  space_id   TEXT    NOT NULL DEFAULT 'default',
  hash       TEXT    NOT NULL,
  mime       TEXT,
  size       INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (space_id, hash)
);

CREATE TABLE IF NOT EXISTS devices (
  space_id      TEXT    NOT NULL DEFAULT 'default',
  id            TEXT    NOT NULL,
  name          TEXT,
  platform      TEXT,
  token_id      TEXT,
  first_seen    INTEGER,
  last_seen     INTEGER,
  last_push     INTEGER,
  last_pull_seq INTEGER,
  PRIMARY KEY (space_id, id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id         TEXT    PRIMARY KEY,
  space_id   TEXT    NOT NULL DEFAULT 'default',
  name       TEXT    NOT NULL,
  hash       TEXT    NOT NULL UNIQUE,  -- SHA-256(token)
  prefix     TEXT    NOT NULL,         -- 前 6 位用于展示与辨识
  created_at INTEGER NOT NULL,
  last_used  INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         INTEGER NOT NULL,
  device_id  TEXT,
  kind       TEXT,
  count      INTEGER,
  conflicts  INTEGER,
  ms         INTEGER,
  error      TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', '0');
INSERT OR IGNORE INTO meta (key, value) VALUES ('protocol', '1');
