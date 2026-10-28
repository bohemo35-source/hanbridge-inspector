// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Zod schemas: Media, Evidence, Finding, Verdict, Report
// @created: 2026-10-27
import { z } from "zod";

export const BoxSchema = z.object({
  x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
  w: z.number().optional(), h: z.number().optional(),
});

export const MediaSchema = z.object({
  id: z.string(),
  kind: z.enum(["photo", "video_frame", "audio", "auction_sheet"]),
  url: z.string(),
  takenAt: z.string().optional(),
});

export const EvidenceSchema = z.object({
  type: z.enum(["frame", "mask", "transcript", "gauge", "auction_sheet"]),
  mediaId: z.string(),
  box: BoxSchema.optional(),
  maskRef: z.string().optional(),
  quote: z.string().optional(),
  tStart: z.number().optional(),
  tEnd: z.number().optional(),
  gaugeMicrons: z.number().optional(),
  panel: z.string().optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  panel: z.string(),
  kind: z.enum(["scratch", "dent", "rust", "repaint", "putty", "panel_replaced", "mechanical", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description_en: z.string(),
  description_ru: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1),
  verified: z.boolean(),
  verifierNote: z.string().optional(),
});

export const VerdictSchema = z.object({
  decision: z.enum(["BUY", "NEGOTIATE", "WALK_AWAY"]),
  reasons_en: z.array(z.string()),
  reasons_ru: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  handoff: z.boolean(),
});

export const PaintReadingSchema = z.object({
  panel: z.string(),
  microns: z.number(),
});

export const AgentStepSchema = z.object({
  tool: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  ms: z.number().optional(),
  model: z.string().optional(),
});

export const CostEstimateSchema = z.object({
  status: z.enum(["ok", "manager_quote_required"]),
  totalKrw: z.number().optional(),
  note_en: z.string().optional(),
  note_ru: z.string().optional(),
});

export const ReportSchema = z.object({
  id: z.string(),
  vehicle: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().optional(),
    mileageKm: z.number().optional(),
    vin: z.string().optional(),
    /** 3D template for the damage map (TZ-06); optional, guessed from make/model when absent */
    bodyType: z.enum(["sedan", "suv", "hatchback"]).optional(),
    doors: z.union([z.literal(3), z.literal(5)]).optional(),
  }),
  findings: z.array(FindingSchema),
  verdict: VerdictSchema,
  paintReadings: z.array(PaintReadingSchema),
  costEstimate: CostEstimateSchema,
  trace: z.array(AgentStepSchema),
  createdAt: z.string(),
});

export const FindingsDraftSchema = z.object({
  findings: z.array(FindingSchema),
  verdict: VerdictSchema,
});

export type Media = z.infer<typeof MediaSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type PaintReading = z.infer<typeof PaintReadingSchema>;
export type FindingsDraft = z.infer<typeof FindingsDraftSchema>;
