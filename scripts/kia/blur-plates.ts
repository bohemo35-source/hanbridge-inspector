// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Blur every licence plate in demo-data/<carId>/photos in place (SAM "license plate" boxes, strong blur). Originals stay outside the repo.
//           npx tsx scripts/kia/blur-plates.ts <carId> [photo ...]  -> writes demo-data/<carId>/out/plates.json (boxes only)
// @created: 2026-10-31
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { samSegment, scaleBox, type SamBox } from "../../src/lib/meta/sam";
import { blurPlates } from "../../src/lib/agent/tools/listing";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

async function main() {
  const [carId, ...only] = process.argv.slice(2);
  const dir = path.join("demo-data", carId, "photos");
  const out = path.join("demo-data", carId, "out"); mkdirSync(out, { recursive: true });
  const photos = only.length ? only : readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const log: Record<string, SamBox[]> = existsSync(path.join(out, "plates.json")) ? JSON.parse(readFileSync(path.join(out, "plates.json"), "utf8")) : {};
  const queue = [...photos];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const p = path.join(dir, f);
      const buf = readFileSync(p);
      const { data, info } = await sharp(buf).rotate().toBuffer({ resolveWithObject: true });
      try {
        const r = await samSegment(data, "license plate");
        const boxes = r.instances.map((i) => scaleBox(i.box, { w: r.width, h: r.height }, { w: info.width, h: info.height }));
        log[f] = boxes;
        if (boxes.length) writeFileSync(p, await blurPlates(data, boxes));
        console.log(f, boxes.length);
      } catch (e) { console.log(f, "ERR", e instanceof Error ? e.message : e); }
    }
  }));
  writeFileSync(path.join(out, "plates.json"), JSON.stringify(log, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
