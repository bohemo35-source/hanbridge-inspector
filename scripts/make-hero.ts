// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: CLI: npx tsx scripts/make-hero.ts <reportId> -> getOrCreateHeroImage (Blob cache, generated once per report)
// @created: 2026-10-29
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

async function main() {
  const reportId = process.argv[2];
  if (!reportId) throw new Error("usage: npx tsx scripts/make-hero.ts <reportId>");
  const { getOrCreateHeroImage } = await import("../src/lib/agent/tools/listing");
  const t0 = Date.now();
  console.log("first:", JSON.stringify(await getOrCreateHeroImage(reportId)), `${Date.now() - t0} ms`);
  const t1 = Date.now();
  console.log("second:", JSON.stringify(await getOrCreateHeroImage(reportId)), `${Date.now() - t1} ms`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
