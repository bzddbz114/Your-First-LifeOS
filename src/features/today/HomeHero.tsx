import { useContext, useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useDailyQuote, useShuffleQuote, type DailyQuote } from "../../data/dailyQuote";
import { useSetting } from "../../data/settings";
import { usePrefs } from "../../data/prefs";
import { ScrollRootContext, springs } from "../../components/motion";

interface HeroProps {
  greeting: string;
  remaining: number;
}

const KIND_CODE: Record<DailyQuote["kind"], string> = { 励志: "MOTIVATION", 有趣: "HUMOR", 冷知识: "TRIVIA" };

/** Scroll-linked parallax: the banner drifts up more slowly than the page and dims as cards arrive. */
function useParallax() {
  const root = useContext(ScrollRootContext);
  const { scrollY } = useScroll({ container: root });
  const y = useTransform(scrollY, [0, 400], [0, 70]);
  const opacity = useTransform(scrollY, [0, 360], [1, 0.35]);
  const scale = useTransform(scrollY, [0, 400], [1, 0.97]);
  return { y, opacity, scale };
}

function QuoteActions({ quote, compact = false }: { quote: DailyQuote; compact?: boolean }) {
  const shuffle = useShuffleQuote();
  const { data: apiKey } = useSetting("deepseek_api_key");
  const [copied, setCopied] = useState(false);
  const btn = compact
    ? "min-h-8 border border-current/20 px-2.5 font-mono text-[11px] uppercase tracking-wider hover:bg-accent hover:text-white disabled:opacity-40"
    : "min-h-8 rounded-full border border-line-strong bg-surface/60 px-3 text-xs text-ink-2 hover:border-accent hover:text-accent disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} disabled={shuffle.isPending} onClick={() => shuffle.mutate({ useAi: false, current: quote.text })}>
        {compact ? "Shuffle" : "换一句"}
      </button>
      {apiKey && (
        <button className={btn} disabled={shuffle.isPending} onClick={() => shuffle.mutate({ useAi: true })}>
          {shuffle.isPending && shuffle.variables?.useAi ? (compact ? "Writing…" : "AI 正在写…") : compact ? "AI Write" : "✦ AI 为我写一句"}
        </button>
      )}
      <button
        className={btn}
        onClick={() => {
          void navigator.clipboard.writeText(`${quote.text} —— ${quote.author}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (compact ? "Copied" : "已复制") : compact ? "Copy" : "复制"}
      </button>
      {shuffle.isError && <span className="text-xs text-warn">{(shuffle.error as Error).message}</span>}
    </div>
  );
}

/** Warm editorial: serif type, a big hanging quotation mark, characters easing in one by one. */
function EditorialHero({ greeting, remaining, quote }: HeroProps & { quote: DailyQuote }) {
  const chars = Array.from(quote.text);
  const date = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className="hero-editorial panel relative overflow-hidden rounded-[22px] border border-line px-10 pb-8 pt-9"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -left-2 -top-10 select-none font-serif text-[220px] leading-none text-accent opacity-[0.09]">
        “
      </span>
      <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-[15px] text-ink-2">{date}</span>
        <span className="text-[13px] text-muted">{greeting}</span>
        <span className="flex-1" />
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent-ink">
          {remaining > 0 ? `今天还剩 ${remaining} 件事` : "今天的事都做完了"}
        </span>
      </div>
      <blockquote key={quote.text} className="relative mt-7 max-w-[26em] font-serif text-[clamp(28px,3.6vw,46px)] font-semibold leading-[1.38] tracking-[0.01em] text-ink">
        {chars.map((c, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.028, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block whitespace-pre"
          >
            {c}
          </motion.span>
        ))}
      </blockquote>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + chars.length * 0.028 }}
        className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-3"
      >
        <span className="font-serif text-[15px] text-ink-2">—— {quote.author}</span>
        <span className="text-xs tracking-widest text-muted">{quote.kind}</span>
        <span className="flex-1" />
        <QuoteActions quote={quote} />
      </motion.div>
    </motion.section>
  );
}

const GLYPHS = "▮▯░▒▓/\\<>_=+*#01";

/** Characters resolve left to right out of flickering glyphs, like a terminal decoding a signal. */
function useDecode(text: string) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(reduce ? text : "");
  useEffect(() => {
    if (reduce) return setOut(text);
    const chars = Array.from(text);
    const start = performance.now();
    const total = 380 + chars.length * 26;
    let raf = 0;
    const tick = (now: number) => {
      const done = Math.floor(((now - start) / total) * chars.length);
      setOut(
        chars
          .map((c, i) => (i < done || c === " " ? c : i < done + 6 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ""))
          .join(""),
      );
      if (done < chars.length) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduce]);
  return out;
}

/** Industrial HUD: mono labels, corner brackets, a scan sweep and a decoding headline. */
function HudHero({ greeting, remaining, quote }: HeroProps & { quote: DailyQuote }) {
  const text = useDecode(quote.text);
  const now = new Date();
  const no = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const corner = "pointer-events-none absolute size-4 border-accent";
  return (
    <motion.section
      initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
      animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)", transitionEnd: { clipPath: "none" } }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className="hero-hud panel relative overflow-hidden border border-line-strong px-9 pb-7 pt-6"
    >
      <span className={`${corner} left-2 top-2 border-l-2 border-t-2`} />
      <span className={`${corner} right-2 top-2 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-2 left-2 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-2 right-2 border-b-2 border-r-2`} />
      {/* One scan sweep on arrival. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-accent/15 to-transparent"
        initial={{ top: "-30%" }}
        animate={{ top: "120%" }}
        transition={{ duration: 1.3, ease: "easeInOut", delay: 0.2 }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">NO.{no}</span>
        <span>// DAILY LOG</span>
        <span className="flex-1" />
        <span>{weekday}</span>
        <span className="flex items-center gap-1.5">
          <motion.span className="size-1.5 rounded-full bg-accent" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
          ONLINE
        </span>
      </div>
      <div aria-hidden="true" className="mt-3 h-px bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_6px,transparent_6px_10px)]" />

      <div className="mt-6 flex items-center gap-3">
        <span className="bg-accent px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-white">SIGNAL</span>
        <span className="text-[13px] text-ink-2">{greeting}</span>
      </div>
      <blockquote aria-label={quote.text} className="mt-4 min-h-[1.3em] max-w-[24em] text-[clamp(28px,3.4vw,44px)] font-black leading-[1.3] tracking-tight text-ink">
        <span aria-hidden="true">{text}</span>
      </blockquote>

      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          <div>
            SOURCE // <span className="normal-case tracking-normal text-ink-2">{quote.author}</span>
          </div>
          <div className="mt-1">
            TYPE // <span className="text-accent">[{KIND_CODE[quote.kind]}]</span>
          </div>
        </div>
        <div className="font-mono">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Tasks remaining</div>
          <div className="text-[34px] font-bold leading-none tabular-nums text-ink">{String(remaining).padStart(2, "0")}</div>
        </div>
        <span aria-hidden="true" className="mb-1 hidden h-7 w-28 bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_2px,transparent_2px_4px,var(--color-ink)_4px_5px,transparent_5px_8px)] opacity-60 sm:block" />
        <span className="flex-1" />
        <div className="text-ink-2">
          <QuoteActions quote={quote} compact />
        </div>
      </div>
    </motion.section>
  );
}

export function HomeHero(props: HeroProps) {
  const { homeTheme } = usePrefs();
  const { data: quote } = useDailyQuote();
  // Parallax lives on a wrapper so it never fights the hero's own entrance animation.
  const parallax = useParallax();
  return (
    <motion.div style={parallax} className="origin-top">
      {!quote ? (
        <div className="h-[260px]" />
      ) : homeTheme === "hud" ? (
        <HudHero {...props} quote={quote} />
      ) : (
        <EditorialHero {...props} quote={quote} />
      )}
    </motion.div>
  );
}
