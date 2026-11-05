import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { riseIn, springs } from "./motion";

export function Card({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      variants={riseIn}
      className={`flex min-w-0 flex-col gap-3 rounded-[14px] border border-line bg-surface p-5 ${className}`}
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
    <motion.div variants={riseIn} className="min-w-0 flex-[1_1_200px] rounded-[14px] border border-line bg-surface px-5 py-[18px]">
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
    <div role="group" aria-label={label} className="flex rounded-[10px] bg-sidebar p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative min-h-[38px] flex-1 rounded-lg px-3.5 text-[13px] transition-colors ${
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
