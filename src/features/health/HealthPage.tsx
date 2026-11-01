import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, formatMinutes, today } from "../../data/db";
import { addHealthLog, deleteHealthLog, listHealthLogs, type HealthKind, type HealthLog } from "../../data/health";
import { useInvalidating } from "../../data/useInvalidating";
import { BarChart, Card, EmptyState, PageHeader, Segmented, Stat, fieldClass, primaryButtonClass } from "../../components/Card";

const SLEEP_GOAL_MIN = 7 * 60;
const STEPS_GOAL = 8000;

const KIND_LABEL: Record<HealthKind, string> = { sleep: "睡眠", steps: "步数", weight: "体重", workout: "运动" };

/** Accepts "7:20" or "7.5" (hours) and returns minutes. */
function parseSleep(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2})[:：](\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const h = Number(input);
  return Number.isFinite(h) && h > 0 && h < 24 ? Math.round(h * 60) : null;
}

function describe(log: HealthLog) {
  switch (log.kind) {
    case "sleep":
      return formatMinutes(log.value);
    case "steps":
      return `${log.value.toLocaleString("en-US")} 步`;
    case "weight":
      return `${log.value} kg`;
    case "workout":
      return `${log.note ?? "运动"} · ${log.value} 分钟`;
  }
}

function RecordForm() {
  const [kind, setKind] = useState<HealthKind>("sleep");
  const [value, setValue] = useState("");
  const [activity, setActivity] = useState("");
  const [day, setDay] = useState(today());

  const parsed =
    kind === "sleep" ? parseSleep(value) : Number(value) > 0 ? Number(value) : null;
  const save = useInvalidating("health", () =>
    addHealthLog(day, kind, parsed!, kind === "workout" ? activity.trim() || "运动" : null),
  );
  const placeholder = { sleep: "7:20 或 7.5", steps: "例如 8000", weight: "kg,例如 64.2", workout: "分钟,例如 30" }[kind];

  return (
    <Card title="记录" className="flex-[1_1_280px] self-start">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed === null) return;
          save.mutate(undefined, { onSuccess: () => setValue("") });
        }}
      >
        <Segmented
          label="类型"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setValue("");
          }}
          options={(Object.keys(KIND_LABEL) as HealthKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
        {kind === "workout" && (
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            项目
            <input placeholder="跑步、游泳……" value={activity} onChange={(e) => setActivity(e.target.value)} className={`${fieldClass} text-ink`} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          {kind === "sleep" ? "时长(小时:分钟)" : KIND_LABEL[kind]}
          <input
            inputMode="decimal"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${fieldClass} text-ink`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          {kind === "sleep" ? "醒来的日期" : "日期"}
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${fieldClass} text-ink`} />
        </label>
        <button type="submit" disabled={parsed === null} className={primaryButtonClass}>
          保存
        </button>
      </form>
    </Card>
  );
}

function WeightChart({ points }: { points: HealthLog[] }) {
  if (points.length < 2) return <EmptyState>记录两次以上体重后显示趋势</EmptyState>;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals) - 0.5;
  const hi = Math.max(...vals) + 0.5;
  const xy = points.map((p, i) => ({
    x: 12 + (i * 296) / (points.length - 1),
    y: 10 + ((hi - p.value) / (hi - lo)) * 100,
  }));
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <>
      <svg
        role="img"
        aria-label={`体重从 ${first.value} 公斤变为 ${last.value} 公斤`}
        viewBox="0 0 320 120"
        className="h-[140px] w-full"
      >
        <polyline
          points={xy.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--color-accent)" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted tabular-nums">
        <span>
          {first.day.slice(5)} · {first.value}
        </span>
        <span>
          {last.day.slice(5)} · {last.value}
        </span>
      </div>
    </>
  );
}

export function HealthPage() {
  const day = today();
  const since = addDays(day, -89);
  const { data: logs = [] } = useQuery({ queryKey: ["health", since], queryFn: () => listHealthLogs(since) });
  const remove = useInvalidating("health", deleteHealthLog);

  const byKind = (k: HealthKind) => logs.filter((l) => l.kind === k);
  const nights = Array.from({ length: 14 }, (_, i) => addDays(day, i - 13));
  const sleepByDay = new Map(byKind("sleep").map((l) => [l.day, l.value]));
  const sleepVals = nights.map((d) => sleepByDay.get(d)).filter((v): v is number => v !== undefined);
  const avgSleep = sleepVals.length ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : null;

  const recentSteps = byKind("steps").filter((l) => l.day >= addDays(day, -13));
  const avgSteps = recentSteps.length ? recentSteps.reduce((a, l) => a + l.value, 0) / recentSteps.length : null;
  const week = byKind("workout").filter((l) => l.day >= addDays(day, -6));
  const weights = byKind("weight");
  const latestWeight = weights[0];

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <PageHeader title="健康" />

      <div className="flex flex-wrap gap-4">
        <Stat label="平均睡眠" value={avgSleep ? formatMinutes(avgSleep) : "—"} sub={`近 14 晚 · 记录 ${sleepVals.length} 晚`} />
        <Stat
          label="日均步数"
          value={avgSteps ? Math.round(avgSteps).toLocaleString("en-US") : "—"}
          sub={`目标 ${STEPS_GOAL.toLocaleString("en-US")}`}
        />
        <Stat label="近 7 天运动" value={`${week.length} 次`} sub={`共 ${week.reduce((a, l) => a + l.value, 0)} 分钟`} />
        <Stat
          label="体重"
          value={latestWeight ? `${latestWeight.value} kg` : "—"}
          sub={latestWeight ? `记录于 ${latestWeight.day.slice(5)}` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card title="睡眠时长" className="flex-[3_1_460px]" aside={<span className="text-xs text-muted">目标 7 小时</span>}>
          <BarChart
            label={`近 14 晚睡眠时长柱状图,其中 ${sleepVals.filter((v) => v >= SLEEP_GOAL_MIN).length} 晚达到 7 小时`}
            max={9 * 60}
            refLine={SLEEP_GOAL_MIN}
            bars={nights.map((d) => {
              const v = sleepByDay.get(d) ?? 0;
              return {
                key: d,
                value: v,
                label: String(Number(d.slice(8))),
                title: v ? `${d}:${formatMinutes(v)}` : `${d}:未记录`,
                tone: v >= SLEEP_GOAL_MIN ? "bg-accent" : "bg-[#e8a27c]",
              };
            })}
          />
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-accent" />
              达到目标
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#e8a27c]" />
              不足 7 小时
            </span>
          </div>
        </Card>
        <RecordForm />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card title="体重" className="flex-[1_1_320px]">
          <WeightChart points={weights.slice(0, 12).reverse()} />
        </Card>
        <Card title="最近记录" className="flex-[1_1_320px]">
          {logs.length === 0 ? (
            <EmptyState>还没有健康记录</EmptyState>
          ) : (
            <ul>
              {logs.slice(0, 12).map((l) => (
                <li key={l.id} className="group flex min-h-11 items-center gap-3 border-t border-divider text-sm first:border-t-0">
                  <span className="w-11 text-xs text-muted tabular-nums">{l.day.slice(5).replace("-", "/")}</span>
                  <span className="w-10 text-muted">{KIND_LABEL[l.kind]}</span>
                  <span className="flex-1 tabular-nums">{describe(l)}</span>
                  <button
                    className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => remove.mutate(l.id)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
