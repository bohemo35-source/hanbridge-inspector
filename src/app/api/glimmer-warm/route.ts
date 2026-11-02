// @agent:   claude
// @project: hanbridge-inspector
// @purpose: GET /api/glimmer-warm — wakes our Muse Glimmer GPU container on Modal while the visitor fills the upload form,
//           so the live photo index does not hit a cold start. At most one ping per minute per instance; never waits for the answer.
// @created: 2026-11-02
import { glimmerConfigured } from "@/lib/meta/glimmer";
export const runtime = "nodejs";

let last = 0;
export async function GET() {
  const base = process.env.GLIMMER_BASE_URL; const key = process.env.GLIMMER_API_KEY;
  if (!glimmerConfigured() || !base || !key) return Response.json({ warm: false, reason: "not configured" });
  if (Date.now() - last < 60_000) return Response.json({ warm: "recent" });
  last = Date.now();
  // the request itself makes Modal start a container; we stop waiting after 3 s
  await fetch(`${base.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000) }).catch(() => undefined);
  return Response.json({ warm: "requested" });
}
