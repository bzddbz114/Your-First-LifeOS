import { useQuery } from "@tanstack/react-query";
import { addDays, formatMinutes, formatMoney, shortDate, today } from "../../data/db";
import { addTask, deleteTask, listTasks, setTaskDone, type Task } from "../../data/tasks";
import { addHabit, listHabits, setHabitChecked } from "../../data/habits";
import { listCategories, listTransactions, listTransactionsOn } from "../../data/finance";
import { latestHealthLog, listHealthLogs } from "../../data/health";
import { useInvalidating } from "../../data/useInvalidating";
import { AddInput, Card, EmptyState } from "../../components/Card";
import type { PageId } from "../../components/Sidebar";
import { JournalEditor } from "../notes/NotesPage";

type Navigate = (page: PageId) => void;

function CardLink({ to, onNavigate, children }: { to: PageId; onNavigate: Navigate; children: string }) {
  return (
    <button className="text-[13px] text-accent hover:text-accent-ink" onClick={() => onNavigate(to)}>
      {children}
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/** Open tasks due today or earlier (or undated), plus ones finished today. */
function isForToday(t: Task, day: string) {
  if (t.done_at) return t.done_at.slice(0, 10) === day;
  return !t.due_date || t.due_date <= day;
}

function Tasks({ onNavigate }: { onNavigate: Navigate }) {
  const day = today();
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const tasks = all.filter((t) => isForToday(t, day));
  const add = useInvalidating("tasks", (title: string) => addTask(title, day));
  const toggle = useInvalidating("tasks", (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const remove = useInvalidating("tasks", deleteTask);

  return (
    <Card
      title="今日待办"
      className="flex-[2_1_420px]"
      aside={<CardLink to="tasks" onNavigate={onNavigate}>全部任务</CardLink>}
    >
      <ul>
        {tasks.map((t) => {
          const overdue = !t.done_at && !!t.due_date && t.due_date < day;
          return (
            <li key={t.id} className="group flex min-h-11 items-center gap-3 border-b border-divider">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-[18px] accent-accent"
                  checked={!!t.done_at}
                  onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                />
                <span className={`text-sm ${t.done_at ? "text-faint line-through" : ""}`}>{t.title}</span>
              </label>
              {overdue && <span className="text-xs text-warn">已逾期</span>}
              <button
                className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => remove.mutate(t.id)}
              >
                删除
              </button>
            </li>
          );
        })}
        {tasks.length === 0 && <li className="py-3 text-sm text-muted">还没有待办,在下面添加第一件事</li>}
      </ul>
      <AddInput placeholder="添加待办,回车确认" onAdd={(v) => add.mutate(v)} />
    </Card>
  );
}

function Habits() {
  const day = today();
  const { data: habits = [] } = useQuery({ queryKey: ["habits"], queryFn: () => listHabits(day) });
  const add = useInvalidating("habits", addHabit);
  const toggle = useInvalidating("habits", (h: { id: number; checked: boolean }) =>
    setHabitChecked(h.id, day, h.checked),
  );
  const done = habits.filter((h) => h.checked).length;

  return (
    <Card
      title="习惯"
      className="flex-[1_1_300px]"
      aside={habits.length > 0 && <span className="text-[13px] text-muted">今日 {done}/{habits.length}</span>}
    >
      <ul className="flex flex-col gap-2.5">
        {habits.map((h) => (
          <li key={h.id} className="flex items-center gap-3">
            <button
              aria-pressed={h.checked}
              aria-label={`打卡:${h.name}`}
              onClick={() => toggle.mutate({ id: h.id, checked: !h.checked })}
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                h.checked ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-faint"
              }`}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{h.name}</div>
              <div className="text-xs text-muted">连续 {h.streak} 天</div>
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

function Upcoming() {
  const day = today();
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const end = addDays(day, 7);
  const tasks = all.filter((t) => !t.done_at && t.due_date && t.due_date > day && t.due_date <= end);
  return (
    <Card title="接下来 7 天" className="flex-[1_1_280px]">
      {tasks.length === 0 ? (
        <EmptyState>未来一周没有安排</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex gap-3">
              <span className="w-14 shrink-0 text-[13px] text-muted tabular-nums">
                {t.due_date === addDays(day, 1) ? "明天" : shortDate(t.due_date!)}
              </span>
              <span className="flex-1 rounded-lg bg-ground px-3 py-2 text-[13px] text-ink-2">{t.title}</span>
            </li>
          ))}
        </ul>
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
    <Card title="今日支出" className="flex-[1_1_260px]" aside={<CardLink to="finance" onNavigate={onNavigate}>账本</CardLink>}>
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
            <div className={`h-2 rounded ${pct >= 80 ? "bg-[#c2410c]" : "bg-accent"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
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
    <Card title="身体" className="flex-[1_1_260px]" aside={<CardLink to="health" onNavigate={onNavigate}>健康</CardLink>}>
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
  const { data: all = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const remaining = all.filter((t) => !t.done_at && isForToday(t, day)).length;
  const label = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <header>
        <p className="mb-1 text-[13px] text-muted">{label}</p>
        <h1 className="text-[30px] font-bold tracking-tight">
          {greeting()},{remaining > 0 ? `今天还剩 ${remaining} 件事` : "今天的事都做完了"}
        </h1>
      </header>

      <div className="flex flex-wrap gap-5">
        <Tasks onNavigate={onNavigate} />
        <Upcoming />
      </div>

      <div className="flex flex-wrap gap-5">
        <Habits />
        <Spending onNavigate={onNavigate} />
        <Body onNavigate={onNavigate} />
      </div>

      <Card title="日记" aside={<CardLink to="notes" onNavigate={onNavigate}>打开完整日记</CardLink>}>
        <JournalEditor day={day} compact />
      </Card>
    </div>
  );
}
