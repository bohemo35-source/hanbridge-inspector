// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Full agent run per demo car: node scripts/e2e/run-cars.mjs [carId...] (MINI first by default)
// @created: 2026-10-29
import { spawnSync } from "node:child_process";
const r = spawnSync("npx", ["tsx", "scripts/e2e/run-cars.impl.ts", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
