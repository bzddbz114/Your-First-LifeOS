import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatMinutes, formatMoney, shortDate, today } from "../../data/db";
import {
  MOODS,
  createNote,
  daySummary,
  deleteNote,
  getJournal,
  listNotes,
  saveJournal,
  updateNote,
  type NoteKind,
} from "../../data/notes";
import { useInvalidating } from "../../data/useInvalidating";
import { EmptyState, Segmented, ghostButtonClass } from "../../components/Card";

const SAVE_DELAY_MS = 600;

/**
 * Calls `save` once `value` differs from what was last saved and has been stable for
 * SAVE_DELAY_MS; a change still pending on unmount is saved immediately.
 */
function useAutosave(value: string, save: () => void) {
  const saved = useRef(value);
  const latest = useRef({ value, save });
  latest.current = { value, save };

  useEffect(() => {
    if (value === saved.current) return;
    const t = setTimeout(() => {
      saved.current = value;
      save();
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (latest.current.value !== saved.current) {
        saved.current = latest.current.value;
        latest.current.save();
      }
    },
    [],
  );
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function weekday(day: string) {
  return `星期${WEEKDAYS[new Date(`${day}T00:00:00`).getDay()]}`;
}

/** Journal body + mood for one day; also used by the Today page. */
export function JournalEditor({ day, compact = false }: { day: string; compact?: boolean }) {
  const { data: entry, isFetched } = useQuery({ queryKey: ["notes", "journal", day], queryFn: () => getJournal(day) });
  if (!isFetched) return null;
  return <JournalFields key={day} day={day} initialBody={entry?.body ?? ""} initialMood={entry?.mood ?? null} compact={compact} />;
}

function JournalFields({
  day,
  initialBody,
  initialMood,
  compact,
}: {
  day: string;
  initialBody: string;
  initialMood: number | null;
  compact: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [mood, setMood] = useState(initialMood);
  const save = useInvalidating("notes", (v: { body: string; mood: number | null }) => saveJournal(day, v.body, v.mood));
  useAutosave(body + "\u0000" + mood, () => save.mutate({ body, mood }));

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`journal-${day}`} className={compact ? "text-sm text-ink-2" : "sr-only"}>
        今天过得怎么样?
      </label>
      <textarea
        id={`journal-${day}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 3 : 18}
        placeholder={compact ? "写几句就好,晚上再补充……" : "记录这一天……"}
        className={
          compact
            ? "w-full resize-y rounded-[10px] border border-line-strong bg-field p-3 text-sm outline-none focus:border-accent"
            : "w-full resize-none border-0 bg-transparent text-base leading-[1.8] text-ink outline-none"
        }
      />
      <div role="group" aria-label="心情" className="flex flex-wrap gap-2">
        {MOODS.map((label, i) => (
          <button
            key={label}
            aria-pressed={mood === i}
            onClick={() => setMood(mood === i ? null : i)}
            className={`min-h-11 rounded-full border px-4 text-[13px] ${
              mood === i ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted" aria-live="polite">
        {save.isPending ? "保存中…" : save.isSuccess ? "已自动保存" : ""}
      </span>
    </div>
  );
}

function DayPanel({ day }: { day: string }) {
  const { data: s } = useQuery({ queryKey: ["summary", day], queryFn: () => daySummary(day) });
  if (!s) return null;
  const rows = [
    ["完成任务", `${s.tasksDone} 项`],
    ["习惯打卡", `${s.habitsDone} / ${s.habitsTotal}`],
    ["支出", formatMoney(s.spentCents)],
    ["睡眠", s.sleepMinutes ? formatMinutes(s.sleepMinutes) : "未记录"],
    ["运动", s.workoutMinutes ? `${s.workoutMinutes} 分钟` : "无"],
  ];
  return (
    <aside aria-label="这一天" className="flex-[1_1_240px] border-l border-line bg-field px-5 py-6">
      <h2 className="mb-2.5 text-[13px] font-semibold text-muted">这一天的数据</h2>
      <dl className="flex flex-col text-[13px] tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-10 items-center px-2.5">
            <dt className="flex-1 text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function NoteEditor({ id, initialTitle, initialBody }: { id: number; initialTitle: string; initialBody: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const save = useInvalidating("notes", (v: { title: string; body: string }) => updateNote(id, v.title, v.body));
  useAutosave(title + "\u0000" + body, () => save.mutate({ title, body }));
  return (
    <>
      <input
        aria-label="标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-6 w-full border-0 bg-transparent text-[30px] font-bold tracking-tight outline-none"
      />
      <textarea
        aria-label="正文"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={20}
        placeholder="开始写……"
        className="w-full resize-none border-0 bg-transparent text-base leading-[1.8] text-ink outline-none"
      />
      <span className="text-xs text-muted" aria-live="polite">
        {save.isPending ? "保存中…" : save.isSuccess ? "已自动保存" : ""}
      </span>
    </>
  );
}

export function NotesPage() {
  const day = today();
  const [kind, setKind] = useState<NoteKind>("journal");
  const [search, setSearch] = useState("");
  const [journalDay, setJournalDay] = useState(day);
  const [noteId, setNoteId] = useState<number | null>(null);
  const { data: notes = [] } = useQuery({ queryKey: ["notes", kind, search], queryFn: () => listNotes(kind, search) });
  const create = useInvalidating("notes", createNote);
  const remove = useInvalidating("notes", deleteNote);

  const journalDays = kind === "journal" && !search && !notes.some((n) => n.day === day) ? [{ id: -1, day, body: "", mood: null }] : [];
  const listed = [...journalDays, ...notes];
  const selectedNote = notes.find((n) => n.id === noteId);

  return (
    <div className="-mx-10 -mb-12 -mt-9 flex min-h-screen flex-wrap">
      <section aria-label="列表" className="flex max-w-full flex-[1_1_260px] flex-col gap-3 border-r border-line bg-field px-4 py-6">
        <Segmented
          label="类型"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setSearch("");
          }}
          options={[
            { value: "journal", label: "日记" },
            { value: "note", label: "笔记" },
          ]}
        />
        <input
          type="search"
          aria-label="搜索全文"
          placeholder="搜索全文"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] outline-none focus:border-accent"
        />
        {kind === "note" && (
          <button
            className={ghostButtonClass}
            onClick={() => create.mutate(undefined, { onSuccess: (id) => setNoteId(id as number) })}
          >
            + 新笔记
          </button>
        )}
        <ul className="flex flex-col gap-1">
          {listed.map((n) => {
            const on = kind === "journal" ? n.day === journalDay : n.id === noteId;
            const title = kind === "journal" ? (n.day === day ? "今天" : shortDate(n.day!)) : (n as { title: string }).title;
            return (
              <li key={`${n.id}-${n.day}`}>
                <button
                  aria-current={on ? "true" : undefined}
                  onClick={() => (kind === "journal" ? setJournalDay(n.day!) : setNoteId(n.id))}
                  className={`block w-full rounded-[10px] border px-3 py-2.5 text-left ${
                    on ? "border-line-strong bg-surface" : "border-transparent hover:bg-surface/60"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 truncate text-sm font-semibold">{title}</span>
                    {kind === "journal" && n.mood !== null && <span className="text-xs text-muted">{MOODS[n.mood]}</span>}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-muted">{n.body || "还没写"}</div>
                </button>
              </li>
            );
          })}
          {listed.length === 0 && <li className="px-1 text-[13px] text-muted">{search ? "没有匹配的内容" : "还没有笔记"}</li>}
        </ul>
      </section>

      <article className="min-w-0 flex-[3_1_420px] bg-surface px-12 py-10">
        <div className="mx-auto max-w-[640px]">
          {kind === "journal" ? (
            <>
              <p className="mb-2 text-xs text-muted">日记 · {weekday(journalDay)}</p>
              <h1 className="mb-6 text-[30px] font-bold tracking-tight">{shortDate(journalDay)}</h1>
              <JournalEditor day={journalDay} />
            </>
          ) : selectedNote ? (
            <>
              <div className="mb-2 flex text-xs text-muted">
                <span className="flex-1">笔记</span>
                <button
                  className="hover:text-warn"
                  onClick={() => remove.mutate(selectedNote.id, { onSuccess: () => setNoteId(null) })}
                >
                  删除
                </button>
              </div>
              <NoteEditor key={selectedNote.id} id={selectedNote.id} initialTitle={selectedNote.title} initialBody={selectedNote.body} />
            </>
          ) : (
            <EmptyState>选择左侧的笔记,或新建一篇</EmptyState>
          )}
        </div>
      </article>

      {kind === "journal" && <DayPanel day={journalDay} />}
    </div>
  );
}
