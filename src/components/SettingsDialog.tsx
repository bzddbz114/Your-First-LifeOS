import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { setSetting, useSetting } from "../data/settings";
import { DEFAULT_DEEPSEEK_MODEL } from "../data/ai";
import { useInvalidating } from "../data/useInvalidating";
import { Segmented, fieldClass, ghostButtonClass, primaryButtonClass } from "./Card";
import { ACCENTS, HOME_MODULES, STYLES, usePrefs, useUpdatePrefs, type AccentId, type Appearance, type MotionPref, type StyleId } from "../data/prefs";
import { springs } from "./motion";

function AiForm({ onClose }: { onClose: () => void }) {
  const { data: savedKey } = useSetting("deepseek_api_key");
  const { data: savedModel } = useSetting("deepseek_model");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [reveal, setReveal] = useState(false);
  useEffect(() => setKey(savedKey ?? ""), [savedKey]);
  useEffect(() => setModel(savedModel ?? ""), [savedModel]);
  const save = useInvalidating("settings", async () => {
    await setSetting("deepseek_api_key", key.trim());
    await setSetting("deepseek_model", model.trim());
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: onClose });
      }}
    >
      <p className="text-[13px] text-muted">DeepSeek 用于把项目拆解成步骤。Key 只保存在本机数据库里,拆解时只发送项目标题、说明、日期和已有步骤。</p>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        DeepSeek API Key
        <div className="flex gap-2">
          <input
            type={reveal ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className={`${fieldClass} flex-1 font-mono`}
          />
          <button type="button" className={ghostButtonClass} onClick={() => setReveal((r) => !r)}>
            {reveal ? "隐藏" : "显示"}
          </button>
        </div>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        模型
        <input
          placeholder={DEFAULT_DEEPSEEK_MODEL}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={`${fieldClass} font-mono`}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={`${ghostButtonClass} min-h-11 px-4`} onClick={onClose}>
          取消
        </button>
        <button type="submit" className={primaryButtonClass} disabled={save.isPending}>
          保存
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-2">{label}</span>
      {children}
    </div>
  );
}

/** Miniature of each style: a backdrop with two little cards drawn the way that style draws them. */
const PREVIEW: Record<StyleId, { bg: string; card: CSSProperties }> = {
  classic: { bg: "#f6f6f3", card: { background: "#fff", border: "1px solid #e4e4df", borderRadius: 5 } },
  glass: {
    bg: "radial-gradient(circle at 20% 25%, var(--color-accent), transparent 60%), radial-gradient(circle at 85% 30%, #f2a7c3, transparent 55%), radial-gradient(circle at 50% 100%, #8fd3e8, transparent 60%), #e9ecf3",
    card: {
      background: "rgba(255,255,255,0.45)",
      border: "1px solid rgba(255,255,255,0.8)",
      borderRadius: 7,
      backdropFilter: "blur(6px) saturate(180%)",
      boxShadow: "inset 0 1px 0 #fff, 0 3px 8px -3px rgba(30,34,60,.25)",
    },
  },
  soft: { bg: "#f2f0eb", card: { background: "#fff", borderRadius: 8, boxShadow: "0 3px 8px -2px rgba(60,48,30,.18)" } },
  mono: { bg: "#fff", card: { background: "#fff", border: "1px solid #d8d8d8", borderRadius: 2 } },
};

function StylePicker({ value, onChange }: { value: StyleId; onChange: (v: StyleId) => void }) {
  return (
    <div role="radiogroup" aria-label="风格" className="grid grid-cols-2 gap-2.5">
      {STYLES.map((s) => {
        const on = value === s.id;
        const p = PREVIEW[s.id];
        return (
          <button
            key={s.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s.id)}
            className={`relative flex flex-col gap-1.5 rounded-xl border p-2 text-left ${on ? "border-accent" : "border-line-strong hover:border-faint"}`}
          >
            {on && (
              <motion.span
                layoutId="style-ring"
                transition={springs.snappy}
                className="pointer-events-none absolute -inset-px rounded-xl border-2 border-accent"
              />
            )}
            <span aria-hidden="true" className="flex h-14 items-end gap-1.5 overflow-hidden rounded-lg p-2" style={{ background: p.bg }}>
              <span className="h-8 flex-[2]" style={p.card} />
              <span className="h-10 flex-1" style={p.card} />
            </span>
            <span className="px-0.5 text-[13px] font-semibold text-ink">{s.label}</span>
            <span className="px-0.5 text-[11px] leading-snug text-muted">{s.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Personalization: every control applies immediately, no save button. */
function PersonalForm({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs();
  const update = useUpdatePrefs();
  const [name, setName] = useState(prefs.name);
  useEffect(() => setName(prefs.name), [prefs.name]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="称呼">
        <input
          placeholder="今天页会这样问候你,例如「小林」"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== prefs.name && update.mutate({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={fieldClass}
        />
      </Field>
      <Field label="风格">
        <StylePicker value={prefs.style} onChange={(v) => update.mutate({ style: v })} />
      </Field>
      <Field label="主题色">
        <div role="radiogroup" aria-label="主题色" className="flex flex-wrap gap-2.5">
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
            const on = prefs.accent === id;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                aria-label={ACCENTS[id].label}
                title={ACCENTS[id].label}
                onClick={() => update.mutate({ accent: id })}
                className="relative flex size-9 items-center justify-center rounded-full"
              >
                {on && (
                  <motion.span
                    layoutId="accent-ring"
                    transition={springs.snappy}
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: ACCENTS[id].light[0] }}
                  />
                )}
                <span className="size-6 rounded-full" style={{ background: ACCENTS[id].light[0] }} />
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="外观">
        <Segmented<Appearance>
          label="外观"
          value={prefs.appearance}
          onChange={(v) => update.mutate({ appearance: v })}
          options={[
            { value: "system", label: "跟随系统" },
            { value: "light", label: "浅色" },
            { value: "dark", label: "深色" },
          ]}
        />
      </Field>
      <Field label="动画">
        <Segmented<MotionPref>
          label="动画"
          value={prefs.motion}
          onChange={(v) => update.mutate({ motion: v })}
          options={[
            { value: "full", label: "流畅" },
            { value: "reduced", label: "减弱" },
          ]}
        />
      </Field>
      <Field label="今天页悬停放大">
        <Segmented<"on" | "off">
          label="今天页悬停放大"
          value={prefs.hoverZoom ? "on" : "off"}
          onChange={(v) => update.mutate({ hoverZoom: v === "on" })}
          options={[
            { value: "on", label: "开启" },
            { value: "off", label: "关闭" },
          ]}
        />
      </Field>
      <Field label="今天页显示">
        <div className="flex flex-wrap gap-2">
          {HOME_MODULES.map((m) => {
            const on = !prefs.homeHidden.includes(m.id);
            return (
              <button
                key={m.id}
                aria-pressed={on}
                onClick={() =>
                  update.mutate({
                    homeHidden: on ? [...prefs.homeHidden, m.id] : prefs.homeHidden.filter((x) => x !== m.id),
                  })
                }
                className={`min-h-9 rounded-full border px-3.5 text-[13px] ${
                  on ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong text-muted"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="flex justify-end">
        <button className={primaryButtonClass} onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"personal" | "ai">("personal");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 whitespace-nowrap text-lg font-semibold">设置</h2>
        <Segmented
          label="设置分类"
          value={tab}
          onChange={setTab}
          options={[
            { value: "personal", label: "个性化" },
            { value: "ai", label: "AI" },
          ]}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === "ai" ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tab === "ai" ? -16 : 16, transition: { duration: 0.12 } }}
          transition={springs.smooth}
        >
          {tab === "personal" ? <PersonalForm onClose={onClose} /> : <AiForm onClose={onClose} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Modal sheet that springs up from slightly below, over a dimmed backdrop. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Portaled to <body>: a backdrop-filter on an ancestor (the glass sidebar) would otherwise
  // become the containing block for this fixed overlay and squeeze it into the sidebar.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="设置"
            className="panel panel-sheet max-h-full w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springs.gentle }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
          >
            <SettingsForm onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
