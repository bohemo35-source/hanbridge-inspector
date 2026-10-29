// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Baseten open-weight client (meta-models/muse-spark-open-1026) for the independent verifier
// @created: 2026-10-29
import type { ZodType } from "zod";
import type { ChatMessage } from "./spark";

export const SPARK_OPEN_MODEL = "meta-models/muse-spark-open-1026";

export class SparkOpenError extends Error { code: string; constructor(code: string, msg?: string) { super(msg ?? code); this.code = code; } }

export async function sparkOpenChat(opts: { messages: ChatMessage[]; maxTokens?: number }): Promise<string> {
  const key = process.env.BASETEN_API_KEY;
  if (!key) throw new SparkOpenError("missing_api_key", "BASETEN_API_KEY is not set");
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch("https://inference.baseten.co/v1/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: SPARK_OPEN_MODEL, messages: opts.messages, max_tokens: opts.maxTokens ?? 2000 }),
    });
    console.log(JSON.stringify({ model: SPARK_OPEN_MODEL, path: "baseten/chat/completions", ms: Date.now() - t0, status: res.status }));
    if (!res.ok) throw new SparkOpenError("http_error", `Baseten ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const raw = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = raw.choices?.[0]?.message?.content ?? "";
    if (!content) throw new SparkOpenError("empty_content", "muse-spark-open-1026 returned empty content");
    return content;
  } finally { clearTimeout(timer); }
}

function stripFences(s: string): string { const m = s.match(/```(?:json)?\s*([\s\S]*?)```/); return (m ? m[1] : s).trim(); }

export async function sparkOpenJson<T>(schema: ZodType<T>, messages: ChatMessage[], spec?: string): Promise<T> {
  const sys: ChatMessage[] = [{ role: "system", content: "Reply with strictly valid JSON only. No markdown, no commentary." + (spec ? `\n${spec}` : "") }, ...messages];
  const text = await sparkOpenChat({ messages: sys, maxTokens: 2500 });
  try {
    const v = schema.safeParse(JSON.parse(stripFences(text)));
    if (v.success) return v.data;
    throw new SparkOpenError("invalid_json", v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  } catch (e) {
    if (e instanceof SparkOpenError) throw e;
    throw new SparkOpenError("invalid_json", e instanceof Error ? e.message : "parse error");
  }
}
