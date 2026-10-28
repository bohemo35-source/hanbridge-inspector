// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: TS implementation for run-cars.mjs (agent runs need the TS sources)
// @created: 2026-10-29
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

async function main() {
  const { CARS } = await import("../../src/lib/agent/catalog");
  const { runInspection } = await import("../../src/lib/agent/orchestrator");
  const wanted = process.argv.slice(2);
  const cars = wanted.length ? wanted : CARS.map((c) => c.carId); // catalog order: mini-cooper-s first
  for (const carId of cars) {
    console.log(`\n=== RUN ${carId} ===`);
    const t0 = Date.now();
    try {
      const { report, ms } = await runInspection({
        carId,
        onStep: (s) => console.log(`  [${s.i}] ${s.ok === false ? "FAIL" : "ok"} ${s.tool} (${s.ms ?? 0}ms) ${s.outputSummary ?? ""}`),
      });
      const verified = report.findings.filter((f) => f.verified).length;
      console.log(`car=${carId} findings=${report.findings.length} verified=${verified} rejected=${report.findings.length - verified}`);
      console.log(`verdict=${report.verdict.decision} confidence=${report.verdict.confidence} handoff=${report.verdict.handoff}`);
      console.log(`report=${report.id} url=/r/${report.id} listing=${report.listingUrl ?? "none"} ms=${ms} wallMs=${Date.now() - t0}`);
    } catch (e) {
      console.log(`car=${carId} ERROR ${e instanceof Error ? e.message : e}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
