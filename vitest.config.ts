// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Vitest config
// @created: 2026-10-27
import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"] },
});
