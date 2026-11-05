import { invoke } from "@tauri-apps/api/core";
import { MAIN_DB, accountDbUrl, closeDb, openDb } from "./db";

export type AvatarKind = "emoji" | "initial" | "image";

export interface Account {
  id: number;
  name: string;
  avatar_kind: AvatarKind;
  /** The emoji, or a JPEG data URL for photos; unused for initials. */
  avatar_value: string | null;
  /** Background behind emoji and initials. */
  avatar_color: string;
  has_password: boolean;
  created_at: string;
}

interface AccountRow extends Omit<Account, "has_password"> {
  password_hash: string | null;
  password_salt: string | null;
}

export const AVATAR_COLORS = ["#2f5bd3", "#2e7d4f", "#6d4ed8", "#c93a64", "#0f7c86", "#c2570c", "#4a4a46"];

/** The registry lives in the main database; account 1 *is* that database's data. */
async function registry() {
  const db = await openDb(MAIN_DB);
  await db.execute(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar_kind TEXT NOT NULL DEFAULT 'initial',
    avatar_value TEXT,
    avatar_color TEXT NOT NULL DEFAULT '#2f5bd3',
    password_hash TEXT,
    password_salt TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    last_login_at TEXT
  )`);
  return db;
}

const toAccount = ({ password_hash, password_salt: _salt, ...a }: AccountRow): Account => ({
  ...a,
  has_password: !!password_hash,
});

/** All accounts; creates account 1 for the existing data on first run. */
export async function listAccounts(): Promise<Account[]> {
  const db = await registry();
  let rows = await db.select<AccountRow[]>("SELECT * FROM accounts ORDER BY id");
  if (rows.length === 0) {
    await db.execute("INSERT INTO accounts (id, name, avatar_kind, avatar_color) VALUES (1, '我', 'initial', $1)", [
      AVATAR_COLORS[0],
    ]);
    rows = await db.select<AccountRow[]>("SELECT * FROM accounts ORDER BY id");
  }
  return rows.map(toAccount);
}

export async function createAccount(name: string, avatarColor: string): Promise<number> {
  const db = await registry();
  const res = await db.execute("INSERT INTO accounts (name, avatar_kind, avatar_color) VALUES ($1, 'initial', $2)", [
    name,
    avatarColor,
  ]);
  const id = res.lastInsertId!;
  await openDb(accountDbUrl(id)); // creates and migrates the new account's database
  return id;
}

export async function updateProfile(
  id: number,
  fields: Partial<Pick<Account, "name" | "avatar_kind" | "avatar_value" | "avatar_color">>,
) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  const db = await registry();
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(", ");
  await db.execute(`UPDATE accounts SET ${sets} WHERE id = $${entries.length + 1}`, [...entries.map(([, v]) => v), id]);
}

export async function markLogin(id: number) {
  const db = await registry();
  await db.execute("UPDATE accounts SET last_login_at = datetime('now', 'localtime') WHERE id = $1", [id]);
}

/** Removes the account and its database file. Account 1 holds the registry and can't be deleted. */
export async function deleteAccount(id: number) {
  if (id === 1) throw new Error("主账号不能删除");
  await closeDb(accountDbUrl(id));
  await invoke("delete_account_data", { accountId: id });
  const db = await registry();
  await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
}

// ─── Passwords ───────────────────────────────────────────────────────────────
// PBKDF2-SHA256 with a per-account salt. This guards the app's lock screen; the
// database files themselves are not encrypted.

const ITERATIONS = 210_000;
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return hex(bits);
}

export async function verifyPassword(id: number, password: string): Promise<boolean> {
  const db = await registry();
  const [row] = await db.select<AccountRow[]>("SELECT * FROM accounts WHERE id = $1", [id]);
  if (!row?.password_hash || !row.password_salt) return true;
  const hash = await derive(password, unhex(row.password_salt));
  // Constant-time-ish comparison; timing hardly matters locally, but it costs nothing.
  let diff = hash.length ^ row.password_hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ row.password_hash.charCodeAt(i);
  return diff === 0;
}

/** Sets a new password, or removes it when `password` is empty. */
export async function setPassword(id: number, password: string) {
  const db = await registry();
  if (!password) {
    await db.execute("UPDATE accounts SET password_hash = NULL, password_salt = NULL WHERE id = $1", [id]);
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await db.execute("UPDATE accounts SET password_hash = $1, password_salt = $2 WHERE id = $3", [
    await derive(password, salt),
    hex(salt),
    id,
  ]);
}
