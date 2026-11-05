import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { addDays, shortDate, today } from "../../data/db";
import { addTask, deleteTask, listProjectTasks, setTaskDone, setTaskDue, type Task } from "../../data/tasks";
import {
  addProject,
  addSteps,
  archiveProject,
  deleteProject,
  listProjects,
  setProjectDone,
  updateProject,
  type Project,
} from "../../data/projects";
import { suggestSteps, type SuggestedStep } from "../../data/ai";
import { useNav } from "../../data/nav";
import { useSetting } from "../../data/settings";
import { TASK_KEYS, useInvalidating } from "../../data/useInvalidating";
import { ConfirmButton, fieldClass, ghostButtonClass, primaryButtonClass } from "../../components/Card";
import { collapse, enterIf, riseIn, springs, useIsNew } from "../../components/motion";

const DAY_MS = 86_400_000;

/** Whole days from `a` to `b` (both "YYYY-MM-DD"). */
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY_MS);
}

export function progressPct(p: Pick<Project, "total" | "done">) {
  return p.total ? Math.round((p.done / p.total) * 100) : 0;
}

/** Share of the start→target window already elapsed, or null without both dates. */
function timePct(p: Project, day: string) {
  if (!p.start_date || !p.target_date) return null;
  const span = daysBetween(p.start_date, p.target_date);
  if (span <= 0) return day >= p.target_date ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((daysBetween(p.start_date, day) / span) * 100)));
}

export function deadlineLabel(p: Pick<Project, "target_date" | "done_at">, day: string) {
  if (p.done_at) return { text: `${shortDate(p.done_at.slice(0, 10))} 完成`, warn: false };
  if (!p.target_date) return null;
  const left = daysBetween(day, p.target_date);
  if (left < 0) return { text: `已逾期 ${-left} 天`, warn: true };
  if (left === 0) return { text: "今天截止", warn: true };
  return { text: `剩 ${left} 天`, warn: false };
}

/** Progress bar whose fill springs to its new width. */
export function ProgressBar({ pct, label, thin = false, tone = "bg-accent" }: { pct: number; label?: string; thin?: boolean; tone?: string }) {
  const h = thin ? "h-0.5" : "h-2";
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      aria-valuenow={label ? pct : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`${h} overflow-hidden rounded bg-sidebar`}
    >
      <motion.div
        className={`${h} rounded ${tone}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={springs.gentle}
      />
    </div>
  );
}

const SparkIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);

function NewProjectForm() {
  const day = today();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(day);
  const [target, setTarget] = useState(addDays(day, 30));
  const add = useInvalidating("projects", () => addProject(title.trim(), start || null, target || null));
  return (
    <motion.form
      variants={riseIn}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        add.mutate(undefined, { onSuccess: () => setTitle("") });
      }}
    >
      <input
        aria-label="项目名称"
        placeholder="新项目,如「完成毕业论文」……"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${fieldClass} flex-[1_1_260px]`}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        开始
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldClass} w-auto`} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        目标
        <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`${fieldClass} w-auto`} />
      </label>
      <button type="submit" className={primaryButtonClass}>
        添加
      </button>
    </motion.form>
  );
}

/** Skeleton rows that shimmer while DeepSeek is thinking. */
function ThinkingRows() {
  return (
    <div aria-live="polite" className="flex flex-col gap-2 py-1">
      <span className="text-xs text-muted">DeepSeek 正在拆解……</span>
      {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
        <motion.div
          key={i}
          className="h-3.5 rounded bg-cell"
          style={{ width: `${w * 100}%` }}
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Reviews DeepSeek's suggested steps: pick, tweak dates, then add the chosen ones. */
function AiBreakdown({ project, steps, onDone }: { project: Project; steps: Task[]; onDone: () => void }) {
  const [picked, setPicked] = useState<(SuggestedStep & { on: boolean })[]>([]);
  const suggest = useMutation({
    mutationFn: () => suggestSteps(project, steps),
    onSuccess: (s) => setPicked(s.map((x) => ({ ...x, on: true }))),
  });
  const accept = useInvalidating(TASK_KEYS, () => addSteps(project.id, picked.filter((p) => p.on)));
  const chosen = picked.filter((p) => p.on).length;

  useEffect(() => {
    suggest.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={springs.smooth}
      className="flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent-soft/50 p-3"
    >
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink">
        <SparkIcon /> AI 拆解建议
      </div>
      {suggest.isPending && <ThinkingRows />}
      {suggest.isError && <p className="text-[13px] text-warn">{(suggest.error as Error).message ?? String(suggest.error)}</p>}
      {suggest.isSuccess && (
        <motion.ul
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
        >
          {picked.map((s, i) => (
            <motion.li
              key={i}
              variants={{ initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0, transition: springs.smooth } }}
              className="flex min-h-9 items-center gap-2.5"
            >
              <input
                type="checkbox"
                aria-label={`采纳「${s.title}」`}
                className="size-4 shrink-0 accent-accent"
                checked={s.on}
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? { ...p, on: e.target.checked } : p)))}
              />
              <input
                aria-label="步骤标题"
                value={s.title}
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)))}
                className={`min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-sm hover:border-line-strong focus:border-accent focus:outline-none ${
                  s.on ? "" : "text-faint line-through"
                }`}
              />
              <input
                type="date"
                aria-label={`「${s.title}」的截止日期`}
                value={s.due_date ?? ""}
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? { ...p, due_date: e.target.value || null } : p)))}
                className="w-[120px] rounded-md border border-transparent bg-transparent text-xs text-muted tabular-nums hover:border-line-strong"
              />
            </motion.li>
          ))}
          {picked.length === 0 && <li className="text-[13px] text-muted">没有新的建议了</li>}
        </motion.ul>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button className={ghostButtonClass} onClick={onDone}>
          取消
        </button>
        {!suggest.isPending && (
          <button className={ghostButtonClass} onClick={() => suggest.mutate()}>
            重新生成
          </button>
        )}
        {suggest.isSuccess && (
          <button
            className={`${primaryButtonClass} min-h-9`}
            disabled={chosen === 0 || accept.isPending}
            onClick={() => accept.mutate(undefined, { onSuccess: onDone })}
          >
            添加 {chosen} 个步骤
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ProjectNotes({ project }: { project: Project }) {
  const [notes, setNotes] = useState(project.notes ?? "");
  useEffect(() => setNotes(project.notes ?? ""), [project.notes]);
  const save = useInvalidating("projects", (v: string) => updateProject(project.id, { notes: v || null }));
  return (
    <textarea
      aria-label={`「${project.title}」的说明`}
      placeholder="项目说明:目标、约束、已知情况……(AI 拆解时会参考)"
      rows={2}
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => notes !== (project.notes ?? "") && save.mutate(notes.trim())}
      className="w-full resize-y rounded-[10px] border border-line bg-field px-3 py-2 text-[13px] outline-none focus:border-accent"
    />
  );
}

export function ProjectSteps({ project }: { project: Project }) {
  const day = today();
  const { data: steps = [] } = useQuery({
    queryKey: ["tasks", "project", project.id],
    queryFn: () => listProjectTasks(project.id),
  });
  const { data: apiKey } = useSetting("deepseek_api_key");
  const openSettings = useNav((s) => s.setSettingsOpen);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const isNew = useIsNew(steps.map((t) => t.id));
  const add = useInvalidating(TASK_KEYS, () => addTask(title.trim(), due || null, project.id));
  const toggle = useInvalidating(TASK_KEYS, (t: { id: number; done: boolean }) => setTaskDone(t.id, t.done));
  const setStepDue = useInvalidating(TASK_KEYS, (t: { id: number; due: string | null }) => setTaskDue(t.id, t.due));
  const remove = useInvalidating(TASK_KEYS, deleteTask);

  return (
    <div className="flex flex-col gap-2 pt-1">
      {!project.done_at && <ProjectNotes project={project} />}
      <LayoutGroup id={`steps-${project.id}`}>
        <ul>
          <AnimatePresence initial={false}>
            {steps.map((t) => {
              const overdue = !t.done_at && !!t.due_date && t.due_date < day;
              return (
                <motion.li
                  key={t.id}
                  layout="position"
                  initial={enterIf(isNew(t.id))}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 12, transition: { duration: 0.16 } }}
                  transition={springs.smooth}
                  className="group flex min-h-10 items-center gap-3 border-t border-divider"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-[18px] shrink-0 accent-accent"
                      checked={!!t.done_at}
                      onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                    />
                    <span className={`truncate text-sm transition-colors ${t.done_at ? "text-faint line-through" : ""}`}>{t.title}</span>
                  </label>
                  {!t.done_at && (
                    <input
                      type="date"
                      aria-label={`修改「${t.title}」的截止日期`}
                      value={t.due_date ?? ""}
                      onChange={(e) => setStepDue.mutate({ id: t.id, due: e.target.value || null })}
                      className={`w-[120px] rounded-md border border-transparent bg-transparent text-xs tabular-nums group-hover:border-line-strong ${
                        overdue ? "text-warn" : "text-muted"
                      }`}
                    />
                  )}
                  <button
                    className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => remove.mutate(t.id)}
                  >
                    删除
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {steps.length === 0 && !aiOpen && (
            <li className="py-2 text-[13px] text-muted">把项目拆成几个可执行的步骤,或者让 AI 帮你拆解</li>
          )}
        </ul>
      </LayoutGroup>

      <AnimatePresence mode="popLayout">
        {aiOpen && apiKey && <AiBreakdown key="ai" project={project} steps={steps} onDone={() => setAiOpen(false)} />}
        {aiOpen && !apiKey && (
          <motion.div
            key="nokey"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springs.smooth}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-ground p-3 text-[13px] text-ink-2"
          >
            <span className="flex-1">要使用 AI 拆解,先在设置里填入 DeepSeek API Key。</span>
            <button className={ghostButtonClass} onClick={() => setAiOpen(false)}>
              取消
            </button>
            <button className={`${primaryButtonClass} min-h-9`} onClick={() => openSettings(true)}>
              打开设置
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!project.done_at && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            add.mutate(undefined, { onSuccess: () => setTitle("") });
          }}
        >
          <input
            aria-label={`给「${project.title}」添加步骤`}
            placeholder="添加步骤,回车确认"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${fieldClass} flex-[1_1_200px]`}
          />
          <input
            type="date"
            aria-label="步骤截止日期(可选)"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={`${fieldClass} w-auto`}
          />
          {!aiOpen && (
            <button type="button" className={`${ghostButtonClass} flex min-h-11 items-center gap-1.5 px-3.5`} onClick={() => setAiOpen(true)}>
              <SparkIcon /> AI 拆解
            </button>
          )}
        </form>
      )}
    </div>
  );
}

/** Collapsible area that springs open to its content's height. */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="body" variants={collapse} initial="closed" animate="open" exit="closed" className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted"
      animate={{ rotate: open ? 90 : 0 }}
      transition={springs.snappy}
    >
      <path d="M9 6l6 6-6 6" />
    </motion.svg>
  );
}

function ProjectCard({ project, open, onToggle }: { project: Project; open: boolean; onToggle: () => void }) {
  const day = today();
  const pct = progressPct(project);
  const elapsed = timePct(project, day);
  const deadline = deadlineLabel(project, day);
  const behind = elapsed !== null && !project.done_at && elapsed - pct >= 20;
  const setDone = useInvalidating("projects", (done: boolean) => setProjectDone(project.id, done));
  const archive = useInvalidating("projects", () => archiveProject(project.id));
  const remove = useInvalidating(TASK_KEYS, () => deleteProject(project.id));
  const setTarget = useInvalidating("projects", (target: string | null) =>
    updateProject(project.id, { target_date: target }),
  );

  return (
    <motion.section
      layout="position"
      layoutId={`project-${project.id}`}
      transition={springs.smooth}
      className="panel group/card flex flex-col gap-3 rounded-[14px] border border-line bg-surface px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button aria-expanded={open} onClick={onToggle} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left">
          <Chevron open={open} />
          <span className={`truncate text-[15px] font-semibold ${project.done_at ? "text-muted" : ""}`}>{project.title}</span>
        </button>
        {deadline && <span className={`text-xs tabular-nums ${deadline.warn ? "text-warn" : "text-muted"}`}>{deadline.text}</span>}
        <div className="flex gap-1.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          <button className={ghostButtonClass} onClick={() => setDone.mutate(!project.done_at)}>
            {project.done_at ? "重新打开" : "标记完成"}
          </button>
          <button className={ghostButtonClass} onClick={() => archive.mutate(undefined)}>
            归档
          </button>
          <ConfirmButton
            confirmLabel={project.total > 0 ? `连同 ${project.total} 个步骤删除?` : "确认删除"}
            onConfirm={() => remove.mutate(undefined)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar pct={pct} label={`${project.title} 完成度`} />
        {elapsed !== null && <ProgressBar pct={elapsed} thin tone={behind ? "bg-[#c2410c]" : "bg-faint"} />}
        <div className="flex flex-wrap gap-x-3 text-xs text-muted tabular-nums">
          <span>
            步骤 {project.done}/{project.total} · {pct}%
          </span>
          {elapsed !== null && <span className={behind ? "text-warn" : ""}>时间已过 {elapsed}%{behind && ",进度落后"}</span>}
          <span className="flex-1" />
          {project.start_date && <span>{shortDate(project.start_date)} 开始</span>}
          {!project.done_at && (
            <label className="flex items-center gap-1">
              目标
              <input
                type="date"
                aria-label={`修改「${project.title}」的目标日期`}
                value={project.target_date ?? ""}
                onChange={(e) => setTarget.mutate(e.target.value || null)}
                className="rounded-md border border-transparent bg-transparent text-xs text-muted hover:border-line-strong"
              />
            </label>
          )}
        </div>
        <AnimatePresence initial={false}>
          {!open && project.next_step && !project.done_at && (
            <motion.div
              key="next"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={springs.smooth}
              className="truncate text-[13px] text-ink-2"
            >
              下一步:{project.next_step}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Collapsible open={open}>
        <ProjectSteps project={project} />
      </Collapsible>
    </motion.section>
  );
}

function useOpenSet() {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpenIds((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return [openIds, toggle] as const;
}

export function ProjectsView() {
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [openIds, toggle] = useOpenSet();
  const active = projects.filter((p) => !p.done_at);
  const done = projects.filter((p) => p.done_at);

  return (
    <section aria-label="项目" className="flex flex-col gap-4">
      <NewProjectForm />
      {projects.length === 0 && (
        <motion.div variants={riseIn} className="panel rounded-[14px] border border-line bg-surface p-8 text-center text-sm text-muted">
          还没有项目。用项目追踪需要几周或几个月才能完成的事情,并拆成一步步的任务。
        </motion.div>
      )}
      <LayoutGroup>
        {[
          { title: "进行中", items: active },
          { title: "已完成", items: done },
        ].map(
          (g) =>
            g.items.length > 0 && (
              <motion.div key={g.title} variants={riseIn} layout="position" className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted">
                  {g.title} <span className="font-normal">{g.items.length}</span>
                </h2>
                {g.items.map((p) => (
                  <ProjectCard key={p.id} project={p} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} />
                ))}
              </motion.div>
            ),
        )}
      </LayoutGroup>
      <p className="text-xs text-muted">项目步骤就是普通任务:设了日期的步骤也会出现在列表、周视图和今天页。</p>
    </section>
  );
}

/** Home-page version: every active project as a compact row, expandable in place. */
export function ProjectsOverview() {
  const day = today();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [openIds, toggle] = useOpenSet();
  const [title, setTitle] = useState("");
  const active = projects.filter((p) => !p.done_at);
  const add = useInvalidating("projects", () => addProject(title.trim(), day, addDays(day, 30)));
  const finishStep = useInvalidating(TASK_KEYS, (id: number) => setTaskDone(id, true));

  return (
    <div className="flex flex-col gap-1">
      <LayoutGroup id="home-projects">
        <ul>
          <AnimatePresence initial={false}>
            {active.map((p) => {
              const pct = progressPct(p);
              const deadline = deadlineLabel(p, day);
              const open = openIds.has(p.id);
              return (
                <motion.li
                  key={p.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={springs.smooth}
                  className="border-b border-divider py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <button aria-expanded={open} onClick={() => toggle(p.id)} className="flex min-h-8 min-w-0 flex-[1_1_180px] items-center gap-2 text-left">
                      <Chevron open={open} />
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                    </button>
                    <div className="w-[min(220px,30%)] shrink-0">
                      <ProgressBar pct={pct} label={`${p.title} 完成度`} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{pct}%</span>
                    <span className={`w-20 shrink-0 text-right text-xs tabular-nums ${deadline?.warn ? "text-warn" : "text-muted"}`}>
                      {deadline?.text ?? ""}
                    </span>
                  </div>
                  <AnimatePresence initial={false} mode="popLayout">
                    {!open && p.next_step_id !== null && (
                      <motion.label
                        key={p.next_step_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={springs.smooth}
                        className="ml-[22px] mt-1.5 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink-2"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-accent"
                          checked={false}
                          onChange={() => finishStep.mutate(p.next_step_id!)}
                        />
                        <span className="text-muted">下一步</span>
                        {p.next_step}
                      </motion.label>
                    )}
                  </AnimatePresence>
                  <Collapsible open={open}>
                    <div className="pl-[22px]">
                      <ProjectSteps project={p} />
                    </div>
                  </Collapsible>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {active.length === 0 && (
            <li className="py-2 text-sm text-muted">还没有进行中的项目。需要几周或几个月完成的事,可以在这里建一个项目。</li>
          )}
        </ul>
      </LayoutGroup>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate(undefined, { onSuccess: () => setTitle("") });
        }}
      >
        <input
          aria-label="新建项目"
          placeholder="新建项目(默认 30 天),回车确认"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
      </form>
    </div>
  );
}
