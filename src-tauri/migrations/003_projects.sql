-- Long-running projects; their steps are ordinary tasks with project_id set.
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT,
  start_date TEXT,
  target_date TEXT,
  done_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_project ON tasks (project_id);
