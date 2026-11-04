// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: /inspect/new "now: …" label covers every tool and step the orchestrator emits (EN and RU), neutral fallback otherwise
// @created: 2026-11-04
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOW_AFTER, stepLabel } from "@/app/inspect/new/stepLabel";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const orch = src("src/lib/agent/orchestrator.ts");
const tools = [...orch.matchAll(/fn\("([A-Za-z_]+)"/g)].map((m) => m[1]);
const steps = [...orch.matchAll(/step\("([A-Za-z_]+)"/g)].map((m) => m[1]);
const route = [...src("src/app/api/upload-run/route.ts").matchAll(/tool: "([A-Za-z_]+)"/g)].map((m) => m[1]);
const all = [...new Set([...tools, ...steps, ...route])];

describe("stepLabel", () => {
  it("finds the orchestrator's tools and steps in the source", () => {
    expect(tools).toEqual(expect.arrayContaining(["segment_image", "find_defects", "recheck_panel", "estimate_landed_cost", "handoff_to_manager"]));
    expect(steps).toEqual(expect.arrayContaining(["index_photos", "context_check", "conflict_check", "verifier", "finalize_report"]));
    expect(route).toContain("upload_video");
  });
  it.each(all)("%s has its own EN and RU label (not the fallback)", (tool) => {
    expect(NOW_AFTER[tool], tool).toBeDefined();
    expect(stepLabel(tool, "en")).not.toBe("working…");
    expect(stepLabel(tool, "ru")).not.toBe("работаю…");
    expect(stepLabel(tool, "ru")).toMatch(/[а-яё]/i);
  });
  it("labels what runs after the last finished step", () => {
    expect(stepLabel(undefined, "en")).toMatch(/photo index|Glimmer/);
    expect(stepLabel("upload_video", "en")).toMatch(/1–3 min/);
    expect(stepLabel("upload_video", "en")).not.toMatch(/takes up to 45 s/);
    expect(stepLabel("index_photos", "en")).toMatch(/defect/);
    expect(stepLabel("transcribe_note", "en")).not.toMatch(/^voice note and gauge readings$/);
    expect(stepLabel("recheck_panel", "en")).toMatch(/next tool/);
    expect(stepLabel("conflict_check", "en")).not.toMatch(/verifier/);
    expect(stepLabel("context_check", "en")).toMatch(/verifier/);
    expect(stepLabel("finalize_report", "en")).toMatch(/cross-check/);
  });
  it("falls back to a neutral label for an unknown tool", () => {
    expect(stepLabel("some_new_tool", "en")).toBe("working…");
    expect(stepLabel("some_new_tool", "ru")).toBe("работаю…");
  });
});
