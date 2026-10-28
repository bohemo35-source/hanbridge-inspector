// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Brand-neutral parametric body templates (sedan / suv / hatchback) for the 3D damage map
// @created: 2026-10-28
//
// Coordinates: metres, y up, car front at +z, centre of the wheelbase-ish at z=0, ground at y=0.
// Profiles are [z, y] pairs ordered front → rear (z decreasing).

export type BodyType = "sedan" | "suv" | "hatchback";
export const BODY_TYPES: readonly BodyType[] = ["sedan", "suv", "hatchback"];

export interface BodyParams {
  type: BodyType;
  length: number;
  width: number;
  /** plan-view superellipse exponent: higher = boxier nose/tail */
  planExp: number;
  axleFront: number;
  axleRear: number;
  tireR: number;
  tireW: number;
  archR: number;
  sill: number;
  beltFront: number;
  beltRear: number;
  /** top of the lower body (hood, deck) */
  top: [number, number][];
  /** greenhouse roofline, from windshield base (zA) to rear window base (zB) */
  roof: [number, number][];
  zA: number;
  zB: number;
  roofFront: number;
  roofRear: number;
  frontBumperStart: number;
  rearBumperStart: number;
  bumperTopFront: number;
  bumperTopRear: number;
  doorFrontStart: number;
  bPillar: number;
  rearDoorEnd: number;
  rearDoors: boolean;
}

export const TEMPLATES: Record<BodyType, BodyParams> = {
  sedan: {
    type: "sedan",
    length: 4.85,
    width: 1.86,
    planExp: 6,
    axleFront: 1.45,
    axleRear: -1.4,
    tireR: 0.335,
    tireW: 0.235,
    archR: 0.4,
    sill: 0.3,
    beltFront: 0.86,
    beltRear: 0.93,
    top: [
      [2.425, 0.6],
      [2.33, 0.72],
      [2.1, 0.79],
      [1.5, 0.85],
      [0.95, 0.9],
      [-1.55, 0.97],
      [-2.25, 0.99],
      [-2.36, 0.93],
      [-2.425, 0.68],
    ],
    roof: [
      [0.95, 0.9],
      [0.55, 1.18],
      [0.15, 1.42],
      [-0.85, 1.43],
      [-1.25, 1.24],
      [-1.55, 0.97],
    ],
    zA: 0.95,
    zB: -1.55,
    roofFront: 0.12,
    roofRear: -0.85,
    frontBumperStart: 2.05,
    rearBumperStart: -2.1,
    bumperTopFront: 0.6,
    bumperTopRear: 0.63,
    doorFrontStart: 0.99,
    bPillar: -0.05,
    rearDoorEnd: -0.94,
    rearDoors: true,
  },
  suv: {
    type: "suv",
    length: 4.7,
    width: 1.9,
    planExp: 8,
    axleFront: 1.42,
    axleRear: -1.4,
    tireR: 0.37,
    tireW: 0.25,
    archR: 0.44,
    sill: 0.42,
    beltFront: 1.0,
    beltRear: 1.06,
    top: [
      [2.35, 0.78],
      [2.26, 0.92],
      [1.95, 1.0],
      [0.85, 1.07],
      [-2.05, 1.1],
      [-2.27, 1.08],
      [-2.35, 0.86],
    ],
    roof: [
      [0.85, 1.07],
      [0.45, 1.42],
      [0.0, 1.68],
      [-1.85, 1.7],
      [-2.1, 1.52],
      [-2.24, 1.1],
    ],
    zA: 0.85,
    zB: -2.24,
    roofFront: -0.02,
    roofRear: -1.85,
    frontBumperStart: 1.98,
    rearBumperStart: -2.05,
    bumperTopFront: 0.72,
    bumperTopRear: 0.76,
    doorFrontStart: 0.92,
    bPillar: -0.1,
    rearDoorEnd: -0.9,
    rearDoors: true,
  },
  hatchback: {
    type: "hatchback",
    length: 4.05,
    width: 1.78,
    planExp: 6,
    axleFront: 1.27,
    axleRear: -1.28,
    tireR: 0.32,
    tireW: 0.225,
    archR: 0.38,
    sill: 0.3,
    beltFront: 0.86,
    beltRear: 0.9,
    top: [
      [2.025, 0.6],
      [1.93, 0.72],
      [1.65, 0.8],
      [0.75, 0.88],
      [-1.7, 0.94],
      [-1.95, 0.93],
      [-2.025, 0.72],
    ],
    roof: [
      [0.75, 0.88],
      [0.4, 1.15],
      [0.05, 1.42],
      [-1.35, 1.43],
      [-1.7, 1.25],
      [-1.9, 0.94],
    ],
    zA: 0.75,
    zB: -1.9,
    roofFront: 0.02,
    roofRear: -1.35,
    frontBumperStart: 1.7,
    rearBumperStart: -1.72,
    bumperTopFront: 0.58,
    bumperTopRear: 0.62,
    doorFrontStart: 0.83,
    bPillar: -0.1,
    rearDoorEnd: -0.84,
    rearDoors: true,
  },
};

/** 3-door hatchback variant: one long door, no rear doors. */
export function templateFor(type: BodyType, doors?: 3 | 5): BodyParams {
  const base = TEMPLATES[type];
  if (type === "hatchback" && doors === 3) {
    return { ...base, bPillar: -0.62, rearDoorEnd: -0.62, rearDoors: false };
  }
  return base;
}
