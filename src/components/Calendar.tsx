import type { ReactNode } from "react";
import { timeLabel, useCalendarAccess, useRequestCalendarAccess, type CalendarEvent } from "../data/calendar";
import { EmptyState } from "./Card";

/** One calendar event: time, colored bar in the calendar's color, title and location. */
export function EventRow({ event, day, compact = false }: { event: CalendarEvent; day: string; compact?: boolean }) {
  const color = event.color ?? "var(--color-accent)";
  return (
    <div className={`flex gap-2.5 ${compact ? "" : "items-start"}`} title={`${event.calendar}${event.location ? ` · ${event.location}` : ""}`}>
      {!compact && <span className="w-12 shrink-0 pt-2 text-[13px] text-muted tabular-nums">{timeLabel(event, day)}</span>}
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg bg-ground">
        <span aria-hidden="true" className="w-1 shrink-0" style={{ background: color }} />
        <div className={`min-w-0 flex-1 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
          {compact && <div className="text-[11px] text-muted tabular-nums">{timeLabel(event, day)}</div>}
          <div className={`truncate text-ink-2 ${compact ? "text-xs" : "text-[13px]"}`}>{event.title || "(无标题)"}</div>
          {!compact && event.location && <div className="truncate text-xs text-muted">{event.location}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a prompt while calendar access isn't granted, or `children` once it is.
 */
export function CalendarGate({ children }: { children: ReactNode }) {
  const { data: access, isLoading } = useCalendarAccess();
  const request = useRequestCalendarAccess();

  if (isLoading) return null;
  if (access === "granted") return <>{children}</>;

  if (access === "notDetermined") {
    return (
      <EmptyState>
        <div className="flex flex-col items-center gap-3">
          <span>连接 Mac「日历」App,显示你的日程(只读,数据不离开本机)</span>
          <button
            onClick={() => request.mutate()}
            disabled={request.isPending}
            className="min-h-10 rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent-ink disabled:opacity-50"
          >
            {request.isPending ? "等待授权…" : "连接系统日历"}
          </button>
        </div>
      </EmptyState>
    );
  }

  const message =
    access === "unsupported"
      ? "系统日历仅在 macOS 上可用"
      : access === "writeOnly"
        ? "LifeOS 目前只有「仅添加」权限,无法读取事件。请到 系统设置 › 隐私与安全性 › 日历 中改为「完全访问」"
        : "日历访问被拒绝。请到 系统设置 › 隐私与安全性 › 日历 中允许 LifeOS,然后重新打开应用";
  return <EmptyState>{message}</EmptyState>;
}
