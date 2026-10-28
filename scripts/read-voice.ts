// @agent:   claude (TZ-03 part A)
// @project: hanbridge-inspector
// @purpose: CLI: npx tsx scripts/read-voice.ts <carId> [--video name.mp4] [--chunk 15]
//           -> demo-data/<carId>/out/voice-<video>.json
// @created: 2026-10-29
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const carId = args[0];
  if (!carId) throw new Error("usage: read-voice.ts <carId> [--video f.mp4] [--chunk 15]");
  const opt = (n: string) => {
    const i = args.indexOf(n);
    return i > 0 ? args[i + 1] : undefined;
  };
  const videoName = opt("--video") ?? "paint_gauge.mp4";
  const video = path.join("demo-data", carId, "video", videoName);
  if (!existsSync(video)) throw new Error(`no video: ${video}`);
  const { transcribeNote } = await import("../src/lib/agent/tools/voice");
  const r = await transcribeNote({ video, mediaId: videoName, chunkSec: Number(opt("--chunk") ?? 15) });
  const outDir = path.join("demo-data", carId, "out");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `voice-${path.parse(videoName).name}.json`);
  writeFileSync(out, JSON.stringify({ carId, generatedAt: new Date().toISOString(), ...r }, null, 2));
  console.log(`car=${carId} video=${videoName} chunks=${r.stats.chunks} asrMs=${r.stats.asrMs} sparkMs=${r.stats.sparkMs} ms=${r.stats.ms}`);
  for (const x of r.readings) console.log(`  ${x.tStart}s ${x.panel.padEnd(20)} ${x.inspectorVerdict.padEnd(8)} [${x.microns.join(", ")}] «${x.quote}»`);
  for (const n of r.notes) console.log(`  note ${n.tStart}s ${n.panel ?? "-"}: ${n.text_ru} «${n.quote}»`);
  console.log(`findings: ${r.findings.map((f) => `${f.panel}/${f.kind}/${f.severity}`).join(", ") || "none"}`);
  console.log(`conflicts: ${r.conflicts.map((c) => `${c.panel} median ${c.median} (inspector: factory)`).join(", ") || "none"}`);
  console.log(`rejected (quote not in transcript): ${r.rejected.length}`);
  console.log(`wrote ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
