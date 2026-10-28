// @agent:   claude (TZ-03 part B)
// @project: hanbridge-inspector
// @purpose: CLI: npx tsx scripts/read-gauge.ts <carId> [--video name.mp4] [--max-frames 60] [--reread 8]
//           -> demo-data/<carId>/out/gauge.json (+ paint.json when digits were readable)
// @created: 2026-10-28
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
  if (!carId) throw new Error("usage: read-gauge.ts <carId> [--video f.mp4] [--max-frames N] [--reread N]");
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i > 0 ? args[i + 1] : undefined;
  };
  const videoName = opt("--video") ?? "paint_gauge.mp4";
  const video = path.join("demo-data", carId, "video", videoName);
  if (!existsSync(video)) throw new Error(`no video: ${video}`);
  const { readGaugeVideo } = await import("../src/lib/agent/tools/gauge");
  const r = await readGaugeVideo({ video, mediaId: videoName, maxFrames: Number(opt("--max-frames") ?? 60), reread: Number(opt("--reread") ?? 8) });
  const outDir = path.join("demo-data", carId, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "gauge.json"), JSON.stringify({ carId, generatedAt: new Date().toISOString(), ...r }, null, 2));
  if (Object.keys(r.paint).length) writeFileSync(path.join(outDir, "paint.json"), JSON.stringify(r.paint, null, 2));
  console.log(`car=${carId} video=${videoName} frames=${r.stats.frames} gaugeFrames=${r.stats.gaugeFrames} digitsRead=${r.stats.digitsRead} spark=${r.stats.sparkCalls} sam=${r.stats.samCalls} ms=${r.stats.ms}`);
  for (const m of r.measurements)
    console.log(`  ${m.panel.padEnd(20)} t=${m.tStart}-${m.tEnd}s frames=${m.frames} microns=${m.microns ?? "-"} band=${m.band ?? "-"} source=${m.source} conf=${m.confidence}`);
  console.log(`findings: ${r.findings.map((f) => `${f.panel}/${f.kind}/${f.severity}`).join(", ") || "none"}`);
  console.log(`wrote ${path.join(outDir, "gauge.json")}${Object.keys(r.paint).length ? " + paint.json" : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
