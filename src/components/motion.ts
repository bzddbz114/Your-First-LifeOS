import { useEffect, useRef } from "react";
import type { Transition, Variants } from "motion/react";

/**
 * Spring presets in the spirit of Apple's fluid interfaces: motion is driven by
 * physics (no fixed durations), critically damped for UI chrome and slightly
 * bouncy for things the user directly manipulates.
 */
export const springs = {
  /** Default: quick and settled, for layout and position changes. */
  smooth: { type: "spring", stiffness: 420, damping: 38, mass: 0.9 },
  /** A touch of overshoot, for direct feedback (checks, presses, selections). */
  snappy: { type: "spring", stiffness: 560, damping: 30, mass: 0.8 },
  /** Soft and slower, for large surfaces such as pages and sheets. */
  gentle: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
} satisfies Record<string, Transition>;

/** Parent that staggers its children's `animate` variant. */
export const stagger = (step = 0.04): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren: step } },
});

/** Children of `stagger`: fade up, softened by a brief blur. */
export const riseIn: Variants = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: springs.gentle },
};

/** Collapsible regions: animate to the content's natural height. */
export const collapse: Variants = {
  closed: { height: 0, opacity: 0, transition: springs.smooth },
  open: { height: "auto", opacity: 1, transition: springs.smooth },
};

/**
 * Tells freshly added list items apart from ones that merely moved (e.g. a task jumping to
 * the "done" group remounts there). Only new ids should play an entrance; moved ones just glide.
 */
export function useIsNew(ids: readonly number[]) {
  const seen = useRef<Set<number> | null>(null);
  const prev = seen.current;
  useEffect(() => {
    seen.current = new Set(ids);
  });
  return (id: number) => prev !== null && !prev.has(id);
}

/** Initial state for a list row: rise in when new, otherwise start where it is. */
export const enterIf = (isNew: boolean) => (isNew ? { opacity: 0, y: -6, scale: 0.98 } : false);
