// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 pure tests: block chain, HUD reachability, copy completeness, empty-reviews hiding
// @created: 2026-10-29
import { describe, it, expect } from "vitest";
import { BLOCKS, HUD_ORDER, blockAt, stageForBlock, startProgressOf, totalVh } from "@/components/journey-v2/blocks";
import { CAPTIONS, HUD_LABELS, FINALE } from "@/components/journey-v2/copy";
import { STAGE_CONTENT } from "@/components/journey-3d/stageContent";

describe("journey-v2 blocks", () => {
  it("total height is the sum and equals story length", () => {
    expect(totalVh()).toBe(BLOCKS.reduce((s, b) => s + b.vh, 0));
    expect(totalVh()).toBe(4250);
  });
  it("blockAt boundaries and monotonicity", () => {
    expect(blockAt(0).index).toBe(0);
    expect(blockAt(1).index).toBe(BLOCKS.length - 1);
    expect(blockAt(-1).index).toBe(0);
    expect(blockAt(2).local).toBe(1);
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) { const i = blockAt(Math.min(1, p)).index; expect(i).toBeGreaterThanOrEqual(prev); prev = i; }
    // boundary: just before/after first block end switches block
    const end = BLOCKS[0].vh / totalVh();
    expect(blockAt(end - 1e-6).index).toBe(0);
    expect(blockAt(end + 1e-6).index).toBe(1);
  });
  it("every HUD stage is reachable and points at a real block", () => {
    for (const s of HUD_ORDER) {
      expect(BLOCKS.some((b) => b.id === s.blockId)).toBe(true);
      const at = blockAt(startProgressOf(s.blockId) + 0.001);
      expect(at.block.id).toBe(s.blockId);
      expect(HUD_LABELS[s.key].ru.length).toBeGreaterThan(0);
      expect(HUD_LABELS[s.key].en.length).toBeGreaterThan(0);
    }
  });
  it("stageForBlock covers every stage-carrying block", () => {
    for (const b of BLOCKS) if (b.kind === "bridge" || b.kind === "garage" || b.kind === "scene3d") {
      const st = stageForBlock(b);
      if (b.id !== "seoul" && b.id !== "handover") expect(st, b.id).not.toBeNull();
      if (st) expect(STAGE_CONTENT[st]).toBeDefined();
    }
  });
  it("copy: every caption has ru and en; fixed total phrase kept", () => {
    for (const [k, v] of Object.entries(CAPTIONS)) { expect(v.ru, k).toBeTruthy(); expect(v.en, k).toBeTruthy(); }
    expect(FINALE.totalNote.ru).toBe("После оплаты до Москвы — примерно 4–5 недель");
    for (const c of Object.values(STAGE_CONTENT)) for (const f of Object.values(c)) { expect(f.ru).toBeTruthy(); expect(f.en).toBeTruthy(); }
  });
  it("reviews: empty manifest data yields no review blocks in the chain filter", () => {
    const reviews: unknown[] = [];
    const visible = BLOCKS.filter((b) => b.kind !== "reviews" || reviews.length > 0);
    expect(visible.some((b) => b.kind === "reviews")).toBe(false);
    expect(totalVh(visible)).toBe(4050);
  });
});
