// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Report store: Vercel Blob reports/{id}.json when BLOB_READ_WRITE_TOKEN set, else local data/reports/*.json (+ in-memory cache)
// @created: 2026-10-27
// @updated: 2026-10-29 muse-code
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ReportSchema, type Report } from "@/lib/schema";
import { unstable_cache } from "next/cache";
import manifest from "@/lib/agent/blob-manifest.json";
import { generatedFileForUrl } from "@/lib/runtime/generated";

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
    const file = generatedFileForUrl(localUrl) ?? path.join(process.cwd(), "public", localUrl.replace(/^\//, ""));
    const { put } = await import("@vercel/blob");
    const res = await put(blobPath, readFileSync(file), { access: "public", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    return res.url;
  } catch {
    return localUrl;
  }
}

/** Public base of our Blob store (same store as the demo media), e.g. https://<id>.public.blob.vercel-storage.com */
const blobBase = (() => {
  const any = Object.values((manifest as { cars: Record<string, Record<string, Record<string, string>>> }).cars)
    .flatMap((d) => Object.values(d ?? {}).flatMap((f) => Object.values(f ?? {})))[0];
  return process.env.BLOB_PUBLIC_BASE ?? (any ? new URL(any).origin : "");
})();
const REPORT_ID = /^r-[a-z0-9-]{3,80}$/;

async function listFromBlob(): Promise<Report[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const out: Report[] = [];
  try {
    const { list } = await import("@vercel/blob");
    const blobs = (await list({ prefix: "reports/" })).blobs.filter((b) => b.pathname.endsWith(".json"));
    await Promise.all(blobs.map(async (b) => {
      try { const p = ReportSchema.safeParse(await (await fetch(b.url, { next: { revalidate: 3600 } })).json()); if (p.success) out.push(p.data); } catch { /* skip */ }
    }));
  } catch { /* Blob unavailable */ }
  return out;
}

/** `list()` is a Blob "advanced operation" (Hobby: ~2,000/month, overuse blocks Blob for 30 days):
 *  pages read it through a shared cache (10 min, tag "reports", refreshed after every agent run), never per request. */
const listFromBlobCached = unstable_cache(listFromBlob, ["reports-list-v1"], { revalidate: 600, tags: ["reports"] });

/** All reports: local files + Blob `reports/` (Vercel has no local files). */
export async function listReportsAsync(): Promise<Report[]> {
  const out = new Map<string, Report>(listReports().map((r) => [r.id, r]));
  let remote: Report[] = [];
  try { remote = await listFromBlobCached(); } catch { remote = await listFromBlob(); } // outside Next (scripts) unstable_cache throws
  for (const r of remote) if (!out.has(r.id)) { out.set(r.id, r); cache.set(r.id, r); }
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

/** Async variant that can reach Blob (used by the public report page): direct CDN URL, no list(); cache hits are free. */
export async function getReportAsync(id: string): Promise<Report | undefined> {
  if (!REPORT_ID.test(id)) return undefined;
  const local = getReport(id); if (local) return local;
  if (!blobBase) return undefined;
  try {
    const res = await fetch(`${blobBase}/reports/${id}.json`, { next: { revalidate: 3600 } });
    if (!res.ok) return undefined;
    const p = ReportSchema.safeParse(await res.json());
    if (p.success) { cache.set(id, p.data); return p.data; }
  } catch { /* fall through */ }
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
