import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSetting, setSetting } from "./settings";
import { QUOTES, quoteOfDay, type Quote } from "./quotes";
import { generateQuote } from "./ai";
import { listTasks } from "./tasks";
import { listProjects } from "./projects";
import { today } from "./db";

export interface DailyQuote extends Quote {
  /** "ai" when DeepSeek wrote it for today. */
  source: "library" | "ai";
}

/** Today's line: the one picked via 换一句 if any, else the library's line for the date. */
async function loadQuote(day: string): Promise<DailyQuote> {
  try {
    const saved = JSON.parse((await getSetting("daily_quote")) ?? "null") as (DailyQuote & { day: string }) | null;
    if (saved?.day === day) return saved;
  } catch {
    // Fall through to the library pick.
  }
  return { ...quoteOfDay(day), source: "library" };
}

export function useDailyQuote() {
  const day = today();
  return useQuery({ queryKey: ["quote", day], queryFn: () => loadQuote(day), staleTime: Infinity });
}

/** 换一句: asks DeepSeek when `useAi`, otherwise draws another library line. Kept for the rest of the day. */
export function useShuffleQuote() {
  const qc = useQueryClient();
  const day = today();
  return useMutation({
    mutationFn: async ({ useAi, current }: { useAi: boolean; current?: string }): Promise<DailyQuote> => {
      let next: DailyQuote;
      if (useAi) {
        const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
        const { text, kind } = await generateQuote({
          weekday: new Date().toLocaleDateString("zh-CN", { weekday: "long" }),
          hour: new Date().getHours(),
          openTasks: tasks.filter((t) => !t.done_at && (!t.due_date || t.due_date <= day)).map((t) => t.title),
          activeProjects: projects.filter((p) => !p.done_at).map((p) => p.title),
        });
        next = { text, kind, author: "DeepSeek 为你写的", source: "ai" };
      } else {
        const pool = QUOTES.filter((x) => x.text !== current);
        next = { ...pool[Math.floor(Math.random() * pool.length)], source: "library" };
      }
      await setSetting("daily_quote", JSON.stringify({ ...next, day }));
      return next;
    },
    onSuccess: (q) => qc.setQueryData(["quote", day], q),
  });
}
