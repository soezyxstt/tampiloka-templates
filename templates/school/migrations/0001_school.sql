CREATE TABLE IF NOT EXISTS school_state (namespace TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS school_sessions (token_hash TEXT PRIMARY KEY, namespace TEXT NOT NULL, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS school_sessions_expiry ON school_sessions(expires_at);
CREATE TABLE IF NOT EXISTS school_visitors (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS school_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS school_payment_routes (order_id TEXT PRIMARY KEY, namespace TEXT NOT NULL);
