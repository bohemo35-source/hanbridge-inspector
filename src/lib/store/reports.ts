// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Report store: Vercel Blob reports/{id}.json when BLOB_READ_WRITE_TOKEN set, else local data/reports/*.json (+ in-memory cache)
// @created: 2026-10-27
// @updated: 2026-10-29 muse-code
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ReportSchema, type Report } from "@/lib/schema";

const cache = new Map<string, Report>();
const localDir = () => path.join(process.cwd(), "data", "reports");

export function saveReport(r: Report): void {
  cache.set(r.id, r);
  try { mkdirSync(localDir(), { recursive: true }); writeFileSync(path.join(localDir(), `${r.id}.json`), JSON.stringify(r)); } catch { /* read-only fs (Vercel) — Blob path below */ }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    void import("@vercel/blob").then(({ put }) =>
      put(`reports/${r.id}.json`, JSON.stringify(r), { access: "public", contentType: "application/json", addRandomSuffix: false }).catch(() => undefined));
  }
}

export function getReport(id: string): Report | undefined {
  const hit = cache.get(id); if (hit) return hit;
  try {
    const raw = readFileSync(path.join(localDir(), `${id}.json`), "utf8");
    const parsed = ReportSchema.safeParse(JSON.parse(raw));
    if (parsed.success) { cache.set(id, parsed.data); return parsed.data; }
  } catch { /* not local */ }
  return undefined;
}

/** Async variant that can reach Blob (used by the public report page). */
export async function getReportAsync(id: string): Promise<Report | undefined> {
  const local = getReport(id); if (local) return local;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob");
      const found = (await list({ prefix: `reports/${id}.json` })).blobs[0];
      if (found) { const p = ReportSchema.safeParse(await (await fetch(found.url)).json()); if (p.success) { cache.set(id, p.data); return p.data; } }
    } catch { /* fall through */ }
  }
  return undefined;
}

export function listReports(): Report[] {
  const out = new Map<string, Report>();
  try {
    if (existsSync(localDir())) for (const f of readdirSync(localDir()).filter((x) => x.endsWith(".json"))) {
      try { const p = ReportSchema.safeParse(JSON.parse(readFileSync(path.join(localDir(), f), "utf8"))); if (p.success) out.set(p.data.id, p.data); } catch { /* skip */ }
    }
  } catch { /* none */ }
  for (const r of cache.values()) out.set(r.id, r);
  return [...out.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
