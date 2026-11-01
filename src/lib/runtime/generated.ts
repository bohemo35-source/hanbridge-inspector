// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Where generated files (listing photos, SAM masks, heroes) may be written. Locally -> public/generated (served by Next).
//           On Vercel the deployment is read-only except /tmp, and /tmp is not served, so callers publish to Blob instead.
// @created: 2026-11-01
import { tmpdir } from "node:os";
import path from "node:path";

/** true when files under generatedRoot() are reachable at /generated/... (local dev / next start). */
export const generatedIsServed = (): boolean => !(process.env.VERCEL || process.env.GENERATED_TMP);

export const generatedRoot = (): string =>
  generatedIsServed() ? path.join(process.cwd(), "public", "generated") : path.join(tmpdir(), "hanbridge-generated");

/** "/generated/<carId>/x.jpg" -> absolute file path inside generatedRoot(); null for any other URL. */
export function generatedFileForUrl(url: string): string | null {
  if (!url.startsWith("/generated/")) return null;
  const rel = url.slice("/generated/".length);
  if (rel.split("/").some((s) => s === ".." || s === "")) return null;
  return path.join(generatedRoot(), rel);
}
