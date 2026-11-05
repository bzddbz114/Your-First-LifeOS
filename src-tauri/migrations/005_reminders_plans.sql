-- Optional daily reminder time for a habit, "HH:MM" local time.
ALTER TABLE habits ADD COLUMN remind_at TEXT;

-- The evening plan for a day: written the night before, shown on that day's Today page.
CREATE TABLE day_plans (
  day TEXT PRIMARY KEY,
  -- One line of intention for the day, optional.
  intention TEXT,
  -- JSON array of task ids chosen as the day's priorities (1–3).
  focus_ids TEXT NOT NULL DEFAULT '[]',
  planned_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
