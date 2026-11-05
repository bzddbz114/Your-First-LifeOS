import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { addDays, today } from "./db";
import { listHabits, type Habit } from "./habits";
import { getPlan } from "./plans";
import { usePrefs } from "./prefs";

/** Planning after midnight (before 4 a.m.) is still "tonight's" plan, for the day already begun. */
export function planTargetDay(now = new Date()) {
  return now.getHours() < 4 ? today() : addDays(today(), 1);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Re-renders once a minute, for time-of-day logic. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function useTodayHabits() {
  const day = today();
  return useQuery({ queryKey: ["habits", day], queryFn: () => listHabits(day) });
}

export function usePlanFor(day: string) {
  return useQuery({ queryKey: ["plan", day], queryFn: () => getPlan(day) });
}

/**
 * Keeps the Rust-side scheduler in step with the signed-in account's habits and plan.
 * Mount once inside the workspace; unmounting (sign-out, account switch) clears it.
 */
export function useReminderSync() {
  const prefs = usePrefs();
  const day = today();
  const target = planTargetDay();
  const { data: habits } = useTodayHabits();
  const { data: plan, isFetched: planLoaded } = usePlanFor(target);

  useEffect(() => {
    if (!habits || !planLoaded) return;
    const reminders = habits
      .filter((h) => h.remind_at)
      .map((h) => ({
        key: `habit:${h.id}`,
        at: h.remind_at!,
        title: `该打卡了:${h.name}`,
        body: h.streak > 0 ? `已经连续 ${h.streak} 天,别让它断掉。` : "今天也来一次吧。",
        skipOn: h.checked ? day : null,
      }));
    if (prefs.planReminder) {
      reminders.push({
        key: "plan",
        at: prefs.planReminderAt,
        title: "睡前花两分钟,规划一下明天",
        body: "回顾今天,挑出明天最重要的 1–3 件事。",
        skipOn: plan ? day : null,
      });
    }
    void invoke("set_reminders", { reminders });
    if (reminders.length > 0) {
      void isPermissionGranted().then((ok) => (ok ? undefined : requestPermission()));
    }
  }, [habits, plan, planLoaded, prefs.planReminder, prefs.planReminderAt, day]);

  useEffect(() => () => void invoke("set_reminders", { reminders: [] }), []);
}

/** What the Today page should nudge about right now. */
export function useDueReminders(): { habits: Habit[]; planDue: boolean } {
  const now = useMinute();
  const prefs = usePrefs();
  const { data: habits = [] } = useTodayHabits();
  const { data: plan, isFetched } = usePlanFor(planTargetDay(now));
  const t = hhmm(now);
  return {
    habits: habits.filter((h) => h.remind_at && !h.checked && h.remind_at <= t),
    planDue: prefs.planReminder && isFetched && !plan && (t >= prefs.planReminderAt || now.getHours() < 4),
  };
}
