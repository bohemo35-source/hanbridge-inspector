// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: POST /api/expert/chat — answers only from report data, EN/RU, no invented customs numbers
// @created: 2026-10-27
// @updated: 2026-11-02 claude: report loaded server-side by id only (no client JSON / system roles), size + rate limits
import { NextResponse } from "next/server";
import { z } from "zod";
import { sparkChat } from "@/lib/meta/spark";
import { getReportAsync } from "@/lib/store/reports";
import { checkLimit, clientIp } from "@/lib/runtime/rateLimit";
export const runtime = "nodejs";
export const maxDuration = 60;

const Msg = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) });
const InputSchema = z.object({
  reportId: z.string().max(100),
  messages: z.array(Msg).max(10).optional(),
  history: z.array(Msg).max(10).optional(),
  message: z.string().max(1000).optional(),
}).passthrough();

const CUSTOMS_RE = /растамож|тамож|customs|сколько будет|landed cost|итогов.*стоим/i;

export async function POST(req: Request) {
  const parsed = InputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  const history = parsed.data.messages ?? parsed.data.history ?? (parsed.data.message ? [{ role: "user" as const, content: parsed.data.message }] : []);
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const isRu = /[а-яё]/i.test(lastUser);
  if (CUSTOMS_RE.test(lastUser)) {
    return NextResponse.json({ answer: isRu ? "Точную стоимость растаможки посчитает менеджер — я не называю цифры без подтверждённого расчёта." : "A manager will calculate the exact customs cost — I do not quote figures without a confirmed calculation." });
  }
  const limited = checkLimit("chat", clientIp(req), 30, 600);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const report = await getReportAsync(parsed.data.reportId);
  if (!report) return NextResponse.json({ error: "report not found" }, { status: 404 });
  try {
    const res = await sparkChat({
      messages: [
        { role: "system", content: `Answer ONLY from this inspection report JSON. Never invent numbers, prices or customs costs. If asked about customs/landed cost, say a manager will calculate it, with no figures. Reply in the language of the user's last message (EN or RU). Report: ${JSON.stringify(report)}` },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return NextResponse.json({ answer: res.content });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat failed" }, { status: 502 });
  }
}
