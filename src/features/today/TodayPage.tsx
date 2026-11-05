import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { occursOn, useCalendarEvents } from "../../data/calendar";
import { CalendarGate, EventRow } from "../../components/Calendar";
import { addDays, formatMinutes, formatMoney, shortDate, today } from "../../data/db";
import { addTask, deleteTask, listTasks, setTaskDone, type Task } from "../../data/tasks";
import { addHabit, setHabitChecked } from "../../data/habits";
import { listCategories, listTransactions, listTransactionsOn } from "../../data/finance";
import { latestHealthLog, listHealthLogs } from "../../data/health";
import { ProjectsOverview } from "../projects/ProjectsView";
import { HomeHero } from "./HomeHero";
import { TodayNudges } from "./TodayNudges";
import { useTodayHabits } from "../../data/reminders";
import { useNav, type TasksView } from "../../data/nav";
import { usePrefs } from "../../data/prefs";
import { AnimatePresence, motion } from "motion/react";
import { enterIf, springs, useIsNew } from "../../components/motion";
import { TASK_KEYS, useInvalidating } from "../../data/useInvalidating";
import { AddInput, Card } from "../../components/Card";
import type { PageId } from "../../components/Sidebar";
import { JournalEditor } from "../notes/NotesPage";

type Navigate = (page: PageId, tasksView?: TasksView) => void;

function CardLink({ to, view, onNavigate, children }: { to: PageId; view?: TasksView; onNavigate: Navigate; children: string }) {
  return (
    <button className="text-[13px] text-accent hover:text-accent-ink" onClick={() => onNavigate(to, view)}>
      {children}
    </button>
  );
}

function HomeIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/** Open tasks due today or earlier (or undated, outside a project), plus ones finished today. */
function isForToday(t: Task, day: string) {
  if (t.done_at) return t.done_at.slice(0, 10) === day;
  return t.due_date ? t.due_date <= day : t.project_id === null;
}

function Tasks({ onNavigate }: { onNavigate: Navigate }) {
  const day = today();
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const tasks = all.filter((t) => isForToday(t, day));
  const add = useInvalidating(TASK_KEYS, (title: string) => addTask(title, day));
  const toggle = useInvalidating(TASK_KEYS, (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const remove = useInvalidating(TASK_KEYS, deleteTask);
  const isNew = useIsNew(tasks.map((t) => t.id));

  return (
    <Card
      lift reveal code="01 / TODO" icon={<HomeIcon><><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 12l3 3 5-6" /></></HomeIcon>}
      onOpen={() => onNavigate("tasks", "list")}
      title="今日待办"
      className="flex-[2_1_420px]"
      aside={
        <>
          <button className="text-[13px] text-accent hover:text-accent-ink" onClick={() => useNav.setState({ planOpen: true })}>
            规划明天
          </button>
          <span className="text-line-strong">·</span>
          <CardLink to="tasks" view="list" onNavigate={onNavigate}>全部任务</CardLink>
        </>
      }
    >
      <ul>
        <AnimatePresence initial={false}>
        {tasks.map((t) => {
          const overdue = !t.done_at && !!t.due_date && t.due_date < day;
          return (
            <motion.li
              key={t.id}
              layout="position"
              initial={enterIf(isNew(t.id))}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.16 } }}
              transition={springs.smooth}
              className="group flex min-h-11 items-center gap-3 border-b border-divider"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-[18px] accent-accent"
                  checked={!!t.done_at}
                  onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                />
                <span className={`text-sm transition-colors ${t.done_at ? "text-faint line-through" : ""}`}>{t.title}</span>
                {t.project_title && <span className="text-xs text-muted">· {t.project_title}</span>}
              </label>
              {overdue && <span className="text-xs text-warn">已逾期</span>}
              <button
                className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => remove.mutate(t.id)}
              >
                删除
              </button>
            </motion.li>
          );
        })}
        </AnimatePresence>
        {tasks.length === 0 && <li className="py-3 text-sm text-muted">还没有待办,在下面添加第一件事</li>}
      </ul>
      <AddInput placeholder="添加待办,回车确认" onAdd={(v) => add.mutate(v)} />
    </Card>
  );
}

function Habits() {
  const day = today();
  const navigate = useNav((s) => s.navigate);
  const { data: habits = [] } = useTodayHabits();
  const add = useInvalidating("habits", addHabit);
  const toggle = useInvalidating("habits", (h: { id: number; checked: boolean }) =>
    setHabitChecked(h.id, day, h.checked),
  );
  const done = habits.filter((h) => h.checked).length;

  return (
    <Card
      lift reveal code="04 / HABITS" icon={<HomeIcon><path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.7-2.6 1.5-3.5C10 9 11 7 12 3z" /></HomeIcon>}
      onOpen={() => navigate("tasks", "list")}
      title="习惯"
      className="flex-[1_1_300px]"
      aside={habits.length > 0 && <span className="text-[13px] text-muted">今日 {done}/{habits.length}</span>}
    >
      <ul className="flex flex-col gap-2.5">
        {habits.map((h) => (
          <li key={h.id} className="flex items-center gap-3">
            <motion.button
              aria-pressed={h.checked}
              aria-label={`打卡:${h.name}`}
              onClick={() => toggle.mutate({ id: h.id, checked: !h.checked })}
              whileTap={{ scale: 0.88 }}
              animate={{ scale: h.checked ? [1, 1.12, 1] : 1 }}
              transition={springs.snappy}
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 ${
                h.checked ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-faint"
              }`}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {/* The check draws itself when ticked. */}
                <motion.path
                  key={String(h.checked)}
                  d="M5 12l5 5 9-10"
                  initial={{ pathLength: h.checked ? 0 : 1 }}
                  animate={{ pathLength: 1 }}
                  transition={{ ...springs.smooth, delay: 0.05 }}
                />
              </svg>
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{h.name}</div>
              <div className="text-xs text-muted">
                连续 {h.streak} 天{h.remind_at && <span className="tabular-nums"> · ⏰ {h.remind_at}</span>}
              </div>
            </div>
            <div aria-hidden="true" className="flex gap-[3px]">
              {h.history.map((on, i) => (
                <span key={i} className={`h-5 w-2 rounded-[3px] ${on ? "bg-accent" : "bg-cell"}`} />
              ))}
            </div>
          </li>
        ))}
        {habits.length === 0 && <li className="text-sm text-muted">还没有习惯</li>}
      </ul>
      <AddInput placeholder="添加习惯,回车确认" onAdd={(v) => add.mutate(v)} />
    </Card>
  );
}

function TodayEvents() {
  const day = today();
  const { data: events = [], isFetched } = useCalendarEvents(day, day);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todays = events.filter((e) => occursOn(e, day));
  const allDay = todays.filter((e) => e.allDay);
  const timed = todays.filter((e) => !e.allDay);
  // The "now" line goes before the first event that hasn't started yet.
  const nowIndex = timed.findIndex((e) => e.startMs > now);

  if (!isFetched) return null;
  if (todays.length === 0) return <p className="text-[13px] text-muted">今天日历上没有事件</p>;
  return (
    <ul className="flex flex-col gap-2">
      {allDay.map((e) => (
        <li key={e.id}>
          <EventRow event={e} day={day} />
        </li>
      ))}
      {timed.map((e, i) => (
        <Fragment key={e.id}>
          {i === nowIndex && <NowLine />}
          <li className={e.endMs < now ? "opacity-60" : ""}>
            <EventRow event={e} day={day} />
          </li>
        </Fragment>
      ))}
      {nowIndex === -1 && timed.length > 0 && <NowLine />}
    </ul>
  );
}

function NowLine() {
  return (
    <li aria-label="现在" className="flex items-center gap-2.5">
      <span className="w-12 text-xs font-semibold text-warn">现在</span>
      <span className="h-0.5 flex-1 bg-[#c2410c]" />
    </li>
  );
}

function Schedule() {
  const day = today();
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const end = addDays(day, 7);
  const upcoming = all.filter((t) => !t.done_at && t.due_date && t.due_date > day && t.due_date <= end);
  return (
    <Card lift reveal code="02 / SCHEDULE" icon={<HomeIcon><><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></></HomeIcon>} onOpen={() => useNav.setState({ page: "calendar", calendarView: "day" })} title="日程" className="flex-[1_1_280px]">
      <CalendarGate>
        <TodayEvents />
      </CalendarGate>
      {upcoming.length > 0 && (
        <>
          <h3 className="mt-2 text-xs font-semibold text-muted">未来 7 天到期</h3>
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((t) => (
              <li key={t.id} className="flex gap-2.5 text-[13px]">
                <span className="w-12 shrink-0 text-muted tabular-nums">
                  {t.due_date === addDays(day, 1) ? "明天" : shortDate(t.due_date!)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{t.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Spending({ onNavigate }: { onNavigate: Navigate }) {
  const day = today();
  const month = day.slice(0, 7);
  const { data: todays = [] } = useQuery({ queryKey: ["finance", "day", day], queryFn: () => listTransactionsOn(day) });
  const { data: monthTx = [] } = useQuery({ queryKey: ["finance", "tx", month], queryFn: () => listTransactions(month) });
  const { data: categories = [] } = useQuery({ queryKey: ["finance", "categories"], queryFn: listCategories });
  const expenses = todays.filter((t) => t.amount_cents < 0);
  const spentToday = expenses.reduce((s, t) => s - t.amount_cents, 0);
  const spentMonth = monthTx.filter((t) => t.amount_cents < 0).reduce((s, t) => s - t.amount_cents, 0);
  const budget = categories.reduce((s, c) => s + (c.budget_cents ?? 0), 0);
  const pct = budget ? Math.round((spentMonth / budget) * 100) : null;

  return (
    <Card lift reveal code="05 / EXPENSE" icon={<HomeIcon><><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /></></HomeIcon>} onOpen={() => onNavigate("finance")} title="今日支出" className="flex-[1_1_260px]" aside={<CardLink to="finance" onNavigate={onNavigate}>账本</CardLink>}>
      <div className="text-[32px] font-bold tracking-tight tabular-nums">{formatMoney(spentToday)}</div>
      {pct !== null && (
        <div>
          <div className="mb-1.5 flex text-xs text-muted tabular-nums">
            <span className="flex-1">
              本月已用 {formatMoney(spentMonth)} / 预算 {formatMoney(budget)}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded bg-sidebar">
            <motion.div
              className={`h-2 rounded ${pct >= 80 ? "bg-[#c2410c]" : "bg-accent"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(pct, 100)}%` }}
              transition={springs.gentle}
            />
          </div>
        </div>
      )}
      {expenses.length === 0 ? (
        <p className="text-[13px] text-muted">今天还没有支出</p>
      ) : (
        <ul className="flex flex-col gap-2 text-[13px] tabular-nums">
          {expenses.slice(0, 4).map((t) => (
            <li key={t.id} className="flex">
              <span className="flex-1">
                {t.note ?? t.category ?? "支出"} {t.note && t.category && <span className="text-muted">· {t.category}</span>}
              </span>
              <span>{formatMoney(t.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Body({ onNavigate }: { onNavigate: Navigate }) {
  const day = today();
  const { data: logs = [] } = useQuery({ queryKey: ["health", day], queryFn: () => listHealthLogs(day) });
  const { data: weight } = useQuery({ queryKey: ["health", "latest-weight"], queryFn: () => latestHealthLog("weight") });
  const sleep = logs.find((l) => l.kind === "sleep");
  const steps = logs.find((l) => l.kind === "steps");
  const workout = logs.filter((l) => l.kind === "workout").reduce((s, l) => s + l.value, 0);

  return (
    <Card lift reveal code="06 / BODY" icon={<HomeIcon><path d="M3 12h4l2-4 3 8 2-4h7" /></HomeIcon>} onOpen={() => onNavigate("health")} title="身体" className="flex-[1_1_260px]" aside={<CardLink to="health" onNavigate={onNavigate}>健康</CardLink>}>
      <div>
        <div className="text-xs text-muted">昨晚睡眠</div>
        <div className="text-[32px] font-bold tracking-tight">{sleep ? formatMinutes(sleep.value) : "—"}</div>
      </div>
      <div className="flex gap-3">
        {[
          ["步数", steps ? steps.value.toLocaleString("en-US") : "—"],
          ["运动", workout ? `${workout} 分钟` : "—"],
          ["体重", weight ? `${weight.value} kg` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 flex-1 rounded-[10px] bg-ground p-3">
            <div className="text-xs text-muted">{k}</div>
            <div className="truncate text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TodayPage({ onNavigate }: { onNavigate: Navigate }) {
  const day = today();
  const prefs = usePrefs();
  const show = (m: (typeof prefs.homeHidden)[number]) => !prefs.homeHidden.includes(m);
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const remaining = all.filter((t) => !t.done_at && isForToday(t, day)).length;

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <HomeHero greeting={`${greeting()}${prefs.name ? `,${prefs.name}` : ""}`} remaining={remaining} />
      <TodayNudges />

      <div className="flex flex-wrap gap-5">
        <Tasks onNavigate={onNavigate} />
        {show("schedule") && <Schedule />}
      </div>

      {show("projects") && (
        <Card lift reveal code="03 / PROJECTS" icon={<HomeIcon><><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M8 14h8" /></></HomeIcon>} onOpen={() => onNavigate("projects")} title="项目" aside={<CardLink to="projects" onNavigate={onNavigate}>全部项目</CardLink>}>
          <ProjectsOverview />
        </Card>
      )}

      {(show("habits") || show("spending") || show("body")) && (
        <div className="flex flex-wrap gap-5">
          {show("habits") && <Habits />}
          {show("spending") && <Spending onNavigate={onNavigate} />}
          {show("body") && <Body onNavigate={onNavigate} />}
        </div>
      )}

      {show("journal") && <Card lift reveal code="07 / JOURNAL" icon={<HomeIcon><><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" /><path d="M6 3v18M10 8h5M10 12h5" /></></HomeIcon>} onOpen={() => onNavigate("notes")} title="日记" aside={<CardLink to="notes" onNavigate={onNavigate}>打开完整日记</CardLink>}>
        <JournalEditor day={day} compact />
      </Card>}
    </div>
  );
}
