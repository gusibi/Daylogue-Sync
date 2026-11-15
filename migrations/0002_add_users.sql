-- 0002_add_users.sql: Users and UID support

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,                  -- uid: e.g. usr_01jk98az
  space_id   TEXT NOT NULL DEFAULT 'default',   -- space/family group
  name       TEXT NOT NULL,                     -- display name: e.g. "爸爸"
  token_id   TEXT UNIQUE,                       -- strictly 1:1 token
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE tokens ADD COLUMN user_id TEXT;
ALTER TABLE records ADD COLUMN uid TEXT NOT NULL DEFAULT 'usr_default';
CREATE INDEX IF NOT EXISTS idx_records_uid ON records(space_id, uid);
