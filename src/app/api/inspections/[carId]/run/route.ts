// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: POST /api/inspections/:carId/run — SSE stream of agent steps, then done{reportId, verdict}
// @created: 2026-10-29
// @updated: 2026-11-02 claude: kill switch, per-IP/daily limits, unknown/empty car -> 404, closed-stream safe, reports cache refresh
import { revalidateTag } from "next/cache";
import { carMedia, getCar } from "@/lib/agent/catalog";
import { runInspection } from "@/lib/agent/orchestrator";
import { checkLimit, clientIp } from "@/lib/runtime/rateLimit";
export const runtime = "nodejs";
export const maxDuration = 300;

const json = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request, ctx: { params: Promise<{ carId: string }> }) {
  const { carId } = await ctx.params;
  if (process.env.RUN_DISABLED === "1") return json(503, "live runs are paused — ready reports stay available");
  if (!getCar(carId) || carMedia(carId).photos.length === 0) return json(404, `no inspection media for ${carId}`);
  const limited = checkLimit("run", clientIp(req), Number(process.env.RUN_PER_IP_HOUR ?? 3), Number(process.env.RUN_DAILY_CAP ?? 60));
  if (limited) return json(429, limited);

  const enc = new TextEncoder();
  let open = true;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { open = false; }
      };
      try {
        const { report, ms } = await runInspection({ carId, onStep: (s) => send("step", s) });
        try { revalidateTag("reports"); } catch { /* outside a Next request */ }
        send("done", { reportId: report.id, verdict: report.verdict, findings: report.findings.length, verified: report.findings.filter((f) => f.verified).length, ms, url: `/r/${report.id}` });
      } catch (e) {
        send("error", { error: e instanceof Error ? e.message : "run failed" });
      } finally { if (open) { open = false; try { controller.close(); } catch { /* already closed */ } } }
    },
    cancel() { open = false; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
