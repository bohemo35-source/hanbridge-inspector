// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Garage studio data: panel status ranking (gauge class raised by findings, unverified → unconfirmed) and photo-note relevance
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code — uploaded car (no photo index) gets a full garage from its report; prototype keys are not car ids
import { describe, expect, it } from "vitest";
import { bodyKind, garageData, noteScore, panelStatus } from "../src/lib/garage/data";
import type { Report } from "../src/lib/schema";

const finding = (panel: string, kind: Report["findings"][number]["kind"], verified: boolean): Report["findings"][number] => ({
  id: `${panel}-${kind}`, panel, kind, severity: "medium", description_en: "", description_ru: "", confidence: 0.8, verified,
  evidence: [{ type: "transcript", mediaId: "v1", quote: "q" }],
});
const report = (over: Partial<Report>): Report => ({
  id: "r-test", vehicle: { make: "Kia", model: "Sportage" }, findings: [], paintReadings: [],
  verdict: { decision: "BUY", reasons_en: [], reasons_ru: [], confidence: 0.9, handoff: false },
  costEstimate: { status: "manager_quote_required" }, trace: [], createdAt: "2026-11-02T00:00:00Z", ...over,
});

describe("panelStatus", () => {
  it("no data → clean; gauge alone → factory / repaint / putty", () => {
    expect(panelStatus(undefined, "hood")).toBe("clean");
    expect(panelStatus(report({ paintReadings: [{ panel: "hood", microns: 120 }] }), "hood")).toBe("factory");
    expect(panelStatus(report({ paintReadings: [{ panel: "hood", microns: 190 }] }), "hood")).toBe("repaint");
    expect(panelStatus(report({ paintReadings: [{ panel: "hood", microns: 332 }] }), "hood")).toBe("putty");
  });
  it("verified findings raise the status by kind; the loudest wins", () => {
    expect(panelStatus(report({ findings: [finding("front_left_fender", "panel_replaced", true)] }), "front_left_fender")).toBe("replaced");
    expect(panelStatus(report({ findings: [finding("trunk", "scratch", true)] }), "trunk")).toBe("damage");
    expect(panelStatus(report({ paintReadings: [{ panel: "hood", microns: 120 }], findings: [finding("hood", "repaint", true), finding("hood", "putty", true)] }), "hood")).toBe("putty");
  });
  it("an unverified finding only marks the panel unconfirmed, never worse than evidence", () => {
    expect(panelStatus(report({ findings: [finding("roof", "putty", false)] }), "roof")).toBe("unconfirmed");
    expect(panelStatus(report({ paintReadings: [{ panel: "roof", microns: 300 }], findings: [finding("roof", "dent", false)] }), "roof")).toBe("putty");
    expect(panelStatus(report({ findings: [finding("roof", "putty", true)] }), "hood")).toBe("clean");
  });
});

describe("noteScore", () => {
  it("needs the part word (or a synonym); side and position add to it", () => {
    expect(noteScore("front_left_fender", "Close-up of white SUV left side doors")).toBe(0);
    expect(noteScore("front_left_fender", "Front left wing with scratches")).toBe(2);
    expect(noteScore("trunk", "Open tailgate, cargo area")).toBe(1);
    expect(noteScore("hood", "Bonnet open, engine bay")).toBe(1);
  });
});

describe("garageData for an uploaded car", () => {
  it("no photo index: 13 panels from the report, no photos, body from the report", async () => {
    const r = report({ carId: "u-0123456789", vehicle: { make: "BMW", model: "X3", bodyType: "suv" }, paintReadings: [{ panel: "front_left_door", microns: 245 }], findings: [finding("front_left_door", "putty", true)] } as Partial<Report>);
    const g = await garageData("u-0123456789", r, "2023 BMW X3");
    expect(g.panels).toHaveLength(13);
    expect(g.photoTotal).toBe(0);
    expect(g.panels.every((p) => p.photos.length === 0)).toBe(true);
    expect(g.panels.find((p) => p.panel === "front_left_door")).toMatchObject({ status: "putty", reading: { microns: 245 } });
    expect(g.body).toBe("suv");
    expect(g.sheet).toBeUndefined();
    expect(g.gaugeVideo).toBeUndefined();
  });
  it("prototype keys are not cars", () => {
    expect(bodyKind("constructor")).toBe("suv");
    expect(bodyKind("__proto__")).toBe("suv");
  });
});
