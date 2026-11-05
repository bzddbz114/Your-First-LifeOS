import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { addDays, shortDate, today } from "../../data/db";
import { formatTime, occursOn, useCalendarAccess, useCalendarEvents, type CalendarEvent } from "../../data/calendar";
import { listTasks, setTaskDone } from "../../data/tasks";
import { useNav } from "../../data/nav";
import { TASK_KEYS, useInvalidating } from "../../data/useInvalidating";
import { CalendarGate } from "../../components/Calendar";
import { PageHeader, Segmented, ghostButtonClass, primaryButtonClass } from "../../components/Card";
import { riseIn, springs } from "../../components/motion";
import { EventEditor, type EditorTarget } from "./EventEditor";
import { readableOn } from "../../components/color";

const HOUR_PX = 52;
const SNAP_MIN = 30;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const dayStart = (day: string) => new Date(`${day}T00:00:00`).getTime();

function mondayOf(day: string) {
  const offset = (new Date(`${day}T00:00:00`).getDay() + 6) % 7;
  return addDays(day, -offset);
}

interface Placed {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Lays out one day's timed events: overlapping ones share the width side by side. */
function layoutDay(events: CalendarEvent[], day: string): Placed[] {
  const s0 = dayStart(day);
  const s1 = dayStart(addDays(day, 1));
  const items = events
    .filter((e) => !e.allDay && occursOn(e, day))
    .map((e) => ({ e, a: Math.max(e.startMs, s0), b: Math.min(e.endMs, s1) }))
    .sort((x, y) => x.a - y.a || y.b - x.b);

  const out: Placed[] = [];
  let cluster: { e: CalendarEvent; a: number; b: number; col: number }[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) {
      const top = ((c.a - s0) / 60_000) * (HOUR_PX / 60);
      const height = Math.max(((c.b - c.a) / 60_000) * (HOUR_PX / 60), 22);
      out.push({ event: c.e, top, height, col: c.col, cols });
    }
    cluster = [];
  };
  for (const it of items) {
    if (it.a >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.b > it.a).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.b);
  }
  if (cluster.length) flush();
  return out;
}

function NowLine({ day }: { day: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (day !== today()) return null;
  const top = ((now - dayStart(day)) / 60_000) * (HOUR_PX / 60);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top }}>
      <span className="-ml-1 size-2 rounded-full bg-[#e5484d]" />
      <span className="h-px flex-1 bg-[#e5484d]" />
    </div>
  );
}

function EventBlock({ p, onOpen }: { p: Placed; onOpen: () => void }) {
  const color = p.event.color ?? "var(--color-accent)";
  const short = p.height < 40;
  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, zIndex: 15 }}
      transition={springs.smooth}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={`${p.event.title} · ${formatTime(p.event.startMs)}–${formatTime(p.event.endMs)}`}
      className="absolute z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm"
      style={{
        top: p.top + 1,
        height: p.height - 2,
        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
        width: `calc(${100 / p.cols}% - 4px)`,
        background: `color-mix(in srgb, ${color} 18%, var(--color-surface))`,
        borderLeft: `3px solid ${color}`,
        color: "var(--color-ink)",
      }}
    >
      <div className={`font-semibold ${short ? "truncate" : "line-clamp-2"}`}>
        {p.event.title || "(无标题)"}
        {short && <span className="ml-1 font-normal text-muted">{formatTime(p.event.startMs)}</span>}
      </div>
      {!short && <div className="text-muted tabular-nums">{formatTime(p.event.startMs)}–{formatTime(p.event.endMs)}</div>}
      {!short && p.event.location && <div className="truncate text-muted">{p.event.location}</div>}
    </motion.button>
  );
}

export function CalendarPage() {
  const view = useNav((s) => s.calendarView);
  const setView = (v: "day" | "week") => useNav.setState({ calendarView: v });
  const day0 = today();
  const [anchor, setAnchor] = useState(day0);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const { data: access } = useCalendarAccess();
  const scroller = useRef<HTMLDivElement>(null);

  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i));
  const { data: events = [] } = useCalendarEvents(days[0], days[days.length - 1]);
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const toggle = useInvalidating(TASK_KEYS, (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const placed = useMemo(() => days.map((d) => layoutDay(events, d)), [events, days.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open at 07:00 rather than midnight.
  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR_PX * 7 - 8 });
  }, [view]);

  const step = view === "day" ? 1 : 7;
  const isCurrent = view === "day" ? anchor === day0 : mondayOf(anchor) === mondayOf(day0);
  const title =
    view === "day"
      ? `${shortDate(anchor)} ${WEEKDAYS[new Date(`${anchor}T00:00:00`).getDay()]}`
      : `${shortDate(days[0])} – ${shortDate(days[6])}`;

  const createAt = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (access !== "granted") return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const min = Math.floor((y / HOUR_PX) * 60 / SNAP_MIN) * SNAP_MIN;
    const startMs = dayStart(day) + min * 60_000;
    setEditor({ startMs, endMs: startMs + 3_600_000, allDay: false });
  };

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <PageHeader title="日程">
        <Segmented
          label="视图"
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "日" },
            { value: "week", label: "周" },
          ]}
        />
        {access === "granted" && (
          <button
            className={primaryButtonClass}
            onClick={() => {
              const now = new Date();
              const base = view === "day" ? anchor : day0;
              const startMs = dayStart(base) + Math.min(23, now.getHours() + 1) * 3_600_000;
              setEditor({ startMs, endMs: startMs + 3_600_000, allDay: false });
            }}
          >
            新建日程
          </button>
        )}
      </PageHeader>

      <motion.div variants={riseIn} className="flex items-center gap-2">
        <button aria-label="上一段" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setAnchor(addDays(anchor, -step))}>
          ‹
        </button>
        <button aria-label="下一段" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setAnchor(addDays(anchor, step))}>
          ›
        </button>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springs.smooth}
            className="min-w-40 text-lg font-semibold tabular-nums"
          >
            {title}
          </motion.span>
        </AnimatePresence>
        {!isCurrent && (
          <button className={ghostButtonClass} onClick={() => setAnchor(day0)}>
            {view === "day" ? "今天" : "本周"}
          </button>
        )}
      </motion.div>

      {access !== "granted" && <CalendarGate>{null}</CalendarGate>}

      <motion.div variants={riseIn} className="panel overflow-hidden rounded-[14px] border border-line bg-surface">
        {/* Day headers + all-day row */}
        <div className="flex border-b border-line">
          <div className="w-14 shrink-0" />
          {days.map((d) => {
            const isToday = d === day0;
            const allDay = events.filter((e) => e.allDay && occursOn(e, d));
            const dueTasks = tasks.filter((t) => t.due_date === d);
            return (
              <div key={d} className="min-w-0 flex-1 border-l border-divider px-1.5 pb-2 pt-2">
                <button
                  disabled={view === "day"}
                  onClick={() => (setAnchor(d), setView("day"))}
                  className="mb-1 flex items-baseline gap-1.5 rounded-md px-1 enabled:hover:bg-field"
                >
                  <span className="text-xs text-muted">{WEEKDAYS[new Date(`${d}T00:00:00`).getDay()]}</span>
                  <span
                    className={`flex size-7 items-center justify-center rounded-full text-base font-semibold tabular-nums ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                </button>
                <div className="flex flex-col gap-1">
                  {allDay.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEditor({ event: e })}
                      className="truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium"
                      style={{ background: e.color ?? "var(--color-accent)", color: e.color ? readableOn(e.color) : "#fff" }}
                    >
                      {e.title}
                    </button>
                  ))}
                  {dueTasks.map((t) => (
                    <label key={`t${t.id}`} className="flex cursor-pointer items-center gap-1 rounded px-1 text-[11px] hover:bg-field">
                      <input
                        type="checkbox"
                        className="size-3 shrink-0 accent-accent"
                        checked={!!t.done_at}
                        onChange={(ev) => toggle.mutate({ id: t.id, done: ev.target.checked })}
                      />
                      <span className={`truncate ${t.done_at ? "text-faint line-through" : "text-ink-2"}`}>{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hour grid */}
        <div ref={scroller} className="relative max-h-[calc(100vh-260px)] min-h-[360px] overflow-y-auto overscroll-contain">
          <div className="flex" style={{ height: HOUR_PX * 24 }}>
            <div className="relative w-14 shrink-0">
              {Array.from({ length: 23 }, (_, h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums" style={{ top: (h + 1) * HOUR_PX }}>
                  {String(h + 1).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((d, i) => (
              <div
                key={d}
                onClick={(e) => createAt(d, e)}
                className={`relative min-w-0 flex-1 border-l border-divider ${access === "granted" ? "cursor-cell" : ""} ${
                  d === day0 && view === "week" ? "bg-accent-soft/30" : ""
                }`}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--color-divider) ${HOUR_PX - 1}px, var(--color-divider) ${HOUR_PX}px)`,
                }}
              >
                {placed[i].map((p) => (
                  <EventBlock key={p.event.id} p={p} onOpen={() => setEditor({ event: p.event })} />
                ))}
                <NowLine day={d} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <p className="text-xs text-muted">点空白时段新建日程,点日程编辑;改动会直接写入系统「日历」。复选框是 LifeOS 任务。</p>

      <EventEditor target={editor} onClose={() => setEditor(null)} />
    </div>
  );
}
