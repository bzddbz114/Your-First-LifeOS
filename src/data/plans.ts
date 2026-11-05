import { getDb } from "./db";

/** The evening plan for a day, written the night before. */
export interface DayPlan {
  day: string;
  intention: string | null;
  /** Task ids picked as the day's priorities, in order. */
  focusIds: number[];
}

export async function getPlan(day: string): Promise<DayPlan | null> {
  const db = await getDb();
  const [row] = await db.select<{ day: string; intention: string | null; focus_ids: string }[]>(
    "SELECT day, intention, focus_ids FROM day_plans WHERE day = $1",
    [day],
  );
  if (!row) return null;
  let focusIds: number[] = [];
  try {
    focusIds = JSON.parse(row.focus_ids);
  } catch {
    // Treat a damaged list as empty.
  }
  return { day: row.day, intention: row.intention, focusIds };
}

export async function savePlan(plan: DayPlan) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO day_plans (day, intention, focus_ids, planned_at) VALUES ($1, $2, $3, datetime('now', 'localtime'))
     ON CONFLICT (day) DO UPDATE SET intention = excluded.intention, focus_ids = excluded.focus_ids, planned_at = excluded.planned_at`,
    [plan.day, plan.intention?.trim() || null, JSON.stringify(plan.focusIds)],
  );
}
