import { getDb } from "./db";

export interface Project {
  id: number;
  title: string;
  notes: string | null;
  start_date: string | null;
  target_date: string | null;
  done_at: string | null;
  /** Number of steps (tasks) in the project. */
  total: number;
  /** Number of finished steps. */
  done: number;
  /** The earliest open step, if any. */
  next_step: string | null;
  next_step_id: number | null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    `SELECT p.id, p.title, p.notes, p.start_date, p.target_date, p.done_at,
       COUNT(t.id) AS total, COUNT(t.done_at) AS done,
       n.title AS next_step, n.id AS next_step_id
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     LEFT JOIN tasks n ON n.id = (
       SELECT id FROM tasks WHERE project_id = p.id AND done_at IS NULL
       ORDER BY due_date IS NULL, due_date, id LIMIT 1
     )
     WHERE p.archived_at IS NULL
     GROUP BY p.id
     ORDER BY p.done_at IS NOT NULL, p.target_date IS NULL, p.target_date, p.id`,
  );
}

export async function addProject(title: string, startDate: string | null, targetDate: string | null) {
  const db = await getDb();
  await db.execute("INSERT INTO projects (title, start_date, target_date) VALUES ($1, $2, $3)", [
    title,
    startDate,
    targetDate,
  ]);
}

type EditableField = "title" | "notes" | "start_date" | "target_date";

export async function updateProject(id: number, fields: Partial<Pick<Project, EditableField>>) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  const db = await getDb();
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(", ");
  await db.execute(`UPDATE projects SET ${sets} WHERE id = $${entries.length + 1}`, [
    ...entries.map(([, v]) => v),
    id,
  ]);
}

export async function setProjectDone(id: number, done: boolean) {
  const db = await getDb();
  await db.execute(
    `UPDATE projects SET done_at = ${done ? "datetime('now', 'localtime')" : "NULL"} WHERE id = $1`,
    [id],
  );
}

export async function archiveProject(id: number) {
  const db = await getDb();
  await db.execute("UPDATE projects SET archived_at = datetime('now', 'localtime') WHERE id = $1", [id]);
}

/** Adds several steps at once (e.g. accepted AI suggestions). */
export async function addSteps(projectId: number, steps: { title: string; due_date: string | null }[]) {
  const db = await getDb();
  for (const s of steps) {
    await db.execute("INSERT INTO tasks (title, due_date, project_id) VALUES ($1, $2, $3)", [s.title, s.due_date, projectId]);
  }
}

/** Deletes the project together with its steps. */
export async function deleteProject(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE project_id = $1", [id]);
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}
