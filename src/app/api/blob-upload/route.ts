// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: POST /api/blob-upload — token endpoint for the browser's direct upload to Vercel Blob (@vercel/blob/client):
//           the "check your own car" video skips the 4.5 MB function body limit. Only video/*, ≤150 MB, under uploads/; the run deletes it afterwards.
// @created: 2026-11-03
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkLimit, clientIp } from "@/lib/runtime/rateLimit";
export const runtime = "nodejs";

const VIDEO_MAX_BYTES = 150 * 1024 * 1024;

export async function POST(req: Request) {
  if (process.env.RUN_DISABLED === "1") return Response.json({ error: "live runs are paused" }, { status: 503 });
  let body: HandleUploadBody;
  try { body = (await req.json()) as HandleUploadBody; } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  // token requests count against the same per-address budget as runs; completion callbacks come from Vercel Blob itself
  if (body.type === "blob.generate-client-token") {
    const limited = checkLimit("blob-upload", clientIp(req), Number(process.env.UPLOAD_PER_IP_HOUR ?? 2) * 2, Number(process.env.UPLOAD_DAILY_CAP ?? 15) * 2);
    if (limited) return Response.json({ error: limited }, { status: 429 });
  }
  try {
    const res = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^uploads\/[\w.-]{1,120}$/.test(pathname)) throw new Error("bad pathname");
        return { allowedContentTypes: ["video/*"], maximumSizeInBytes: VIDEO_MAX_BYTES, addRandomSuffix: true, validUntil: Date.now() + 15 * 60_000 };
      },
      onUploadCompleted: async () => { /* the run fetches the file by URL and deletes it */ },
    });
    return Response.json(res);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "upload refused" }, { status: 400 });
  }
}
