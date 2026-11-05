import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { addDays, formatDay } from "./db";

/** Read-only events from the macOS Calendar app (all accounts the user has added there). */
export interface CalendarEvent {
  /** Unique per occurrence. */
  id: string;
  /** EventKit identifier, shared across a recurring series. */
  eventId: string;
  calendarId: string | null;
  notes: string | null;
  /** False for read-only calendars (subscriptions, holidays…). */
  editable: boolean;
  recurring: boolean;
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

export interface CalendarInfo {
  id: string;
  title: string;
  color: string | null;
  isDefault: boolean;
}

/** Calendars that accept new events, the system default first. */
export function useWritableCalendars() {
  const { data: access } = useCalendarAccess();
  return useQuery({
    queryKey: ["calendar", "list"],
    enabled: access === "granted",
    queryFn: () => invoke<CalendarInfo[]>("calendar_list"),
  });
}

export interface EventInput {
  /** Omitted for a new event. */
  eventId?: string;
  /** Start of the occurrence being edited, for recurring events. */
  occurrenceStartMs?: number;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  calendarId?: string | null;
  location?: string | null;
  notes?: string | null;
}

/** Writes to the macOS Calendar database, then refreshes every calendar query. */
export function useSaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => invoke<string>("calendar_save_event", { input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", "events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Pick<CalendarEvent, "eventId" | "startMs">) =>
      invoke<void>("calendar_delete_event", { eventId: e.eventId, occurrenceStartMs: e.startMs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", "events"] }),
  });
}
