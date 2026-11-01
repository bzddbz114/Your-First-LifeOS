import { getDb } from "./db";

export interface Task {
  id: number;
  title: string;
  due_date: string | null;
  done_at: string | null;
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT id, title, due_date, done_at FROM tasks ORDER BY done_at IS NOT NULL, due_date IS NULL, due_date, id",
  );
}

export async function addTask(title: string, dueDate: string | null) {
  const db = await getDb();
  await db.execute("INSERT INTO tasks (title, due_date) VALUES ($1, $2)", [title, dueDate]);
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
