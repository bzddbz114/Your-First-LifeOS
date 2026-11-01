import { getDb } from "./db";

export type NoteKind = "journal" | "note";

export interface Note {
  id: number;
  kind: NoteKind;
  day: string | null;
  title: string;
  body: string;
  mood: number | null;
  updated_at: string;
}

export const MOODS = ["很糟", "一般", "还不错", "很好", "超棒"];

export async function listNotes(kind: NoteKind, search: string): Promise<Note[]> {
  const db = await getDb();
  const q = `%${search.trim()}%`;
  return db.select<Note[]>(
    `SELECT id, kind, day, title, body, mood, updated_at FROM notes
     WHERE kind = $1 AND (title LIKE $2 OR body LIKE $2)
     ORDER BY ${kind === "journal" ? "day DESC" : "updated_at DESC"}`,
    [kind, q],
  );
}

export async function getJournal(day: string): Promise<Note | null> {
  const db = await getDb();
  const rows = await db.select<Note[]>(
    "SELECT id, kind, day, title, body, mood, updated_at FROM notes WHERE kind = 'journal' AND day = $1",
    [day],
  );
  return rows[0] ?? null;
}

export async function saveJournal(day: string, body: string, mood: number | null) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO notes (kind, day, body, mood) VALUES ('journal', $1, $2, $3)
     ON CONFLICT (day) WHERE kind = 'journal'
     DO UPDATE SET body = excluded.body, mood = excluded.mood, updated_at = datetime('now')`,
    [day, body, mood],
  );
}

export async function createNote(): Promise<number> {
  const db = await getDb();
  const res = await db.execute("INSERT INTO notes (kind, title) VALUES ('note', '未命名笔记')");
  return res.lastInsertId ?? 0;
}

export async function updateNote(id: number, title: string, body: string) {
  const db = await getDb();
  await db.execute("UPDATE notes SET title = $1, body = $2, updated_at = datetime('now') WHERE id = $3", [
    title,
    body,
    id,
  ]);
}

export async function deleteNote(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

export interface DaySummary {
  tasksDone: number;
  habitsDone: number;
  habitsTotal: number;
  spentCents: number;
  sleepMinutes: number | null;
  workoutMinutes: number;
}

/** Cross-module snapshot of one day, shown beside its journal entry. */
export async function daySummary(day: string): Promise<DaySummary> {
  const db = await getDb();
  const [row] = await db.select<DaySummary[]>(
    `SELECT
       (SELECT COUNT(*) FROM tasks WHERE date(done_at) = $1) AS tasksDone,
       (SELECT COUNT(*) FROM habit_logs WHERE day = $1) AS habitsDone,
       (SELECT COUNT(*) FROM habits WHERE archived_at IS NULL) AS habitsTotal,
       (SELECT COALESCE(-SUM(amount_cents), 0) FROM transactions WHERE day = $1 AND amount_cents < 0) AS spentCents,
       (SELECT value FROM health_logs WHERE day = $1 AND kind = 'sleep' LIMIT 1) AS sleepMinutes,
       (SELECT COALESCE(SUM(value), 0) FROM health_logs WHERE day = $1 AND kind = 'workout') AS workoutMinutes`,
    [day],
  );
  return row;
}
