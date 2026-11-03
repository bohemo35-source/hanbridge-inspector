// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: runInspection wiring for a visitor's upload (models and tools mocked, the rules real): the voice alone never confirms paint,
//           a matching gauge screen read on ≥2 frames does, a replacement from the video stays unconfirmed, the report goes to a manager
// @created: 2026-11-03
// @updated: 2026-11-03 claude-code — one-frame screen reading does not confirm; transcribe_note comes from the upload fallback
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { Finding } from "@/lib/schema";

const voiceFinding = (panel: string, kind: Finding["kind"], quote: string): Finding => ({
  id: `voice-${panel}-${kind}`, panel: panel as Finding["panel"], kind, severity: "medium", description_en: `${panel} ${kind}`, description_ru: `${panel} ${kind}`,
  confidence: 0.8, verified: false, evidence: [{ type: "transcript", mediaId: "owner_video.mp4", quote }],
});

vi.mock("@/lib/meta/glimmer", () => ({ glimmerConfigured: () => false }));
vi.mock("@/lib/store/reports", () => ({ saveReportAsync: vi.fn(async () => undefined), publishMedia: vi.fn(async (u: string) => u) }));
vi.mock("@/lib/meta/sparkOpen", () => ({ SPARK_OPEN_MODEL: "open-test", sparkOpenJson: vi.fn(async () => ({ supported: true, confidence: 0.9, note: "ok" })) }));
vi.mock("@/lib/meta/spark", () => {
  let step = 0;
  return {
    sparkChat: vi.fn(async () => (step++ === 0
      // the model reads the screen but forgets the voice: the upload fallback must transcribe it
      ? { content: "", raw: {}, toolCalls: [{ id: "2", type: "function", function: { name: "read_gauge_video", arguments: "{}" } }] }
      : { content: "", raw: {}, toolCalls: [{ id: "3", type: "function", function: { name: "finalize_report", arguments: "{}" } }] })),
    sparkJson: vi.fn(async (_s: unknown, _m: unknown, spec: string) => (String(spec).includes("supported") ? { supported: true, confidence: 0.9, note: "ok" } : { reasons_en: ["r"], reasons_ru: ["r"] })),
  };
});
vi.mock("./tools/defects", () => ({ findDefects: vi.fn(async () => ({ view: "left", panels_visible: [], findings: [], cropBox: { x1: 0, y1: 0, x2: 1, y2: 1, w: 1, h: 1 }, width: 1, height: 1 })) }));
vi.mock("./tools/segment", () => ({ segmentImage: vi.fn(async () => ({ car: null, licensePlate: null, wheels: [], width: 100, height: 100 })), boxArea: () => 0 }));
vi.mock("./tools/listing", () => ({
  makeListingPhoto: vi.fn(async () => ({ url: undefined, plateHidden: false, backgroundEdited: false, rejectedReason: "test" })),
  getOrCreateHeroImage: vi.fn(async () => ({ url: "/hero.jpg" })), assertFindingsFreeOfListingEvidence: vi.fn(),
}));
vi.mock("./tools/voice", () => ({
  transcribeNote: vi.fn(async () => ({
    chunks: [], readings: [], conflicts: [], paintStats: {},
    paint: { trunk: 181, front_right_fender: 167, hood: 200 },
    findings: [voiceFinding("trunk", "repaint", "багажник 181"), voiceFinding("front_right_fender", "repaint", "крыло 167"), voiceFinding("rear_bumper", "panel_replaced", "бампер замена"), voiceFinding("hood", "repaint", "капот 200")],
  })),
}));
vi.mock("./tools/gauge", () => ({
  readGaugeVideo: vi.fn(async () => ({
    mediaId: "owner_video.mp4", frames: [], findings: [], paint: { trunk: 175, hood: 200 },
    // hood matches the voice (200) but its digits were read on one frame only: not trusted
    measurements: [{ panel: "trunk", tStart: 70, tEnd: 95, frames: 3, digitFrames: 3, microns: 175, band: "elevated", source: "digits", confidence: 0.8 },
      // hood: gauge visible on 2 frames, digits read on one only → not trusted
      { panel: "hood", tStart: 10, tEnd: 11, frames: 2, digitFrames: 1, microns: 200, band: "elevated", source: "digits", confidence: 0.6 }],
    stats: { frames: 45, gaugeFrames: 42, digitsRead: 4, sparkCalls: 8, samCalls: 0, ms: 1 },
  })),
}));

import { registerCar } from "./catalog";
import { registerLocalCar } from "./media";
import { runInspection } from "./orchestrator";

describe("runInspection: a visitor's upload with a gauge video", () => {
  it("voice + matching screen confirms; voice alone and a replacement do not; manager handoff", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hb-upload-test-"));
    mkdirSync(path.join(dir, "photos")); mkdirSync(path.join(dir, "video"));
    const jpg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#999" } }).jpeg().toBuffer();
    for (const n of ["photo-01.jpg", "photo-02.jpg", "photo-03.jpg"]) writeFileSync(path.join(dir, "photos", n), jpg);
    writeFileSync(path.join(dir, "video", "owner_video.mp4"), Buffer.alloc(16));
    const carId = "u-test000001";
    registerCar({ carId, make: "Hyundai", model: "Sonata", year: 2020, bodyType: "sedan", doors: 5 });
    registerLocalCar(carId, dir);

    const { report } = await runInspection({ carId, reportId: "r-test-upload" });
    expect(report.trace.some((s) => s.tool === "transcribe_note")).toBe(true); // the fallback ran (the model did not call it)
    const byKey = (panel: string, kind: string) => report.findings.find((f) => f.panel === panel && f.kind === kind);
    expect(byKey("trunk", "repaint")?.verified).toBe(true);            // voice 181 and screen 175 (3 frames) agree
    expect(byKey("front_right_fender", "repaint")?.verified).toBe(false); // voice only
    expect(byKey("rear_bumper", "panel_replaced")?.verified).toBe(false); // a replacement from the owner's video
    expect(byKey("hood", "repaint")?.verified).toBe(false);             // screen agrees, but digits on one frame only
    expect(report.verdict.handoff).toBe(true);
    expect(report.handoffReason).toBeTruthy();
    expect(report.trace.some((s) => s.tool === "conflict_check" && (s.outputSummary ?? "").includes("confirmed=trunk"))).toBe(true);
  }, 30_000);
});
