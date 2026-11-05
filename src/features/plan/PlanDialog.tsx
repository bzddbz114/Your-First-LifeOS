import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { addDays, shortDate, today } from "../../data/db";
import { addTask, deleteTask, listTasks, setTaskDone, setTaskDue, type Task } from "../../data/tasks";
import { listProjects } from "../../data/projects";
import { getPlan, savePlan } from "../../data/plans";
import { planTargetDay } from "../../data/reminders";
import { formatTime, occursOn, useCalendarEvents } from "../../data/calendar";
import { useNav } from "../../data/nav";
import { TASK_KEYS, useInvalidating } from "../../data/useInvalidating";
import { fieldClass, ghostButtonClass, primaryButtonClass } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { springs } from "../../components/motion";

const STEPS = ["回顾今天", "安排明天", "最重要的事"] as const;
const MAX_FOCUS = 3;

const rowMotion = {
  layout: "position" as const,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18 } },
  transition: springs.smooth,
};

const smallBtn = "min-h-8 rounded-lg border border-line-strong px-2.5 text-xs text-ink-2 hover:border-accent hover:text-accent";

/** Step 1: every task left open from today (or earlier) gets a decision. */
function ReviewStep({ target, tasks }: { target: string; tasks: Task[] }) {
  const day = today();
  const open = tasks.filter((t) => !t.done_at && t.due_date !== null && t.due_date <= day && t.due_date < target);
  const undated = tasks.filter((t) => !t.done_at && !t.due_date && t.project_id === null);
  const doneToday = tasks.filter((t) => t.done_at?.slice(0, 10) === day).length;
  const done = useInvalidating(TASK_KEYS, (id: number) => setTaskDone(id, true));
  const move = useInvalidating(TASK_KEYS, (id: number) => setTaskDue(id, target));
  const remove = useInvalidating(TASK_KEYS, deleteTask);
  const moveAll = useInvalidating(TASK_KEYS, async () => {
    for (const t of open) await setTaskDue(t.id, target);
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">
        {doneToday > 0 ? `今天完成了 ${doneToday} 件事,辛苦了。` : "今天还没有划掉任何事,没关系。"}
        {open.length > 0 ? `还有 ${open.length} 件没做完,逐个决定一下它们的去处:` : "没有遗留的任务,干净利落。"}
      </p>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {open.map((t) => (
            <motion.li key={t.id} {...rowMotion} className="flex min-h-11 items-center gap-2 border-b border-divider">
              <span className="min-w-0 flex-1 truncate text-sm">
                {t.title}
                {t.due_date && t.due_date < day && <span className="ml-2 text-xs text-warn">逾期 {shortDate(t.due_date)}</span>}
              </span>
              <button className={smallBtn} onClick={() => done.mutate(t.id)}>
                其实做完了
              </button>
              <button className={`${smallBtn} border-accent/40 text-accent`} onClick={() => move.mutate(t.id)}>
                移到明天
              </button>
              <button className={smallBtn} onClick={() => remove.mutate(t.id)}>
                不做了
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {open.length > 1 && (
        <button className={`${ghostButtonClass} self-start`} onClick={() => moveAll.mutate(undefined)}>
          全部移到明天
        </button>
      )}
      {undated.length > 0 && <p className="text-xs text-muted">另有 {undated.length} 件没有日期的任务,下一步可以挑几件放进明天。</p>}
    </div>
  );
}

/** Step 2: what tomorrow already holds, plus quick ways to add to it. */
function ArrangeStep({ target, tasks }: { target: string; tasks: Task[] }) {
  const [title, setTitle] = useState("");
  const { data: events = [] } = useCalendarEvents(target, target);
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const planned = tasks.filter((t) => t.due_date === target);
  const undated = tasks.filter((t) => !t.done_at && !t.due_date);
  const nextSteps = projects.filter((p) => !p.done_at && p.next_step_id !== null && !planned.some((t) => t.id === p.next_step_id));
  const add = useInvalidating(TASK_KEYS, () => addTask(title.trim(), target));
  const schedule = useInvalidating(TASK_KEYS, (id: number) => setTaskDue(id, target));
  const unschedule = useInvalidating(TASK_KEYS, (id: number) => setTaskDue(id, null));
  const dayEvents = events.filter((e) => occursOn(e, target));

  return (
    <div className="flex flex-col gap-4">
      {dayEvents.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">明天的日程</h3>
          <ul className="flex flex-col gap-1">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex gap-2.5 text-[13px]">
                <span className="w-12 shrink-0 text-muted tabular-nums">{e.allDay ? "全天" : formatTime(e.startMs)}</span>
                <span className="size-2 shrink-0 translate-y-1.5 rounded-full" style={{ background: e.color ?? "var(--color-accent)" }} />
                <span className="min-w-0 truncate text-ink-2">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted">明天要做 · {planned.length}</h3>
        <ul>
          <AnimatePresence initial={false}>
            {planned.map((t) => (
              <motion.li key={t.id} {...rowMotion} className="group flex min-h-10 items-center gap-2 border-b border-divider">
                <span className={`min-w-0 flex-1 truncate text-sm ${t.done_at ? "text-faint line-through" : ""}`}>{t.title}</span>
                {t.project_title && <span className="text-xs text-muted">· {t.project_title}</span>}
                <button className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => unschedule.mutate(t.id)}>
                  移出
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {planned.length === 0 && <li className="py-2 text-[13px] text-muted">明天还空着。</li>}
        </ul>
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate(undefined, { onSuccess: () => setTitle("") });
          }}
        >
          <input autoFocus placeholder="给明天加一件事,回车确认" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </form>
      </section>

      {(nextSteps.length > 0 || undated.length > 0) && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">可以放进明天的</h3>
          <ul className="flex flex-col gap-1">
            {nextSteps.map((p) => (
              <li key={`p${p.id}`} className="flex min-h-9 items-center gap-2 text-[13px]">
                <span className="rounded bg-accent-soft px-1.5 text-[11px] text-accent-ink">{p.title}</span>
                <span className="min-w-0 flex-1 truncate">{p.next_step}</span>
                <button className={smallBtn} onClick={() => schedule.mutate(p.next_step_id!)}>
                  放进明天
                </button>
              </li>
            ))}
            {undated
              .filter((t) => !nextSteps.some((p) => p.next_step_id === t.id))
              .slice(0, 6)
              .map((t) => (
                <li key={t.id} className="flex min-h-9 items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <button className={smallBtn} onClick={() => schedule.mutate(t.id)}>
                    放进明天
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Step 3: pick the day's priorities and an optional intention. */
function FocusStep({
  target,
  tasks,
  focus,
  setFocus,
  intention,
  setIntention,
}: {
  target: string;
  tasks: Task[];
  focus: number[];
  setFocus: (ids: number[]) => void;
  intention: string;
  setIntention: (v: string) => void;
}) {
  const planned = tasks.filter((t) => t.due_date === target && !t.done_at);
  const toggle = (id: number) =>
    setFocus(focus.includes(id) ? focus.filter((x) => x !== id) : focus.length < MAX_FOCUS ? [...focus, id] : focus);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-2">如果明天只能做完 {MAX_FOCUS} 件事,会是哪几件?它们会出现在明天主页的最上面。</p>
      {planned.length === 0 ? (
        <p className="rounded-lg bg-ground px-3 py-3 text-[13px] text-muted">明天还没有任务,回上一步加几件吧。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {planned.map((t) => {
            const rank = focus.indexOf(t.id);
            const on = rank >= 0;
            return (
              <li key={t.id}>
                <button
                  onClick={() => toggle(t.id)}
                  disabled={!on && focus.length >= MAX_FOCUS}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm disabled:opacity-40 ${
                    on ? "border-accent bg-accent-soft" : "border-line-strong hover:border-faint"
                  }`}
                >
                  <motion.span
                    animate={{ scale: on ? 1 : 0.85 }}
                    transition={springs.snappy}
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      on ? "bg-accent text-white" : "border border-line-strong text-faint"
                    }`}
                  >
                    {on ? rank + 1 : ""}
                  </motion.span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        明天的一句话(可选)
        <input
          placeholder="例如:先做最难的那件 / 早点睡 / 对自己温柔一点"
          maxLength={40}
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

function DoneScreen({ onClose, count }: { onClose: () => void; count: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <motion.svg width="64" height="64" viewBox="0 0 64 64" fill="none" initial="hidden" animate="shown">
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          stroke="var(--color-accent)"
          strokeWidth="3"
          variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1, transition: { duration: 0.5 } } }}
        />
        <motion.path
          d="M20 33l8 8 16-17"
          stroke="var(--color-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1, transition: { duration: 0.35, delay: 0.45 } } }}
        />
      </motion.svg>
      <div>
        <h2 className="font-serif text-2xl font-semibold">明天已经安排好了</h2>
        <p className="mt-1.5 text-[13px] text-muted">{count > 0 ? `${count} 件最重要的事会在明早等你。` : "明早主页见。"}现在可以安心睡觉了,晚安。</p>
      </div>
      <button className={primaryButtonClass} onClick={onClose}>
        晚安 🌙
      </button>
    </div>
  );
}

export function PlanDialog() {
  const open = useNav((s) => s.planOpen);
  const close = () => useNav.setState({ planOpen: false });
  const target = planTargetDay();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [focus, setFocus] = useState<number[]>([]);
  const [intention, setIntention] = useState("");
  const [finished, setFinished] = useState(false);
  const save = useInvalidating("plan", (focusIds: number[]) => savePlan({ day: target, intention, focusIds }));

  // Reopening resumes an existing plan for the same day.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFinished(false);
    void getPlan(target).then((p) => {
      setFocus(p?.focusIds ?? []);
      setIntention(p?.intention ?? "");
    });
  }, [open, target]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const weekday = new Date(`${target}T00:00:00`).toLocaleDateString("zh-CN", { weekday: "long" });

  return (
    <Modal open={open} onClose={close} label="规划明天" width={580}>
      {finished ? (
        <DoneScreen onClose={close} count={focus.length} />
      ) : (
        <div className="flex flex-col gap-5">
          <header>
            <p className="text-xs text-muted">
              规划 {shortDate(target)} {weekday}
              {target === today() ? "(今天)" : target === addDays(today(), 1) ? "(明天)" : ""}
            </p>
            <h2 className="mt-0.5 font-serif text-2xl font-semibold">睡前两分钟,安排好明天</h2>
            <ol className="mt-4 flex gap-2">
              {STEPS.map((s, i) => (
                <li key={s} className="flex-1">
                  <button onClick={() => go(i)} className="w-full text-left">
                    <div className="h-1 overflow-hidden rounded bg-sidebar">
                      <motion.div className="h-1 bg-accent" animate={{ width: i <= step ? "100%" : "0%" }} transition={springs.smooth} />
                    </div>
                    <span className={`mt-1.5 block text-xs ${i === step ? "font-semibold text-ink" : "text-muted"}`}>
                      {i + 1}. {s}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </header>

          <div className="relative min-h-[260px] overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: 40 * d }),
                  center: { opacity: 1, x: 0 },
                  leave: (d: number) => ({ opacity: 0, x: -40 * d, transition: { duration: 0.14 } }),
                }}
                initial="enter"
                animate="center"
                exit="leave"
                transition={springs.smooth}
              >
                {step === 0 && <ReviewStep target={target} tasks={tasks} />}
                {step === 1 && <ArrangeStep target={target} tasks={tasks} />}
                {step === 2 && (
                  <FocusStep
                    target={target}
                    tasks={tasks}
                    focus={focus.filter((id) => tasks.some((t) => t.id === id && t.due_date === target))}
                    setFocus={setFocus}
                    intention={intention}
                    setIntention={setIntention}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="flex items-center gap-2">
            {step > 0 && (
              <button className={`${ghostButtonClass} min-h-11 px-4`} onClick={() => go(step - 1)}>
                上一步
              </button>
            )}
            <span className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button className={primaryButtonClass} onClick={() => go(step + 1)}>
                下一步
              </button>
            ) : (
              <button
                className={primaryButtonClass}
                disabled={save.isPending}
                onClick={() => {
                  // Keep only priorities that are still tomorrow's tasks.
                  const kept = focus.filter((id) => tasks.some((t) => t.id === id && t.due_date === target));
                  setFocus(kept);
                  save.mutate(kept, { onSuccess: () => setFinished(true) });
                }}
              >
                完成规划
              </button>
            )}
          </footer>
        </div>
      )}
    </Modal>
  );
}
