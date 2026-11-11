CREATE TABLE media_objects (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  content_type TEXT NOT NULL
);
