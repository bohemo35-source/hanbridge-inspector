// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Small in-memory limits for the public demo (per Vercel instance): per-IP sliding window + daily cap.
//           Protects paid Meta calls and the Vercel Blob Hobby op budget during judging. Not a security boundary.
// @created: 2026-11-02
const windows = new Map<string, number[]>();
const daily = new Map<string, { day: string; n: number }>();

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

/** null = allowed; otherwise a human-readable reason (HTTP 429). */
export function checkLimit(bucket: string, ip: string, perHour: number, perDay: number): string | null {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const hits = (windows.get(key) ?? []).filter((t) => now - t < 3_600_000);
  const day = new Date().toISOString().slice(0, 10);
  const d = daily.get(bucket);
  const today = d && d.day === day ? d : { day, n: 0 };
  if (hits.length >= perHour) return `limit: ${perHour} per hour from one address — open a ready report instead`;
  if (today.n >= perDay) return `daily limit of live runs reached — ready reports stay available`;
  windows.set(key, [...hits, now]);
  daily.set(bucket, { day, n: today.n + 1 });
  return null;
}
