import { useEffect, useState } from "react";
import { addDays, formatDay } from "../../data/db";
import { formatTime, useDeleteEvent, useSaveEvent, useWritableCalendars, type CalendarEvent } from "../../data/calendar";
import { ConfirmButton, fieldClass, ghostButtonClass, primaryButtonClass } from "../../components/Card";
import { Modal } from "../../components/Modal";

/** What the editor opens on: an existing event, or a new one prefilled at a time slot. */
export type EditorTarget = { event: CalendarEvent } | { startMs: number; endMs: number; allDay: boolean };

interface Draft {
  title: string;
  allDay: boolean;
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
  calendarId: string;
  location: string;
  notes: string;
}

const toMs = (day: string, time: string) => new Date(`${day}T${time || "00:00"}:00`).getTime();

function draftFrom(target: EditorTarget, defaultCalendar: string): Draft {
  const e = "event" in target ? target.event : null;
  const startMs = e?.startMs ?? ("startMs" in target ? target.startMs : Date.now());
  const endMs = e?.endMs ?? ("endMs" in target ? target.endMs : startMs + 3_600_000);
  const allDay = e?.allDay ?? ("allDay" in target && target.allDay);
  return {
    title: e?.title ?? "",
    allDay,
    startDay: formatDay(new Date(startMs)),
    startTime: formatTime(startMs),
    // All-day events end at (or just before) midnight after their last day.
    endDay: formatDay(new Date(allDay ? endMs - 1 : endMs)),
    endTime: formatTime(endMs),
    calendarId: e?.calendarId ?? defaultCalendar,
    location: e?.location ?? "",
    notes: e?.notes ?? "",
  };
}

export function EventEditor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }) {
  const { data: calendars = [] } = useWritableCalendars();
  const save = useSaveEvent();
  const remove = useDeleteEvent();
  const existing = target && "event" in target ? target.event : null;
  const readOnly = !!existing && !existing.editable;
  const [d, setD] = useState<Draft | null>(null);

  useEffect(() => {
    if (target) setD(draftFrom(target, calendars[0]?.id ?? ""));
    save.reset();
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Draft>) => setD((prev) => (prev ? { ...prev, ...patch } : prev));
  const submit = () => {
    if (!d || !d.title.trim()) return;
    const startMs = d.allDay ? toMs(d.startDay, "00:00") : toMs(d.startDay, d.startTime);
    const endMs = d.allDay ? toMs(addDays(d.endDay, 1), "00:00") - 1000 : toMs(d.endDay, d.endTime);
    save.mutate(
      {
        eventId: existing?.eventId,
        occurrenceStartMs: existing?.startMs,
        title: d.title,
        startMs,
        endMs,
        allDay: d.allDay,
        calendarId: d.calendarId || null,
        location: d.location,
        notes: d.notes,
      },
      { onSuccess: onClose },
    );
  };

  const calendarColor = calendars.find((c) => c.id === d?.calendarId)?.color ?? existing?.color ?? "var(--color-accent)";

  return (
    <Modal open={!!target} onClose={onClose} label={existing ? "编辑日程" : "新建日程"} width={460}>
      {d && (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="size-3 shrink-0 rounded-full" style={{ background: calendarColor }} />
            <input
              autoFocus={!existing}
              aria-label="标题"
              placeholder="日程标题"
              readOnly={readOnly}
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-faint focus:shadow-none"
            />
          </div>
          {readOnly && <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">「{existing!.calendar}」是只读日历,这个日程只能查看。</p>}
          {existing?.recurring && !readOnly && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-ink">这是重复日程,修改和删除只影响这一次。</p>
          )}

          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="size-4 accent-accent" checked={d.allDay} disabled={readOnly} onChange={(e) => set({ allDay: e.target.checked })} />
            全天
          </label>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 text-[13px] text-muted">
            <span>开始</span>
            <input type="date" disabled={readOnly} value={d.startDay} onChange={(e) => {
              // Moving the start keeps the event's length.
              const shift = Math.round((toMs(e.target.value, "00:00") - toMs(d.startDay, "00:00")) / 86_400_000);
              set({ startDay: e.target.value, endDay: addDays(d.endDay, shift) });
            }} className={fieldClass} />
            {!d.allDay ? <input type="time" disabled={readOnly} value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${fieldClass} w-auto`} /> : <span />}
            <span>结束</span>
            <input type="date" disabled={readOnly} value={d.endDay} onChange={(e) => set({ endDay: e.target.value })} className={fieldClass} />
            {!d.allDay ? <input type="time" disabled={readOnly} value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${fieldClass} w-auto`} /> : <span />}
          </div>

          {!readOnly && calendars.length > 0 && (
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              日历
              <select value={d.calendarId} onChange={(e) => set({ calendarId: e.target.value })} className={fieldClass}>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.isDefault ? "(默认)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input aria-label="地点" placeholder="地点" readOnly={readOnly} value={d.location} onChange={(e) => set({ location: e.target.value })} className={fieldClass} />
          <textarea
            aria-label="备注"
            placeholder="备注"
            rows={3}
            readOnly={readOnly}
            value={d.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className={`${fieldClass} resize-y py-2`}
          />

          {(save.error || remove.error) && <p className="text-xs text-warn">{String(save.error ?? remove.error)}</p>}
          <div className="flex items-center gap-2 pt-1">
            {existing && !readOnly && (
              <ConfirmButton
                confirmLabel={existing.recurring ? "删除这一次" : "确认删除"}
                onConfirm={() => remove.mutate(existing, { onSuccess: onClose })}
              />
            )}
            <span className="flex-1" />
            <button type="button" className={`${ghostButtonClass} min-h-11 px-4`} onClick={onClose}>
              {readOnly ? "关闭" : "取消"}
            </button>
            {!readOnly && (
              <button type="submit" className={primaryButtonClass} disabled={!d.title.trim() || save.isPending}>
                {existing ? "保存" : "添加到日历"}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
