// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: POST /api/expert/chat — answers only from report data, EN/RU, no invented customs numbers
// @created: 2026-10-27
import { NextResponse } from "next/server";
import { z } from "zod";
import { sparkChat } from "@/lib/meta/spark";
import { ReportSchema } from "@/lib/schema";
import { getReport } from "@/lib/store/reports";
export const runtime = "nodejs";
export const maxDuration = 60;

const InputSchema = z.object({
  reportId: z.string().optional(),
  report: ReportSchema.optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })).optional(),
  message: z.string().optional(),
});

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
  const report = parsed.data.report ?? (parsed.data.reportId ? getReport(parsed.data.reportId) : undefined);
  if (!report) return NextResponse.json({ error: "report not found: pass reportId of an analyzed report or a full report object" }, { status: 404 });
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
