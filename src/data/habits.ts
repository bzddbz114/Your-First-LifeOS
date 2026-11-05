import { addDays, getDb } from "./db";

export interface Habit {
  id: number;
  name: string;
  /** Daily reminder time "HH:MM", or null. */
  remind_at: string | null;
  checked: boolean;
  streak: number;
  /** One flag per day for the requested window ending at `day`, oldest first. */
  history: boolean[];
}

export async function listHabits(day: string, windowDays = 7): Promise<Habit[]> {
  const db = await getDb();
  const habits = await db.select<{ id: number; name: string; remind_at: string | null }[]>(
    "SELECT id, name, remind_at FROM habits WHERE archived_at IS NULL ORDER BY remind_at IS NULL, remind_at, id",
  );
  const logs = await db.select<{ habit_id: number; day: string }[]>(
    "SELECT habit_id, day FROM habit_logs",
  );
  const window = Array.from({ length: windowDays }, (_, i) => addDays(day, i - windowDays + 1));
  return habits.map((h) => {
    const days = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.day));
    return {
      ...h,
      checked: days.has(day),
      streak: streakEndingAt(days, day),
      history: window.map((d) => days.has(d)),
    };
  });
}

// Counts consecutive days up to `day`; an unchecked today doesn't break a streak ending yesterday.
function streakEndingAt(days: Set<string>, day: string): number {
  let cursor = days.has(day) ? day : addDays(day, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export async function addHabit(name: string) {
  const db = await getDb();
  await db.execute("INSERT INTO habits (name) VALUES ($1)", [name]);
}

export async function setHabitReminder(id: number, remindAt: string | null) {
  const db = await getDb();
  await db.execute("UPDATE habits SET remind_at = $1 WHERE id = $2", [remindAt || null, id]);
}

export async function archiveHabit(id: number) {
  const db = await getDb();
  await db.execute("UPDATE habits SET archived_at = datetime('now') WHERE id = $1", [id]);
}

export async function setHabitChecked(id: number, day: string, checked: boolean) {
  const db = await getDb();
  if (checked) {
    await db.execute("INSERT OR IGNORE INTO habit_logs (habit_id, day) VALUES ($1, $2)", [id, day]);
  } else {
    await db.execute("DELETE FROM habit_logs WHERE habit_id = $1 AND day = $2", [id, day]);
  }
}
