// @agent:   claude (TZ-03 part A)
// @project: hanbridge-inspector
// @purpose: Tests for voice -> findings logic (no network)
// @created: 2026-10-29
import { describe, expect, it } from "vitest";
import { FindingSchema } from "@/lib/schema";
import { normalizeText, quoteInText, voiceFindings, voicePaintJson, type VoiceReading } from "./voice";

const r = (panel: VoiceReading["panel"], microns: number[], inspectorVerdict: VoiceReading["inspectorVerdict"], quote = "сто восемьдесят один"): VoiceReading => ({
  panel, microns, inspectorVerdict, quote, chunk: 2, tStart: 30, tEnd: 45,
});

describe("voice quotes", () => {
  it("normalises punctuation, case and ё", () => {
    expect(normalizeText("Сто восемьдесят один, Ёлка!")).toBe("сто восемьдесят один елка");
    expect(quoteInText("по капоту у нас: сто восемьдесят один", "Средние по капоту у нас сто восемьдесят один, сто девяносто семь")).toBe(true);
    expect(quoteInText("двести пятьдесят", "сто восемьдесят один")).toBe(false); // hallucinated quote is rejected
    expect(quoteInText("сто", "сто")).toBe(false); // too short to be evidence
  });
});

describe("voice findings", () => {
  const readings = [
    r("hood", [181, 197, 225, 230, 175, 171], "repaint"),
    r("front_left_fender", [65, 72, 68], "factory"),
    r("roof", [158, 158, 166, 160], "factory", "крыша бьет в два раза больше"),
    r("trunk", [91, 86, 83], "unknown"),
    r("rear_right_door", [190, 205], "unknown"),
    r("unknown", [44, 66], "unknown"),
  ];

  it("inspector verdict wins; numbers only decide when the verdict is unknown; factory-vs-numbers becomes a conflict", () => {
    const { findings, conflicts } = voiceFindings(readings, "paint_gauge.mp4");
    expect(findings.map((f) => `${f.panel}/${f.kind}`)).toEqual(["hood/repaint", "rear_right_door/repaint"]);
    expect(conflicts).toEqual([{ panel: "roof", median: 159, quote: "крыша бьет в два раза больше", tStart: 30 }]);
    const hood = findings[0];
    expect(hood.severity).toBe("high"); // peak 230 > 220
    expect(hood.evidence[0]).toMatchObject({ type: "transcript", mediaId: "paint_gauge.mp4", tStart: 30, tEnd: 45, gaugeMicrons: 189 });
    for (const f of findings) {
      expect(FindingSchema.safeParse(f).success).toBe(true);
      expect(f.verified).toBe(false);
    }
  });

  it("merges several readings of one panel into one finding with all quotes", () => {
    const { findings } = voiceFindings(
      [
        { ...r("hood", [181, 197], "unknown", "показатели средние по капоту"), tStart: 0, tEnd: 15 },
        { ...r("hood", [233, 310, 532], "repair", "двести тридцать три"), tStart: 15, tEnd: 30 },
      ],
      "v.mp4",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ panel: "hood", kind: "putty", severity: "high" });
    expect(findings[0].evidence.map((e) => e.tStart)).toEqual([0, 15]);
    expect(findings[0].evidence[0].gaugeMicrons).toBe(233);
  });

  it("paint.json takes the median per panel and skips unknown panels", () => {
    expect(voicePaintJson(readings)).toEqual({ hood: 189, front_left_fender: 68, trunk: 86, rear_right_door: 198 }); // roof: inspector says factory despite 159 µm → excluded from the numeric rule
  });
});
