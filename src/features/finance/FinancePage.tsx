import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, formatMoney, today } from "../../data/db";
import {
  addTransaction,
  deleteTransaction,
  listCategories,
  listTransactions,
  monthlyExpenses,
  setCategoryBudget,
  type Category,
} from "../../data/finance";
import { useInvalidating } from "../../data/useInvalidating";
import {
  BarChart,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  Stat,
  fieldClass,
  ghostButtonClass,
  primaryButtonClass,
} from "../../components/Card";

const INCOME_CATEGORY = "收入";

/** Parses "32" / "32.5" / "1,200" into cents; null when invalid or not positive. */
function parseCents(input: string): number | null {
  const n = Number(input.replace(/[,¥\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

function RecordForm({ categories }: { categories: Category[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today());
  const options = categories.filter((c) => (kind === "income") === (c.name === INCOME_CATEGORY));
  const selected = categoryId === "" ? options[0]?.id ?? null : categoryId;
  const cents = parseCents(amount);
  const save = useInvalidating("finance", () =>
    addTransaction(day, kind === "income" ? cents! : -cents!, selected, note.trim() || null),
  );

  return (
    <Card title="记一笔" className="flex-[1_1_280px] self-start">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (cents === null) return;
          save.mutate(undefined, {
            onSuccess: () => {
              setAmount("");
              setNote("");
            },
          });
        }}
      >
        <Segmented
          label="类型"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId("");
          }}
          options={[
            { value: "expense", label: "支出" },
            { value: "income", label: "收入" },
          ]}
        />
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          金额
          <input
            inputMode="decimal"
            placeholder="¥0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${fieldClass} min-h-12 text-xl font-semibold text-ink`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          分类
          <select
            value={selected ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className={`${fieldClass} text-ink`}
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          备注
          <input placeholder="可选" value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} text-ink`} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          日期
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${fieldClass} text-ink`} />
        </label>
        <button type="submit" disabled={cents === null} className={primaryButtonClass}>
          保存
        </button>
      </form>
    </Card>
  );
}

function BudgetCard({ categories, spentBy }: { categories: Category[]; spentBy: Map<number, number> }) {
  const [editing, setEditing] = useState(false);
  const saveBudget = useInvalidating("finance", (c: { id: number; cents: number | null }) =>
    setCategoryBudget(c.id, c.cents),
  );
  const rows = categories.filter((c) => c.name !== INCOME_CATEGORY);

  return (
    <Card
      title="分类预算"
      className="flex-[1_1_380px]"
      aside={
        <button className={ghostButtonClass} onClick={() => setEditing(!editing)}>
          {editing ? "完成" : "设置预算"}
        </button>
      }
    >
      {rows.map((c) => {
        const spent = spentBy.get(c.id) ?? 0;
        const pct = c.budget_cents ? Math.round((spent / c.budget_cents) * 100) : null;
        const warn = pct !== null && pct >= 80;
        return (
          <div key={c.id}>
            <div className="mb-1.5 flex items-center gap-2 text-[13px] tabular-nums">
              <span className="flex-1">{c.name}</span>
              {editing ? (
                <input
                  aria-label={`${c.name} 每月预算`}
                  inputMode="decimal"
                  placeholder="不设预算"
                  defaultValue={c.budget_cents ? String(c.budget_cents / 100) : ""}
                  onBlur={(e) => saveBudget.mutate({ id: c.id, cents: parseCents(e.target.value) })}
                  className="h-8 w-28 rounded-md border border-line-strong bg-field px-2 text-right"
                />
              ) : (
                <span>
                  {formatMoney(spent)}
                  {c.budget_cents !== null && <span className="text-muted"> / {formatMoney(c.budget_cents)}</span>}
                </span>
              )}
            </div>
            {c.budget_cents !== null && (
              <div className="h-2 rounded bg-sidebar">
                <div
                  className={`h-2 rounded ${warn ? "bg-[#c2410c]" : "bg-accent"}`}
                  style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                />
              </div>
            )}
            {warn && <div className="mt-1 text-xs text-warn">已用 {pct}%</div>}
          </div>
        );
      })}
    </Card>
  );
}

export function FinancePage() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data: categories = [] } = useQuery({ queryKey: ["finance", "categories"], queryFn: listCategories });
  const { data: txs = [] } = useQuery({ queryKey: ["finance", "tx", month], queryFn: () => listTransactions(month) });
  const fromMonth = addMonths(month, -5);
  const { data: monthly = [] } = useQuery({
    queryKey: ["finance", "monthly", fromMonth],
    queryFn: () => monthlyExpenses(fromMonth),
  });
  const remove = useInvalidating("finance", deleteTransaction);

  const expense = txs.filter((t) => t.amount_cents < 0).reduce((s, t) => s - t.amount_cents, 0);
  const income = txs.filter((t) => t.amount_cents > 0).reduce((s, t) => s + t.amount_cents, 0);
  const budget = categories.reduce((s, c) => s + (c.budget_cents ?? 0), 0);
  const spentBy = new Map<number, number>();
  for (const t of txs) {
    if (t.amount_cents < 0 && t.category_id !== null) {
      spentBy.set(t.category_id, (spentBy.get(t.category_id) ?? 0) - t.amount_cents);
    }
  }

  const months = Array.from({ length: 6 }, (_, i) => addMonths(fromMonth, i));
  const totals = new Map(monthly.map((m) => [m.month, m.total]));
  const maxBar = Math.max(budget / 100, ...months.map((m) => (totals.get(m) ?? 0) / 100), 1);
  const isCurrent = month === today().slice(0, 7);

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <PageHeader title="财务">
        <div className="flex items-center gap-1">
          <button aria-label="上个月" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setMonth(addMonths(month, -1))}>
            ‹
          </button>
          <span className="min-w-28 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <button aria-label="下个月" className={`${ghostButtonClass} size-10 px-0`} onClick={() => setMonth(addMonths(month, 1))}>
            ›
          </button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-4">
        <Stat label="本月支出" value={formatMoney(expense)} sub={budget ? `预算 ${formatMoney(budget)}` : "未设预算"} />
        <Stat label="本月收入" value={formatMoney(income)} tone="text-[#0f766e]" />
        <Stat
          label="结余"
          value={`${income - expense < 0 ? "−" : ""}${formatMoney(income - expense)}`}
          sub={income > 0 ? `储蓄率 ${Math.round(((income - expense) / income) * 100)}%` : undefined}
        />
        <Stat
          label="预算剩余"
          value={budget ? `${budget - expense < 0 ? "−" : ""}${formatMoney(budget - expense)}` : "—"}
          tone={budget && budget < expense ? "text-warn" : "text-ink"}
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <BudgetCard categories={categories} spentBy={spentBy} />
        <Card title="近 6 个月支出" className="flex-[1_1_380px]">
          <BarChart
            label="近 6 个月每月支出柱状图"
            max={maxBar}
            refLine={budget ? budget / 100 : undefined}
            bars={months.map((m, i) => {
              const v = (totals.get(m) ?? 0) / 100;
              return {
                key: m,
                value: v,
                label: `${Number(m.slice(5))}月`,
                title: `${monthLabel(m)}:¥${v.toFixed(2)}`,
                tone: i === 5 && isCurrent ? "bg-[#9db1e8]" : "bg-accent",
              };
            })}
          />
          {budget > 0 && <p className="text-xs text-muted">虚线为每月预算 {formatMoney(budget)}</p>}
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card title="本月流水" className="flex-[2_1_480px]">
          {txs.length === 0 ? (
            <EmptyState>这个月还没有记录</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2 font-medium">日期</th>
                    <th className="py-2 font-medium">说明</th>
                    <th className="py-2 font-medium">分类</th>
                    <th className="py-2 text-right font-medium">金额</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id} className="group border-t border-divider">
                      <td className="py-2.5 text-muted">{t.day.slice(5).replace("-", "/")}</td>
                      <td className="py-2.5">{t.note ?? "—"}</td>
                      <td className="py-2.5">
                        <span className="rounded-md bg-ground px-2 py-0.5 text-ink-2">{t.category ?? "未分类"}</span>
                      </td>
                      <td className={`py-2.5 text-right font-semibold ${t.amount_cents > 0 ? "text-[#0f766e]" : ""}`}>
                        {t.amount_cents > 0 ? "+" : "−"}
                        {formatMoney(t.amount_cents)}
                      </td>
                      <td className="text-right">
                        <button
                          className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => remove.mutate(t.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <RecordForm categories={categories} />
      </div>
    </div>
  );
}
