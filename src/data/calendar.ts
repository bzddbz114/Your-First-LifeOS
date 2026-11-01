import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { addDays, formatDay } from "./db";

/** Read-only events from the macOS Calendar app (all accounts the user has added there). */
export interface CalendarEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  calendar: string;
  color: string | null;
  location: string | null;
}

export type CalendarAccess = "granted" | "notDetermined" | "denied" | "restricted" | "writeOnly" | "unsupported";

const dayStartMs = (day: string) => new Date(`${day}T00:00:00`).getTime();

export function useCalendarAccess() {
  return useQuery({
    queryKey: ["calendar", "access"],
    queryFn: () => invoke<CalendarAccess>("calendar_access_status"),
  });
}

export function useRequestCalendarAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invoke<boolean>("calendar_request_access"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

/** Events overlapping [fromDay, toDay] inclusive, sorted by start; empty until access is granted. */
export function useCalendarEvents(fromDay: string, toDay: string) {
  const { data: access } = useCalendarAccess();
  return useQuery({
    queryKey: ["calendar", "events", fromDay, toDay],
    enabled: access === "granted",
    queryFn: () =>
      invoke<CalendarEvent[]>("calendar_events", {
        startMs: dayStartMs(fromDay),
        endMs: dayStartMs(addDays(toDay, 1)),
      }),
  });
}

/** Whether `event` occupies any part of `day` (all-day events end at midnight of the following day). */
export function occursOn(event: CalendarEvent, day: string) {
  const start = dayStartMs(day);
  const end = dayStartMs(addDays(day, 1));
  return event.startMs < end && event.endMs > start;
}

export function formatTime(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Start time on `day`, or "00:00"-style continuation when a multi-day event began earlier. */
export function timeLabel(event: CalendarEvent, day: string) {
  if (event.allDay) return "全天";
  return formatDay(new Date(event.startMs)) === day ? formatTime(event.startMs) : "续";
}
