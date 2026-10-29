// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Muse Glimmer 30B (Meta open weights, Apache 2.0) served by us on Modal (vLLM, infra/modal/glimmer_vllm.py).
//           OpenAI-compatible; the model prints its reasoning channel inline — we keep only the final answer.
// @created: 2026-10-29
import type { ZodType } from "zod";
import type { ChatMessage } from "./spark";

export const GLIMMER_MODEL = "muse-glimmer-30b";

export class GlimmerError extends Error { code: string; constructor(code: string, msg?: string) { super(msg ?? code); this.code = code; } }

export const glimmerConfigured = () => Boolean(process.env.GLIMMER_BASE_URL && process.env.GLIMMER_API_KEY);

/** Final answer only: Glimmer emits "…analysis… assistant to=user<answer>" (harmony-style channels). */
export function finalAnswer(content: string): string {
  const marker = /(?:assistant\s*)?to=user/gi;
  let last = -1;
  for (const m of content.matchAll(marker)) last = (m.index ?? 0) + m[0].length;
  const out = last >= 0 ? content.slice(last) : content;
  return out.replace(/^[\s:>-]+/, "").trim();
}

export async function glimmerChat(opts: { messages: ChatMessage[]; maxTokens?: number; timeoutMs?: number; reasoning?: "low" | "medium" | "high" }): Promise<string> {
  const base = process.env.GLIMMER_BASE_URL;
  const key = process.env.GLIMMER_API_KEY;
  if (!base || !key) throw new GlimmerError("not_configured", "GLIMMER_BASE_URL / GLIMMER_API_KEY not set");
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90000);
  try {
    const messages: ChatMessage[] = [{ role: "system", content: `Reasoning strength: ${opts.reasoning ?? "low"}` }, ...opts.messages];
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: GLIMMER_MODEL, messages, max_tokens: opts.maxTokens ?? 1500, temperature: 0.2 }),
    });
    console.log(JSON.stringify({ model: GLIMMER_MODEL, path: "modal/chat/completions", ms: Date.now() - t0, status: res.status }));
    if (!res.ok) throw new GlimmerError("http_error", `Glimmer ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const raw = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = finalAnswer(raw.choices?.[0]?.message?.content ?? "");
    if (!content) throw new GlimmerError("empty_content", "muse-glimmer-30b returned empty content");
    return content;
  } finally { clearTimeout(timer); }
}

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const a = s.indexOf("{"); const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s.trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function glimmerJson<T>(schema: ZodType<T, any, any>, messages: ChatMessage[], spec: string, opts: { timeoutMs?: number; maxTokens?: number } = {}): Promise<T> {
  const sys: ChatMessage[] = [{ role: "system", content: `Reply with strictly valid JSON only, no markdown.\n${spec}` }, ...messages];
  const text = await glimmerChat({ messages: sys, maxTokens: opts.maxTokens ?? 1500, timeoutMs: opts.timeoutMs });
  let parsed: unknown;
  try { parsed = JSON.parse(extractJson(text)); } catch (e) { throw new GlimmerError("invalid_json", `${e instanceof Error ? e.message : "parse"}: ${text.slice(0, 120)}`); }
  const v = schema.safeParse(parsed);
  if (!v.success) throw new GlimmerError("invalid_json", v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return v.data;
}
