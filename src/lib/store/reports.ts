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

/** Awaited save: local file (when writable) + Vercel Blob (when BLOB_READ_WRITE_TOKEN). Scripts must use this one. */
export async function saveReportAsync(r: Report): Promise<void> {
  cache.set(r.id, r);
  try { mkdirSync(localDir(), { recursive: true }); writeFileSync(path.join(localDir(), `${r.id}.json`), JSON.stringify(r)); } catch { /* read-only fs */ }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    await put(`reports/${r.id}.json`, JSON.stringify(r), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  }
}

/** Upload a generated local file (e.g. /generated/…-listing.jpg) to Blob and return its public URL; local URL without a token. */
export async function publishMedia(localUrl: string, blobPath: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || /^https?:/.test(localUrl)) return localUrl;
  try {
    const file = path.join(process.cwd(), "public", localUrl.replace(/^\//, ""));
    const { put } = await import("@vercel/blob");
    const res = await put(blobPath, readFileSync(file), { access: "public", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    return res.url;
  } catch {
    return localUrl;
  }
}

/** All reports: local files + Blob `reports/` (Vercel has no local files). */
export async function listReportsAsync(): Promise<Report[]> {
  const out = new Map<string, Report>(listReports().map((r) => [r.id, r]));
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob");
      const blobs = (await list({ prefix: "reports/" })).blobs.filter((b) => b.pathname.endsWith(".json"));
      await Promise.all(blobs.map(async (b) => {
        const id = b.pathname.replace(/^reports\//, "").replace(/\.json$/, "");
        if (out.has(id)) return;
        try { const p = ReportSchema.safeParse(await (await fetch(b.url, { cache: "no-store" })).json()); if (p.success) { out.set(id, p.data); cache.set(id, p.data); } } catch { /* skip */ }
      }));
    } catch { /* Blob unavailable */ }
  }
  return [...out.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
