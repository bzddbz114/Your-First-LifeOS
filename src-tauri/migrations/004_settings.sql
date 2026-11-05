-- App-wide key/value settings (e.g. the DeepSeek API key). Stored locally only.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
