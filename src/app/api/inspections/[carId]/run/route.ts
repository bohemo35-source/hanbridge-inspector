// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: POST /api/inspections/:carId/run — SSE stream of agent steps, then done{reportId, verdict}
// @created: 2026-10-29
import { runInspection } from "@/lib/agent/orchestrator";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ carId: string }> }) {
  const { carId } = await ctx.params;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const { report, ms } = await runInspection({ carId, onStep: (s) => send("step", s) });
        send("done", { reportId: report.id, verdict: report.verdict, findings: report.findings.length, verified: report.findings.filter((f) => f.verified).length, ms, url: `/r/${report.id}` });
      } catch (e) {
        send("error", { error: e instanceof Error ? e.message : "run failed" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
