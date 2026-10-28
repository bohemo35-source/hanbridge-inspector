// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: CLI: npx tsx scripts/make-listing.ts [photoId ...] -> listing photos in public/generated/mini-cooper-s + before/after copies in docs/reports/assets/
// @created: 2026-10-29
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

async function main() {
  const photos = process.argv.slice(2).length ? process.argv.slice(2) : ["photo_243113_0", "photo_243114_0"];
  const { makeListingPhoto } = await import("../src/lib/agent/tools/listing");
  const assets = path.join("docs", "reports", "assets");
  mkdirSync(assets, { recursive: true });
  for (const photoId of photos) {
    const src = path.join("demo-data", "mini-cooper-s", "photos", `${photoId}.jpg`);
    if (!existsSync(src)) throw new Error(`no photo: ${src}`);
    const t0 = Date.now();
    const r = await makeListingPhoto({ carId: "mini-cooper-s", photoId, imagePath: src });
    console.log(`\n== ${photoId} (${Date.now() - t0} ms)`);
    console.log(JSON.stringify(r, null, 2));
    const beforeOut = path.join(assets, `tz04-${photoId}-before.jpg`);
    copyFileSync(src, beforeOut);
    console.log(`before -> ${beforeOut}`);
    if (r.url) {
      const afterSrc = path.join("public", "generated", "mini-cooper-s", `${photoId}-listing.jpg`);
      const afterOut = path.join(assets, `tz04-${photoId}-after.jpg`);
      copyFileSync(afterSrc, afterOut);
      console.log(`after -> ${afterOut}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
