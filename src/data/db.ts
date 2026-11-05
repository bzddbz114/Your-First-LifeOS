import Database from "@tauri-apps/plugin-sql";

/** The original database: account 1's data, plus the account registry. Migrated by the Rust plugin. */
export const MAIN_DB = "sqlite:lifeos.db";

/** Every other account keeps its data in its own file. */
export const accountDbUrl = (accountId: number) => (accountId === 1 ? MAIN_DB : `sqlite:lifeos-${accountId}.db`);

// Same SQL files the Rust side registers, so extra account databases get an identical schema.
const MIGRATIONS = Object.entries(
  import.meta.glob("../../src-tauri/migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql);

/** Applies pending migrations to a non-main database, tracking progress in PRAGMA user_version. */
async function migrate(db: Database) {
  const [{ user_version }] = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    const statements = MIGRATIONS[v]
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .split(/;\s*(?:\n|$)/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const sql of statements) await db.execute(sql);
    await db.execute(`PRAGMA user_version = ${v + 1}`);
  }
}

const opened = new Map<string, Promise<Database>>();

export function openDb(url: string): Promise<Database> {
  let p = opened.get(url);
  if (!p) {
    p = Database.load(url).then(async (db) => {
      if (url !== MAIN_DB) await migrate(db);
      return db;
    });
    p.catch(() => opened.delete(url));
    opened.set(url, p);
  }
  return p;
}

/** Forgets a cached connection (after closing it, e.g. before deleting the account's file). */
export async function closeDb(url: string) {
  const p = opened.get(url);
  opened.delete(url);
  if (p) await (await p).close(url);
}

let activeUrl = MAIN_DB;

/** Points every data function at the signed-in account's database. */
export function setActiveDb(url: string) {
  activeUrl = url;
}

/** The signed-in account's database. */
export function getDb(): Promise<Database> {
  return openDb(activeUrl);
}

export function formatDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return formatDay(new Date());
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return formatDay(d);
}

/** "YYYY-MM" shifted by n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return formatDay(d).slice(0, 7);
}

export function formatMoney(cents: number): string {
  return `¥${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`;
}

/** "11月18日" from "YYYY-MM-DD". */
export function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${m}月${d}日`;
}
