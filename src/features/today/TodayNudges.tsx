import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { today } from "../../data/db";
import { listTasks, setTaskDone } from "../../data/tasks";
import { setHabitChecked } from "../../data/habits";
import { useDueReminders, usePlanFor } from "../../data/reminders";
import { useNav } from "../../data/nav";
import { TASK_KEYS, useInvalidating } from "../../data/useInvalidating";
import { primaryButtonClass } from "../../components/Card";
import { springs } from "../../components/motion";

const strip = "panel flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-3.5";
const appear = {
  layout: true,
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.18 } },
  transition: springs.smooth,
};

/** Last night's plan for today: the chosen priorities and the intention line. */
function TodayFocus() {
  const day = today();
  const { data: plan } = usePlanFor(day);
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const toggle = useInvalidating(TASK_KEYS, (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const focus = (plan?.focusIds ?? []).map((id) => tasks.find((t) => t.id === id)).filter((t) => t !== undefined);
  if (!plan || (focus.length === 0 && !plan.intention)) return null;
  const doneCount = focus.filter((t) => t.done_at).length;

  return (
    <motion.section {...appear} className={`${strip} items-start`}>
      <div className="w-full">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold">今日重点</h2>
          {focus.length > 0 && (
            <span className="text-xs text-muted tabular-nums">
              {doneCount}/{focus.length}
            </span>
          )}
          {plan.intention && <span className="ml-auto truncate font-serif text-[15px] italic text-ink-2">「{plan.intention}」</span>}
        </div>
        {focus.length > 0 && (
          <ol className="mt-2 flex flex-col gap-1">
            {focus.map((t, i) => (
              <li key={t.id}>
                <label className="flex min-h-9 cursor-pointer items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>
                  <input
                    type="checkbox"
                    className="size-[18px] shrink-0 accent-accent"
                    checked={!!t.done_at}
                    onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                  />
                  <span className={`text-sm transition-colors ${t.done_at ? "text-faint line-through" : "font-medium"}`}>{t.title}</span>
                </label>
              </li>
            ))}
          </ol>
        )}
      </div>
    </motion.section>
  );
}

/** Reminders that are due right now: the evening plan and unchecked habits past their time. */
export function TodayNudges() {
  const day = today();
  const { habits, planDue } = useDueReminders();
  const check = useInvalidating("habits", (id: number) => setHabitChecked(id, day, true));

  return (
    <div className="flex flex-col gap-3 empty:hidden">
      <AnimatePresence initial={false}>
        {planDue && (
          <motion.section key="plan" {...appear} className={`${strip} border-accent/30 bg-accent-soft`}>
            <motion.span
              aria-hidden="true"
              className="text-2xl"
              animate={{ rotate: [0, -12, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
            >
              🌙
            </motion.span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-accent-ink">该为明天做计划了</div>
              <div className="text-xs text-muted">回顾今天、安排明天、挑出最重要的 1–3 件事,只要两分钟。</div>
            </div>
            <button className={primaryButtonClass} onClick={() => useNav.setState({ planOpen: true })}>
              开始规划
            </button>
          </motion.section>
        )}
        {habits.length > 0 && (
          <motion.section key="habits" {...appear} className={strip}>
            <span aria-hidden="true" className="text-lg">⏰</span>
            <span className="text-sm font-semibold">该打卡了</span>
            <ul className="flex flex-1 flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {habits.map((h) => (
                  <motion.li key={h.id} {...appear}>
                    <button
                      onClick={() => check.mutate(h.id)}
                      className="flex min-h-9 items-center gap-2 rounded-full border border-line-strong bg-field px-3 text-[13px] hover:border-accent hover:text-accent"
                    >
                      <span className="text-xs text-muted tabular-nums">{h.remind_at}</span>
                      {h.name}
                      <span className="text-accent">打卡 ✓</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
      <TodayFocus />
    </div>
  );
}
