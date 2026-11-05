import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { riseIn, springs } from "./motion";
import { usePrefs } from "../data/prefs";

/**
 * Scale that grows any card by about the same number of pixels, so a full-width card
 * swells as visibly (and as gently) as a narrow one.
 */
function useLiftScale(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1.025);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1.035, 1 + 18 / Math.max(el.offsetWidth, 1))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);
  return [ref, scale] as const;
}

export function Card({
  title,
  aside,
  className = "",
  lift = false,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  /** Magnify on hover (Today page), if the user hasn't turned it off. */
  lift?: boolean;
  children: ReactNode;
}) {
  const { hoverZoom } = usePrefs();
  const on = lift && hoverZoom;
  const [ref, scale] = useLiftScale(on);
  return (
    <motion.section
      ref={ref}
      variants={riseIn}
      whileHover={on ? { scale, y: -3, transition: springs.smooth } : undefined}
      className={`panel flex min-w-0 flex-col gap-3 rounded-[14px] border border-line bg-surface p-5 ${on ? "panel-lift" : ""} ${className}`}
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[10px] bg-ground px-4 py-8 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <motion.header variants={riseIn} className="flex flex-wrap items-center gap-3">
      <h1 className="flex-1 text-[28px] font-bold tracking-tight">{title}</h1>
      {children}
    </motion.header>
  );
}

export function Stat({ label, value, sub, tone = "text-ink" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <motion.div variants={riseIn} className="panel min-w-0 flex-[1_1_200px] rounded-[14px] border border-line bg-surface px-5 py-[18px]">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-[26px] font-bold tracking-tight tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </motion.div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const pillId = useId();
  return (
    <div role="group" aria-label={label} className="inset flex rounded-[10px] bg-sidebar p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative min-h-[38px] flex-1 whitespace-nowrap rounded-lg px-3.5 text-[13px] transition-colors ${
            o.value === value ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.value === value && (
            <motion.span
              layoutId={pillId}
              transition={springs.snappy}
              className="absolute inset-0 rounded-lg bg-surface shadow-sm"
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export const fieldClass =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-field px-3 text-sm outline-none focus:border-accent";

export const primaryButtonClass =
  "min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-ink disabled:opacity-50";

export const ghostButtonClass =
  "min-h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink-2 hover:bg-field";

export function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("value") as HTMLInputElement;
        const v = input.value.trim();
        if (!v) return;
        onAdd(v);
        input.value = "";
      }}
    >
      <input name="value" aria-label={placeholder} placeholder={placeholder} className={fieldClass} />
    </form>
  );
}

/** Simple vertical bar chart; values are drawn relative to `max`, with an optional dashed reference line. */
export function BarChart({
  label,
  bars,
  max,
  refLine,
  height = 180,
}: {
  label: string;
  bars: { key: string; value: number; label: string; tone: string; title: string }[];
  max: number;
  refLine?: number;
  height?: number;
}) {
  const scale = (v: number) => (max > 0 ? Math.round((v / max) * (height - 20)) : 0);
  return (
    <div>
      <div
        role="img"
        aria-label={label}
        className="relative flex items-end gap-2 border-b border-line-strong"
        style={{ height }}
      >
        {refLine !== undefined && (
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-faint" style={{ bottom: scale(refLine) }} />
        )}
        {bars.map((b) => (
          <motion.div
            key={b.key}
            title={b.title}
            className={`flex-1 rounded-t-[5px] ${b.tone}`}
            initial={{ height: 0 }}
            animate={{ height: scale(b.value) }}
            transition={springs.smooth}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {bars.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[11px] text-muted tabular-nums">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Destructive button with an inline second step (the webview has no native confirm()):
 * the first click arms it, a second click within 3 s runs `onConfirm`.
 */
export function ConfirmButton({
  label = "删除",
  confirmLabel = "确认删除",
  onConfirm,
  className = ghostButtonClass,
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <motion.button
      layout
      transition={springs.snappy}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={`${className} overflow-hidden ${armed ? "!border-warn !bg-warn !text-white" : ""}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={armed ? "armed" : "idle"}
          className="inline-block"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={springs.snappy}
        >
          {armed ? confirmLabel : label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
