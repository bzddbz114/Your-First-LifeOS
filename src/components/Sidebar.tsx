import type { ReactNode } from "react";
import { useNav } from "../data/nav";
import { motion } from "motion/react";
import { springs } from "./motion";
import { SettingsDialog } from "./SettingsDialog";

export type PageId = "today" | "tasks" | "projects" | "finance" | "health" | "notes";

const icon = (children: ReactNode) => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const NAV: { id: PageId; label: string; icon: ReactNode }[] = [
  {
    id: "today",
    label: "今天",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  },
  {
    id: "tasks",
    label: "任务与习惯",
    icon: icon(
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M8 12l3 3 5-6" />
      </>,
    ),
  },
  {
    id: "projects",
    label: "项目",
    icon: icon(
      <>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M8 14h8" />
      </>,
    ),
  },
  {
    id: "finance",
    label: "财务",
    icon: icon(
      <>
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M3 10h18M16 15h2" />
      </>,
    ),
  },
  { id: "health", label: "健康", icon: icon(<path d="M3 12h4l2-4 3 8 2-4h7" />) },
  {
    id: "notes",
    label: "笔记与日记",
    icon: icon(
      <>
        <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" />
        <path d="M6 3v18M10 8h5M10 12h5" />
      </>,
    ),
  },
];

export function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (id: PageId) => void }) {
  const settingsOpen = useNav((s) => s.settingsOpen);
  const setSettingsOpen = useNav((s) => s.setSettingsOpen);
  return (
    <nav
      aria-label="主导航"
      className="sidebar flex h-full w-[220px] shrink-0 flex-col overflow-y-auto gap-1 border-r border-line-strong bg-sidebar px-3 py-5"
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-4 pt-1">
        <div className="flex size-7 items-center justify-center rounded-lg bg-ink">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-surface)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4v8l5 3" />
          </svg>
        </div>
        <span className="text-base font-bold tracking-tight">LifeOS</span>
      </div>
      {NAV.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            aria-current={on ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
            className={`relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm transition-colors ${
              on ? "font-semibold text-ink" : "text-ink-2 hover:bg-surface/60"
            }`}
          >
            {on && (
              <motion.span
                layoutId="sidebar-active"
                transition={springs.snappy}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              />
            )}
            <span className="relative flex items-center gap-2.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={() => setSettingsOpen(true)}
        className="mb-2 flex min-h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm text-ink-2 hover:bg-surface/60"
      >
        {icon(
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </>,
        )}
        设置
      </button>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="flex items-center gap-2 border-t border-line-strong px-2.5 pt-3 text-xs text-muted">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        数据仅保存在本机
      </div>
    </nav>
  );
}
