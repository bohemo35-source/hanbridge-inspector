// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Muse Spark chat + JSON helpers (reasoning_effort low, max_tokens 2000)
// @created: 2026-10-27
import type { ZodType } from "zod";
import { metaFetch, MetaApiError } from "./client";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | ChatPart[] | null; tool_call_id?: string; tool_calls?: ToolCall[] };
export type ToolDef = { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } };
export type ToolCall = { id: string; type: string; function: { name: string; arguments: string } };

export type SparkResult = {
  content: string | null;
  toolCalls: ToolCall[];
  raw: unknown;
};

export async function sparkChat(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  json?: boolean;
  /** default 2000; raise for long structured outputs (Spark reasons first, empty content = budget exhausted) */
  maxTokens?: number;
}): Promise<SparkResult> {
  const attempt = async (): Promise<SparkResult> => {
    const res = await metaFetch("/chat/completions", {
      method: "POST",
      model: "muse-spark-1.3",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "muse-spark-1.3",
        messages: opts.messages,
        reasoning_effort: "low",
        temperature: 0,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.tools ? { tools: opts.tools } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const raw = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
    };
    const msg = raw.choices?.[0]?.message;
    return { content: msg?.content ?? null, toolCalls: msg?.tool_calls ?? [], raw };
  };

  let result = await attempt();
  if ((result.content === null || result.content === "") && result.toolCalls.length === 0) {
    result = await attempt();
  }
  if ((result.content === null || result.content === "") && result.toolCalls.length === 0) {
    throw new MetaApiError("empty_content", "muse-spark-1.3 returned empty content");
  }
  return result;
}

function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
}

export async function sparkJson<T>(schema: ZodType<T>, messages: ChatMessage[], spec?: string, opts: { maxTokens?: number } = {}): Promise<T> {
  const rules = "Reply with strictly valid JSON only. No markdown, no commentary." + (spec ? `\n${spec}` : "");
  const sys: ChatMessage[] = [{ role: "system", content: rules }, ...messages];
  const first = await sparkChat({ messages: sys, json: true, maxTokens: opts.maxTokens });
  const tryParse = (text: string): { ok: true; value: T } | { ok: false; error: string } => {
    try {
      const parsed: unknown = JSON.parse(stripFences(text));
      const v = schema.safeParse(parsed);
      if (v.success) return { ok: true, value: v.data };
      return { ok: false, error: v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JSON parse error" };
    }
  };
  const a = tryParse(first.content ?? "");
  if (a.ok) return a.value;
  const second = await sparkChat({
    messages: [
      ...sys,
      { role: "assistant", content: first.content ?? "" },
      { role: "user", content: `Your previous JSON failed validation: ${a.error}. Return corrected JSON only, exactly matching the required shape.${spec ? `\n${spec}` : ""}` },
    ],
    json: true,
    maxTokens: opts.maxTokens,
  });
  const b = tryParse(second.content ?? "");
  if (b.ok) return b.value;
  throw new MetaApiError("invalid_json", `sparkJson validation failed: ${b.error}`);
}
