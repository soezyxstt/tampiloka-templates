-- Executed by OperationsStore initialization, not D1. New SQLite class via Wrangler v1 migration.
CREATE TABLE IF NOT EXISTS installation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), state_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_documents (id TEXT PRIMARY KEY, document_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_mutations (id TEXT PRIMARY KEY, mutation_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_audit (id TEXT PRIMARY KEY, audit_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
