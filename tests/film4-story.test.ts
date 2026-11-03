// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v4 script guards: the business facts (one Korea invoice, insurance from purchase to the end, customs paid by the buyer, buyer picks the carrier, bonded yard 7-10 days, zero commission) must survive copy edits
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code (narration timing guard)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTS, RECEIPT_BUSAN, RECEIPT_CUSTOMS, SCENES, UI } from "../src/components/film4/story";

const byId = (id: string) => SCENES.find((s) => s.id === id)!;
const text = (id: string, lang: "en" | "ru" = "en") => (byId(id).lines ?? []).map((l) => l[lang]).join(" ");

describe("film v4 story", () => {
  it("has unique scene ids, 4 acts in order and media for every scene", () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(ACTS).toHaveLength(4);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].act).toBeGreaterThanOrEqual(SCENES[i - 1].act);
    for (const s of SCENES) expect(Boolean(s.clip || s.insert || s.card || s.end)).toBe(true);
    for (const s of SCENES) for (const l of s.lines ?? []) { expect(l.en.length).toBeGreaterThan(0); expect(l.ru.length).toBeGreaterThan(0); }
  });

  it("insures the car from the purchase (keys) to the very end", () => {
    const k = SCENES.findIndex((s) => s.id === "keys");
    expect(SCENES.slice(0, k).some((s) => s.insured)).toBe(false);
    expect(SCENES.slice(k).every((s) => s.insured)).toBe(true);
  });

  it("Korea invoice: car, platform fee, Korea costs, sea freight at the carrier tariff — nothing paid by the buyer there", () => {
    expect(byId("busan").receipt).toBe("busan");
    expect(RECEIPT_BUSAN.map((l) => l.by)).toEqual(["invoice", "invoice", "invoice", "invoice"]);
    expect(text("busan")).toMatch(/one invoice/i);
    expect(text("busan")).toMatch(/No extra or hidden payments/);
    expect(text("busan", "ru")).toMatch(/скрытых платежей/);
    expect(text("busan", "ru")).toMatch(/один инвойс/);
  });

  it("customs is in the buyer's name and paid by the buyer", () => {
    expect(byId("gate").receipt).toBe("customs");
    expect(RECEIPT_CUSTOMS.at(-1)!.by).toBe("you");
    expect(text("orbit")).toMatch(/in your name/);
    expect(text("gate")).toMatch(/you pay them yourself/);
    expect(text("gate", "ru")).toMatch(/вы платите сами/);
  });

  it("the buyer picks the carrier and pays it directly", () => {
    expect(byId("vload").toast?.by).toBe("you");
    expect(text("hills")).toMatch(/You pick the carrier/);
    expect(text("hills", "ru")).toMatch(/выбираете вы/);
  });

  it("bonded yard 7-10 days, checked against the inspection", () => {
    expect(text("ramp")).toMatch(/seven to ten days/);
    expect(byId("ramp").chips!.map((c) => c.ru).join(" ")).toMatch(/7–10 дней/);
    expect(text("ramp")).toMatch(/inspection/);
  });

  it("zero commission, earning from the export VAT refund", () => {
    expect(byId("house").toast?.by).toBe("zero");
    expect(text("house")).toMatch(/No commission/);
    expect(UI.zeroNote.en).toMatch(/VAT refund/);
  });
});

describe("film v4 narration timing", () => {
  for (const lang of ["en", "ru"] as const) {
    it(`${lang}: one window per scene, in story order, ending at the file duration`, () => {
      const j = JSON.parse(readFileSync(`public/film3/audio/narration-${lang}.json`, "utf8")) as { file: string; duration: number; scenes: Record<string, [number, number]> };
      expect(j.file).toBe(`/film3/audio/narration-${lang}.mp3`);
      expect(Object.keys(j.scenes)).toEqual(SCENES.map((s) => s.id));
      let prev = 0;
      for (const s of SCENES) { const [a, b] = j.scenes[s.id]; expect(a).toBeCloseTo(prev, 1); expect(b).toBeGreaterThan(a); prev = b; }
      expect(Math.abs(prev - j.duration)).toBeLessThan(0.5);
    });
  }
});
