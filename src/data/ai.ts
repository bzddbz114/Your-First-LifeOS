import { invoke } from "@tauri-apps/api/core";
import { today } from "./db";
import { getSetting } from "./settings";
import type { Project } from "./projects";
import type { Task } from "./tasks";

export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

export interface SuggestedStep {
  title: string;
  due_date: string | null;
}

const SYSTEM_PROMPT = `你是一名务实的项目规划助手。用户会给你一个需要几周到几个月完成的个人项目,你要把它拆解成可执行的步骤。
要求:
- 4 到 10 个步骤,按执行顺序排列;每个步骤是一个具体、可在一次专注时间内推进的动作,以动词开头,不超过 20 个字。
- 如果给出了起止日期,为每个步骤安排一个合理的截止日期(YYYY-MM-DD),均匀分布在今天(或开始日期,取较晚者)到目标日期之间;没有目标日期时 due_date 为 null。
- 不要重复用户已有的步骤。
- 只输出 JSON,格式为:{"steps":[{"title":"...","due_date":"YYYY-MM-DD 或 null"}]}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Asks DeepSeek to break `project` into steps, skipping the ones it already has. */
export async function suggestSteps(project: Project, existing: Task[]): Promise<SuggestedStep[]> {
  const [apiKey, model] = await Promise.all([getSetting("deepseek_api_key"), getSetting("deepseek_model")]);
  if (!apiKey) throw new Error("还没有设置 DeepSeek API Key");

  const lines = [
    `项目:${project.title}`,
    project.notes && `说明:${project.notes}`,
    `今天:${today()}`,
    project.start_date && `开始日期:${project.start_date}`,
    project.target_date && `目标日期:${project.target_date}`,
    existing.length > 0 && `已有步骤:\n${existing.map((t) => `- ${t.title}${t.done_at ? "(已完成)" : ""}`).join("\n")}`,
  ].filter(Boolean);

  const reply = await invoke<string>("deepseek_chat", {
    apiKey,
    model: model || DEFAULT_DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: lines.join("\n") },
    ],
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    throw new Error("DeepSeek 的回复不是有效的 JSON,请重试");
  }
  const steps = (parsed as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) throw new Error("DeepSeek 的回复里没有步骤,请重试");
  return steps
    .map((s) => ({
      title: typeof s?.title === "string" ? s.title.trim() : "",
      due_date: typeof s?.due_date === "string" && DATE_RE.test(s.due_date) ? s.due_date : null,
    }))
    .filter((s) => s.title);
}
