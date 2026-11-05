import { getDb } from "./db";

export interface Task {
  id: number;
  title: string;
  due_date: string | null;
  done_at: string | null;
  project_id: number | null;
  project_title: string | null;
}

const TASK_COLUMNS = "t.id, t.title, t.due_date, t.done_at, t.project_id, p.title AS project_title";
const TASK_ORDER = "t.done_at IS NOT NULL, t.due_date IS NULL, t.due_date, t.id";

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks t LEFT JOIN projects p ON p.id = t.project_id ORDER BY ${TASK_ORDER}`,
  );
}

export async function listProjectTasks(projectId: number): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.project_id = $1 ORDER BY ${TASK_ORDER}`,
    [projectId],
  );
}

export async function addTask(title: string, dueDate: string | null, projectId: number | null = null) {
  const db = await getDb();
  await db.execute("INSERT INTO tasks (title, due_date, project_id) VALUES ($1, $2, $3)", [title, dueDate, projectId]);
}

export async function setTaskDone(id: number, done: boolean) {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET done_at = ${done ? "datetime('now', 'localtime')" : "NULL"} WHERE id = $1`,
    [id],
  );
}

export async function setTaskDue(id: number, dueDate: string | null) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET due_date = $1 WHERE id = $2", [dueDate, id]);
}

export async function deleteTask(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}
