// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Shared 13 body panels dictionary (moved from TZ-06 3D map) + unknown
// @created: 2026-10-28

// Ids match FINDINGS_DRAFT_SPEC in src/lib/schema/prompt.ts. Id and order must not change.
export const PANELS = [
  { id: "front_bumper", en: "Front bumper", ru: "Передний бампер" },
  { id: "hood", en: "Hood", ru: "Капот" },
  { id: "front_left_fender", en: "Front left fender", ru: "Крыло переднее левое" },
  { id: "front_right_fender", en: "Front right fender", ru: "Крыло переднее правое" },
  { id: "front_left_door", en: "Front left door", ru: "Дверь передняя левая" },
  { id: "front_right_door", en: "Front right door", ru: "Дверь передняя правая" },
  { id: "rear_left_door", en: "Rear left door", ru: "Дверь задняя левая" },
  { id: "rear_right_door", en: "Rear right door", ru: "Дверь задняя правая" },
  { id: "rear_left_fender", en: "Rear left fender", ru: "Крыло заднее левое" },
  { id: "rear_right_fender", en: "Rear right fender", ru: "Крыло заднее правое" },
  { id: "trunk", en: "Trunk / tailgate", ru: "Багажник / дверь багажника" },
  { id: "rear_bumper", en: "Rear bumper", ru: "Задний бампер" },
  { id: "roof", en: "Roof", ru: "Крыша" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];
/** Panel value used in findings: one of the 13 panels or "unknown". */
export type Panel = PanelId | "unknown";
export const PANEL_IDS: readonly PanelId[] = PANELS.map((p) => p.id);
export const PANEL_VALUES: readonly Panel[] = [...PANEL_IDS, "unknown"];
export const isPanelId = (s: string): s is PanelId => (PANEL_IDS as readonly string[]).includes(s);
export const isPanel = (s: string): s is Panel => (PANEL_VALUES as readonly string[]).includes(s);
export const panelLabel = (id: string, lang: "en" | "ru" = "ru") => {
  const p = PANELS.find((x) => x.id === id);
  return p ? p[lang] : id;
};
