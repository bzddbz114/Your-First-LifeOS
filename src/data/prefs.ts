import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSetting, setSetting } from "./settings";
import { useSession } from "./session";

export type AccentId = "blue" | "green" | "purple" | "rose" | "teal" | "graphite";
export type Appearance = "system" | "light" | "dark";
export type MotionPref = "full" | "reduced";
export type StyleId = "classic" | "glass" | "soft" | "mono";
export type HomeTheme = "editorial" | "hud";
export type HomeModule = "schedule" | "projects" | "habits" | "spending" | "body" | "journal";

export interface Prefs {
  /** How the Today page greets you; empty for a plain greeting. */
  name: string;
  accent: AccentId;
  appearance: Appearance;
  motion: MotionPref;
  /** Visual style of panels and chrome. */
  style: StyleId;
  /** Look of the Today page: warm editorial type, or an industrial HUD. */
  homeTheme: HomeTheme;
  /** Today-page cards magnify under the pointer. */
  hoverZoom: boolean;
  /** Today-page cards the user switched off. */
  homeHidden: HomeModule[];
}

export const DEFAULT_PREFS: Prefs = {
  name: "",
  accent: "blue",
  appearance: "system",
  motion: "full",
  style: "classic",
  homeTheme: "editorial",
  hoverZoom: true,
  homeHidden: [],
};

export const STYLES: { id: StyleId; label: string; hint: string }[] = [
  { id: "classic", label: "经典", hint: "清爽的白色卡片与细边框" },
  { id: "glass", label: "液态玻璃", hint: "半透明磨砂面板,流动的彩色背景" },
  { id: "soft", label: "柔光", hint: "无边框,大圆角与柔和阴影" },
  { id: "mono", label: "极简", hint: "纯白底,发丝线与小圆角" },
];

/** [accent, accent-ink] for light and dark appearances. */
export const ACCENTS: Record<AccentId, { label: string; light: [string, string]; dark: [string, string] }> = {
  blue: { label: "海蓝", light: ["#2f5bd3", "#1e3f99"], dark: ["#5b7fe6", "#a9bdf7"] },
  green: { label: "松绿", light: ["#2e7d4f", "#1d5636"], dark: ["#3f9e66", "#8fd3ab"] },
  purple: { label: "藤紫", light: ["#6d4ed8", "#4b32a3"], dark: ["#8a6ff0", "#c6b8f7"] },
  rose: { label: "玫红", light: ["#c93a64", "#92244a"], dark: ["#d9557d", "#f3a5bd"] },
  teal: { label: "湖青", light: ["#0f7c86", "#0a5961"], dark: ["#2a9aa5", "#88d3da"] },
  graphite: { label: "石墨", light: ["#4a4a46", "#2a2a28"], dark: ["#8a8a84", "#deded8"] },
};

export const HOME_MODULES: { id: HomeModule; label: string }[] = [
  { id: "schedule", label: "日程" },
  { id: "projects", label: "项目" },
  { id: "habits", label: "习惯" },
  { id: "spending", label: "今日支出" },
  { id: "body", label: "身体" },
  { id: "journal", label: "日记" },
];

/** Per-account localStorage mirror of the prefs, so the theme applies before the database loads. */
const cacheKey = (accountId: number | null) => `lifeos.prefs.${accountId ?? 0}`;

function parse(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Last-known prefs of `accountId` (default: the signed-in one) from localStorage. */
export function cachedPrefs(accountId = useSession.getState().accountId): Prefs {
  try {
    return parse(localStorage.getItem(cacheKey(accountId)));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs(): Prefs {
  const { data } = useQuery({
    queryKey: ["settings", "prefs"],
    queryFn: async () => parse(await getSetting("prefs")),
    placeholderData: () => cachedPrefs(),
  });
  return data ?? DEFAULT_PREFS;
}

export function useUpdatePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const next = { ...parse(await getSetting("prefs")), ...patch };
      const raw = JSON.stringify(next);
      await setSetting("prefs", raw);
      try {
        localStorage.setItem(cacheKey(useSession.getState().accountId), raw);
      } catch {
        // Cache only; the database copy is authoritative.
      }
      return next;
    },
    // Optimistic, so color and theme pickers respond instantly.
    onMutate: (patch) => {
      const prev = qc.getQueryData<Prefs>(["settings", "prefs"]) ?? cachedPrefs();
      qc.setQueryData(["settings", "prefs"], { ...prev, ...patch });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings", "prefs"] }),
  });
}

function useSystemDark() {
  const [dark, setDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

/** Applies appearance, accent color and motion preference to the document root. */
export function useApplyPrefs(prefs: Prefs) {
  const systemDark = useSystemDark();
  const dark = prefs.appearance === "dark" || (prefs.appearance === "system" && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.motion = prefs.motion;
    root.dataset.style = prefs.style;
    root.dataset.home = prefs.homeTheme;
    const [accent, ink] = (ACCENTS[prefs.accent] ?? ACCENTS.blue)[dark ? "dark" : "light"];
    root.style.setProperty("--color-accent", accent);
    root.style.setProperty("--color-accent-ink", ink);
  }, [dark, prefs.accent, prefs.motion, prefs.style, prefs.homeTheme]);
}
