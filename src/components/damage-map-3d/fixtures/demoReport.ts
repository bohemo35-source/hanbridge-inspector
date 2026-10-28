// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: DEMO report for /lab/3d — illustrative values, not a real inspection. Replaced by the agent's report in TZ-05.
// @created: 2026-10-28
import type { Report } from "@/lib/schema";

export const DEMO_REPORT: Report = {
  id: "demo-3d",
  vehicle: { make: "Demo", model: "Sedan", year: 2019, mileageKm: 78400, bodyType: "sedan" },
  paintReadings: [
    { panel: "hood", microns: 128 },
    { panel: "roof", microns: 112 },
    { panel: "trunk", microns: 134 },
    { panel: "front_bumper", microns: 141 },
    { panel: "rear_bumper", microns: 172 },
    { panel: "front_left_fender", microns: 118 },
    { panel: "front_right_fender", microns: 238 },
    { panel: "front_left_door", microns: 121 },
    { panel: "front_right_door", microns: 126 },
    { panel: "rear_left_door", microns: 185 },
    { panel: "rear_right_door", microns: 119 },
    { panel: "rear_left_fender", microns: 131 },
    { panel: "rear_right_fender", microns: 124 },
  ],
  findings: [
    {
      id: "f-putty-frf",
      panel: "front_right_fender",
      kind: "putty",
      severity: "high",
      description_en: "Filler on the front right fender: 238 µm, ripple visible in the reflection.",
      description_ru: "Шпатлёвка на правом переднем крыле: 238 мкм, волна по отражению.",
      confidence: 0.88,
      verified: true,
      verifierNote: "Gauge reading and the SAM mask on the frame agree with the voice note.",
      evidence: [
        { type: "gauge", mediaId: "gauge", gaugeMicrons: 238, panel: "front_right_fender", quote: "238 мкм при норме ≤150 → ремонт со шпатлёвкой" },
        { type: "mask", mediaId: "frame-0042", panel: "front_right_fender", box: { x1: 412, y1: 260, x2: 690, y2: 455 } },
        { type: "transcript", mediaId: "voice-01", tStart: 72, tEnd: 79, quote: "Правое переднее крыло — толщина под двести сорок, тут шпатлёвка, видно волну", panel: "front_right_fender" },
      ],
    },
    {
      id: "f-repaint-rld",
      panel: "rear_left_door",
      kind: "repaint",
      severity: "medium",
      description_en: "Rear left door repainted: 185 µm, shade differs from the fender.",
      description_ru: "Задняя левая дверь перекрашена: 185 мкм, оттенок отличается от крыла.",
      confidence: 0.79,
      verified: true,
      verifierNote: "Gauge and voice note agree.",
      evidence: [
        { type: "gauge", mediaId: "gauge", gaugeMicrons: 185, panel: "rear_left_door", quote: "185 мкм → перекрас" },
        { type: "transcript", mediaId: "voice-01", tStart: 91, tEnd: 96, quote: "Задняя левая дверь крашеная, по оттенку чуть отличается", panel: "rear_left_door" },
        { type: "mask", mediaId: "frame-0065", panel: "rear_left_door" },
      ],
    },
    {
      id: "f-repaint-rb",
      panel: "rear_bumper",
      kind: "repaint",
      severity: "low",
      description_en: "Rear bumper repainted (auction sheet + gauge 172 µm).",
      description_ru: "Задний бампер перекрашен (аукционный лист + 172 мкм).",
      confidence: 0.72,
      verified: true,
      verifierNote: "Auction sheet line and gauge reading agree.",
      evidence: [
        { type: "auction_sheet", mediaId: "sheet-01", quote: "후범퍼 · 도장 → задний бампер, окраска", panel: "rear_bumper" },
        { type: "gauge", mediaId: "gauge", gaugeMicrons: 172, panel: "rear_bumper", quote: "172 мкм → перекрас" },
      ],
    },
    {
      id: "f-dent-hood",
      panel: "hood",
      kind: "dent",
      severity: "medium",
      description_en: "Possible dent near the hood edge (voice note only).",
      description_ru: "Возможная вмятина у края капота (только голосовая заметка).",
      confidence: 0.41,
      verified: false,
      verifierNote: "The frame does not show a dent; gauge 128 µm is factory paint. Excluded from the verdict, manager to re-check on site.",
      evidence: [
        { type: "transcript", mediaId: "voice-01", tStart: 28, tEnd: 31, quote: "На капоте вроде вмятинка у края", panel: "hood" },
        { type: "mask", mediaId: "frame-0030", panel: "hood" },
      ],
    },
  ],
  verdict: {
    decision: "NEGOTIATE",
    reasons_en: ["Filler on the front right fender (238 µm).", "Rear left door and rear bumper repainted.", "Hood dent not confirmed, excluded."],
    reasons_ru: ["Правое переднее крыло: шпатлёвка, 238 мкм.", "Задняя левая дверь и задний бампер перекрашены.", "Вмятина на капоте не подтверждена и в вердикт не вошла."],
    confidence: 0.74,
    handoff: false,
  },
  costEstimate: { status: "manager_quote_required" },
  trace: [],
  createdAt: "2026-10-28T00:00:00.000Z",
};
