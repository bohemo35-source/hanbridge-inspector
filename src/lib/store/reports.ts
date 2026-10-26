// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: In-memory report store for TZ-01 (Blob store lands later)
// @created: 2026-10-27
import type { Report } from "@/lib/schema";
const store = new Map<string, Report>();
export function saveReport(r: Report): void { store.set(r.id, r); }
export function getReport(id: string): Report | undefined { return store.get(id); }
