CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  -- Monthly budget in cents; NULL means no budget.
  budget_cents INTEGER
);

INSERT INTO categories (name, budget_cents) VALUES
  ('餐饮', 150000),
  ('交通', 40000),
  ('购物', 100000),
  ('日用', 60000),
  ('娱乐', 50000),
  ('医疗', NULL),
  ('居住', NULL),
  ('收入', NULL);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  -- Positive for income, negative for expense, in cents.
  amount_cents INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories (id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_day ON transactions (day);

-- kind: 'sleep' (value = minutes), 'steps', 'weight' (kg), 'workout' (value = minutes, note = activity)
CREATE TABLE health_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_health_kind_day ON health_logs (kind, day);

-- kind: 'journal' (one per day, `day` set) or 'note'
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  day TEXT,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  mood INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_notes_journal_day ON notes (day) WHERE kind = 'journal';
