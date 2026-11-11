-- Schema do GreenFinance multiusuário (Cloudflare D1).
-- Idempotente: pode rodar em todo deploy.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  pass_hash   TEXT NOT NULL,
  pass_salt   TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Estado completo do app (AppState em JSON) por usuário.
CREATE TABLE IF NOT EXISTS user_state (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL
);

-- Conexões Open Finance (Pluggy) de cada usuário.
CREATE TABLE IF NOT EXISTS pluggy_items (
  item_id       TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connector     TEXT,
  last_sync_at  TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON pluggy_items(user_id);

-- Tentativas de login (anti força-bruta simples).
CREATE TABLE IF NOT EXISTS login_attempts (
  email       TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email, at);
