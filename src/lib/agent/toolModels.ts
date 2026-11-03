// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: which model / rule runs each agent tool — one map for the report trace and the landing step log
// @created: 2026-11-03
export const TOOL_MODEL: Record<string, string> = {
  index_photos: "Muse Glimmer", read_diagnostic_report: "Muse Spark", read_inspector_report: "Muse Spark", find_defects: "SAM 3.1 + Muse Spark",
  transcribe_note: "Muse Voice Transcribe + Muse Spark", read_gauge_video: "Muse Spark", analyze_paint_readings: "rules", estimate_landed_cost: "manager quote",
  make_listing_photo: "SAM 3.1 + Muse Image", finalize_report: "Muse Spark", verifier: "Muse Spark Open", recheck_panel: "Glimmer index + SAM 3.1 + Muse Spark",
  context_check: "rules", conflict_check: "rules",
};
