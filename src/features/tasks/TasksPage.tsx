import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, shortDate, today } from "../../data/db";
import { addTask, deleteTask, listTasks, setTaskDone, setTaskDue, type Task } from "../../data/tasks";
import { addHabit, archiveHabit, listHabits, setHabitChecked } from "../../data/habits";
import { useInvalidating } from "../../data/useInvalidating";
import { occursOn, useCalendarAccess, useCalendarEvents } from "../../data/calendar";
import { CalendarGate, EventRow } from "../../components/Calendar";
import { AddInput, Card, PageHeader, Segmented, fieldClass, ghostButtonClass, primaryButtonClass } from "../../components/Card";

const HEATMAP_WEEKS = 12;

function groupTasks(tasks: Task[], day: string) {
  const tomorrow = addDays(day, 1);
  const weekEnd = addDays(day, 7);
  const groups: { title: string; tone: string; items: Task[] }[] = [
    { title: "逾期", tone: "text-warn", items: [] },
    { title: "今天", tone: "text-ink", items: [] },
    { title: "明天", tone: "text-ink", items: [] },
    { title: "未来 7 天", tone: "text-ink", items: [] },
    { title: "以后", tone: "text-ink", items: [] },
    { title: "无日期", tone: "text-ink", items: [] },
    { title: "已完成", tone: "text-muted", items: [] },
  ];
  for (const t of tasks) {
    const d = t.due_date;
    const i = t.done_at ? 6 : !d ? 5 : d < day ? 0 : d === day ? 1 : d === tomorrow ? 2 : d <= weekEnd ? 3 : 4;
    groups[i].items.push(t);
  }
  groups[6].items = groups[6].items.slice(0, 10);
  return groups.filter((g) => g.items.length > 0);
}

function dueLabel(due: string | null, day: string) {
  if (!due) return "";
  if (due === day) return "今天";
  if (due === addDays(day, 1)) return "明天";
  return shortDate(due);
}

function NewTaskForm() {
  const day = today();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(day);
  const add = useInvalidating("tasks", () => addTask(title.trim(), due || null));
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        add.mutate(undefined, { onSuccess: () => setTitle("") });
      }}
    >
      <input
        aria-label="任务标题"
        placeholder="新任务……"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${fieldClass} flex-[1_1_280px]`}
      />
      <input
        type="date"
        aria-label="截止日期"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className={`${fieldClass} w-auto`}
      />
      <button type="submit" className={primaryButtonClass}>
        添加
      </button>
    </form>
  );
}

function TaskList() {
  const day = today();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const toggle = useInvalidating("tasks", (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const setDue = useInvalidating("tasks", (t: { id: number; due: string | null }) => setTaskDue(t.id, t.due));
  const remove = useInvalidating("tasks", deleteTask);
  const groups = groupTasks(tasks, day);

  return (
    <section aria-label="任务列表" className="flex min-w-0 flex-[3_1_460px] flex-col gap-4">
      <NewTaskForm />
      {groups.length === 0 && (
        <div className="rounded-[14px] border border-line bg-surface p-8 text-center text-sm text-muted">还没有任务</div>
      )}
      {groups.map((g) => (
        <div key={g.title} className="rounded-[14px] border border-line bg-surface px-5 py-4">
          <h2 className={`mb-1.5 text-sm font-semibold ${g.tone}`}>
            {g.title} <span className="font-normal text-muted">{g.items.length}</span>
          </h2>
          <ul>
            {g.items.map((t) => (
              <li key={t.id} className="group flex min-h-11 items-center gap-3 border-t border-divider">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-[18px] shrink-0 accent-accent"
                    checked={!!t.done_at}
                    onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                  />
                  <span className={`truncate text-sm ${t.done_at ? "text-faint line-through" : ""}`}>{t.title}</span>
                </label>
                <span className={`text-xs tabular-nums ${g.title === "逾期" ? "text-warn" : "text-muted"}`}>
                  {dueLabel(t.due_date, day)}
                </span>
                {!t.done_at && (
                  <input
                    type="date"
                    aria-label={`修改「${t.title}」的截止日期`}
                    value={t.due_date ?? ""}
                    onChange={(e) => setDue.mutate({ id: t.id, due: e.target.value || null })}
                    className="w-[120px] rounded-md border border-transparent bg-transparent text-xs text-muted opacity-0 group-hover:border-line-strong group-hover:opacity-100 focus:opacity-100"
                  />
                )}
                <button
                  className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => remove.mutate(t.id)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function HabitPanel() {
  const day = today();
  const { data: habits = [] } = useQuery({
    queryKey: ["habits", "heatmap"],
    queryFn: () => listHabits(day, HEATMAP_WEEKS * 7),
  });
  const add = useInvalidating("habits", addHabit);
  const archive = useInvalidating("habits", archiveHabit);
  const toggle = useInvalidating("habits", (h: { id: number; checked: boolean }) =>
    setHabitChecked(h.id, day, h.checked),
  );

  return (
    <Card title="习惯" className="flex-[2_1_320px] self-start">
      {habits.length === 0 && <p className="text-sm text-muted">还没有习惯,在下面添加一个</p>}
      {habits.map((h) => {
        const last30 = h.history.slice(-30);
        const rate = Math.round((last30.filter(Boolean).length / last30.length) * 100);
        const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => h.history.slice(w * 7, w * 7 + 7));
        return (
          <div key={h.id} className="group border-t border-divider pt-3 first:border-t-0 first:pt-0">
            <div className="mb-2 flex items-center gap-2">
              <button
                aria-pressed={h.checked}
                onClick={() => toggle.mutate({ id: h.id, checked: !h.checked })}
                className={`min-h-9 rounded-lg border px-3 text-[13px] ${
                  h.checked ? "border-accent bg-accent text-white" : "border-line-strong text-ink-2"
                }`}
              >
                {h.checked ? "今日已打卡" : "打卡"}
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{h.name}</span>
              <button
                className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => archive.mutate(h.id)}
              >
                归档
              </button>
            </div>
            <div
              role="img"
              aria-label={`${h.name} 近 ${HEATMAP_WEEKS} 周打卡热力图`}
              className="grid grid-cols-12 gap-[3px]"
            >
              {weeks.map((days, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {days.map((on, d) => (
                    <span key={d} className={`block h-3 rounded-[3px] ${on ? "bg-accent" : "bg-cell"}`} />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-xs text-muted">
              连续 {h.streak} 天 · 近 30 天完成 {rate}%
            </div>
          </div>
        );
      })}
      <AddInput placeholder="添加习惯,回车确认" onAdd={(v) => add.mutate(v)} />
    </Card>
  );
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function mondayOf(day: string) {
  const offset = (new Date(`${day}T00:00:00`).getDay() + 6) % 7;
  return addDays(day, -offset);
}

function WeekView() {
  const day = today();
  const [weekStart, setWeekStart] = useState(mondayOf(day));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { data: access } = useCalendarAccess();
  const { data: events = [] } = useCalendarEvents(days[0], days[6]);
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const toggle = useInvalidating("tasks", (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));

  return (
    <section aria-label="周视图" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button aria-label="上一周" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ‹
        </button>
        <span className="min-w-36 text-center text-sm font-semibold">
          {shortDate(days[0])} – {shortDate(days[6])}
        </span>
        <button aria-label="下一周" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setWeekStart(addDays(weekStart, 7))}>
          ›
        </button>
        {weekStart !== mondayOf(day) && (
          <button className={ghostButtonClass} onClick={() => setWeekStart(mondayOf(day))}>
            本周
          </button>
        )}
      </div>
      {access !== "granted" && <CalendarGate>{null}</CalendarGate>}
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-2">
          {days.map((d, i) => {
            const isToday = d === day;
            const dayEvents = events.filter((e) => occursOn(e, d));
            const dayTasks = tasks.filter((t) => t.due_date === d);
            return (
              <div
                key={d}
                className={`flex min-h-[420px] min-w-0 flex-col gap-1.5 rounded-xl border p-2 ${
                  isToday ? "border-accent bg-accent-soft/40" : "border-line bg-surface"
                }`}
              >
                <div className="flex items-baseline gap-1.5 px-1 pb-1">
                  <span className="text-xs text-muted">{WEEKDAY_LABELS[i]}</span>
                  <span className={`text-lg font-semibold tabular-nums ${isToday ? "text-accent" : ""}`}>
                    {Number(d.slice(8))}
                  </span>
                </div>
                {dayEvents.map((e) => (
                  <EventRow key={e.id} event={e} day={d} compact />
                ))}
                {dayTasks.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-start gap-1.5 rounded-lg px-1 py-1 hover:bg-ground">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 accent-accent"
                      checked={!!t.done_at}
                      onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                    />
                    <span className={`min-w-0 text-xs ${t.done_at ? "text-faint line-through" : "text-ink-2"}`}>{t.title}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted">彩色条为系统日历事件(只读),复选框为 LifeOS 任务。</p>
    </section>
  );
}

export function TasksPage() {
  const [view, setView] = useState<"list" | "week">("list");
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <PageHeader title="任务与习惯">
        <Segmented
          label="视图"
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "列表" },
            { value: "week", label: "周视图" },
          ]}
        />
      </PageHeader>
      {view === "list" ? (
        <div className="flex flex-wrap items-start gap-5">
          <TaskList />
          <HabitPanel />
        </div>
      ) : (
        <WeekView />
      )}
    </div>
  );
}
