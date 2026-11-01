import Database from "@tauri-apps/plugin-sql";

let db: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  db ??= Database.load("sqlite:lifeos.db");
  return db;
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
