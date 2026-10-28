// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: get_shipping_status tool (TZ-08): shipping stage per demo report from fixture, no invented dates/costs
// @created: 2026-10-28
import fixture from "../fixtures/shipping.json";
import { isStageId, type StageId } from "@/components/journey-3d/route";

export interface ShippingStatus {
  stage: StageId;
  etaDays?: number;
  source: "demo_fixture";
}

const FIXTURE = fixture as Record<string, { stage: string; etaDays?: number }>;

/** Demo fixture lookup. Unknown ids start at inspection — never invent a stage/date. */
export function getShippingStatus(reportId: string): ShippingStatus {
  const row = FIXTURE[reportId];
  if (row && isStageId(row.stage)) {
    return { stage: row.stage, etaDays: typeof row.etaDays === "number" ? row.etaDays : undefined, source: "demo_fixture" };
  }
  return { stage: "inspection", source: "demo_fixture" };
}

export const DEMO_REPORT_IDS = Object.keys(FIXTURE);
