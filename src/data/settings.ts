import { useQuery } from "@tanstack/react-query";
import { getDb } from "./db";

export type SettingKey = "deepseek_api_key" | "deepseek_model" | "prefs" | "daily_quote";

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string | null) {
  const db = await getDb();
  if (value === null || value === "") {
    await db.execute("DELETE FROM settings WHERE key = $1", [key]);
  } else {
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
}

export function useSetting(key: SettingKey) {
  return useQuery({ queryKey: ["settings", key], queryFn: () => getSetting(key) });
}
