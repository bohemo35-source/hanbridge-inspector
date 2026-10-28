// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey route: 7 fixed stages, CatmullRom control points, pure stage<->progress mapping
// @created: 2026-10-28
import * as THREE from "three";

export const STAGE_IDS = [
  "inspection",
  "korea_road",
  "port_busan",
  "sea",
  "vladivostok",
  "customs",
  "delivery",
] as const;

export type StageId = (typeof STAGE_IDS)[number];

export const STAGE_LABELS: Record<StageId, { ru: string; en: string }> = {
  inspection: { ru: "Осмотр в Корее", en: "Inspection in Korea" },
  korea_road: { ru: "Дорога и мост", en: "Road & bridge" },
  port_busan: { ru: "Порт отправки", en: "Departure port" },
  sea: { ru: "Море", en: "Sea crossing" },
  vladivostok: { ru: "Владивосток", en: "Vladivostok" },
  customs: { ru: "Таможня", en: "Customs clearance" },
  delivery: { ru: "Доставка в РФ/СНГ", en: "Delivery to RF/CIS" },
};

/** Zone centres in metres: x east, y up, -z = direction of travel. */
export const ROUTE_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [6, 0, -55],
  [28, 0, -115],
  [70, 0, -175],
  [118, 0, -235],
  [148, 0, -285],
  [185, 0, -350],
];

export function isStageId(v: string | null | undefined): v is StageId {
  return !!v && (STAGE_IDS as readonly string[]).includes(v);
}

/** Stage owning progress (0..1 split into 7 equal segments). Out-of-range clamps. */
export function stageAt(progress: number): StageId {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const i = Math.min(STAGE_IDS.length - 1, Math.floor(p * STAGE_IDS.length));
  return STAGE_IDS[i];
}

/** Start progress of a stage. */
export function progressOf(stage: StageId): number {
  return STAGE_IDS.indexOf(stage) / STAGE_IDS.length;
}

/** Mid-segment progress — where a pinned stage is shown. */
export function progressCenterOf(stage: StageId): number {
  return (STAGE_IDS.indexOf(stage) + 0.5) / STAGE_IDS.length;
}

export function stageIndex(stage: StageId): number {
  return STAGE_IDS.indexOf(stage);
}

export function buildRouteCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    ROUTE_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "catmullrom",
    0.35,
  );
}
