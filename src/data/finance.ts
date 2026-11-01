import { getDb } from "./db";

export interface Category {
  id: number;
  name: string;
  budget_cents: number | null;
}

export interface Transaction {
  id: number;
  day: string;
  amount_cents: number;
  category_id: number | null;
  category: string | null;
  note: string | null;
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>("SELECT id, name, budget_cents FROM categories ORDER BY id");
}

export async function setCategoryBudget(id: number, budgetCents: number | null) {
  const db = await getDb();
  await db.execute("UPDATE categories SET budget_cents = $1 WHERE id = $2", [budgetCents, id]);
}

/** Transactions whose day falls in `month` ("YYYY-MM"), newest first. */
export async function listTransactions(month: string): Promise<Transaction[]> {
  const db = await getDb();
  return db.select<Transaction[]>(
    `SELECT t.id, t.day, t.amount_cents, t.category_id, c.name AS category, t.note
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE substr(t.day, 1, 7) = $1
     ORDER BY t.day DESC, t.id DESC`,
    [month],
  );
}

export async function listTransactionsOn(day: string): Promise<Transaction[]> {
  const db = await getDb();
  return db.select<Transaction[]>(
    `SELECT t.id, t.day, t.amount_cents, t.category_id, c.name AS category, t.note
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.day = $1 ORDER BY t.id DESC`,
    [day],
  );
}

export async function addTransaction(day: string, amountCents: number, categoryId: number | null, note: string | null) {
  const db = await getDb();
  await db.execute(
    "INSERT INTO transactions (day, amount_cents, category_id, note) VALUES ($1, $2, $3, $4)",
    [day, amountCents, categoryId, note],
  );
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM transactions WHERE id = $1", [id]);
}

/** Total expense (positive cents) per month for months >= `fromMonth`. */
export async function monthlyExpenses(fromMonth: string): Promise<{ month: string; total: number }[]> {
  const db = await getDb();
  return db.select(
    `SELECT substr(day, 1, 7) AS month, -SUM(amount_cents) AS total
     FROM transactions WHERE amount_cents < 0 AND substr(day, 1, 7) >= $1
     GROUP BY month ORDER BY month`,
    [fromMonth],
  );
}
