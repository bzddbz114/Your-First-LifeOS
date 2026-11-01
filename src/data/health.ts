import { getDb } from "./db";

export type HealthKind = "sleep" | "steps" | "weight" | "workout";

export interface HealthLog {
  id: number;
  day: string;
  kind: HealthKind;
  value: number;
  note: string | null;
}

export async function listHealthLogs(sinceDay: string): Promise<HealthLog[]> {
  const db = await getDb();
  return db.select<HealthLog[]>(
    "SELECT id, day, kind, value, note FROM health_logs WHERE day >= $1 ORDER BY day DESC, id DESC",
    [sinceDay],
  );
}

export async function latestHealthLog(kind: HealthKind): Promise<HealthLog | null> {
  const db = await getDb();
  const rows = await db.select<HealthLog[]>(
    "SELECT id, day, kind, value, note FROM health_logs WHERE kind = $1 ORDER BY day DESC, id DESC LIMIT 1",
    [kind],
  );
  return rows[0] ?? null;
}

/** Sleep, steps and weight hold one value per day, so recording again replaces it; workouts accumulate. */
export async function addHealthLog(day: string, kind: HealthKind, value: number, note: string | null) {
  const db = await getDb();
  if (kind !== "workout") {
    await db.execute("DELETE FROM health_logs WHERE day = $1 AND kind = $2", [day, kind]);
  }
  await db.execute("INSERT INTO health_logs (day, kind, value, note) VALUES ($1, $2, $3, $4)", [
    day,
    kind,
    value,
    note,
  ]);
}

export async function deleteHealthLog(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM health_logs WHERE id = $1", [id]);
}
