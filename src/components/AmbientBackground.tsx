import { motion } from "motion/react";

/** Each blob drifts along its own slow loop; long, mismatched periods keep it from looking mechanical. */
const BLOBS = [
  { color: "var(--color-accent)", size: 620, x: ["-8%", "12%", "-4%", "-8%"], y: ["-12%", "6%", "18%", "-12%"], left: "8%", top: "4%", dur: 34 },
  { color: "var(--glass-blob-2)", size: 540, x: ["6%", "-14%", "4%", "6%"], y: ["10%", "-6%", "-16%", "10%"], left: "56%", top: "14%", dur: 41 },
  { color: "var(--glass-blob-3)", size: 700, x: ["-6%", "8%", "14%", "-6%"], y: ["8%", "-10%", "4%", "8%"], left: "24%", top: "52%", dur: 47 },
];

/**
 * Soft, slowly moving color field behind the Liquid Glass style, so the frosted panels have
 * something to refract. Purely decorative and frozen when motion is reduced.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            top: b.top,
            background: `radial-gradient(circle at 50% 50%, ${b.color}, transparent 68%)`,
            opacity: "var(--glass-blob-opacity)",
            filter: "blur(40px)",
          }}
          animate={{ x: b.x, y: b.y, scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
