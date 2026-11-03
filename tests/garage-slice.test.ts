// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Template bodies: triangles on a panel border are cut exactly along the classifier planes; seams only between two panels; Sportage only for Kia
// @created: 2026-11-03
import { describe, expect, it } from "vitest";
import { sliceTriangle, type Corner } from "../src/components/garage-studio/slice";
import { classifyTriangle } from "../src/components/garage-studio/scene";
import { bodyKind } from "../src/lib/garage/data";
import type { Report } from "../src/lib/schema";

const F = { L: 4, H: 1.5, W: 1.8, minY: 0, doors: 5 as const };
const c = (x: number, y: number, z: number): Corner => ({ p: [x, y, z], n: [0, 0, -1], uv: [x, y] });
const side = { x: 0, y: 0, z: -1 }; // left side skin, facing out
const area = (t: Corner[]) => { const [a, b, d] = t.map((k) => k.p); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; return Math.hypot(...x) / 2; };

describe("sliceTriangle", () => {
  it("a triangle inside one panel stays whole", () => {
    const r = sliceTriangle([c(0.3, 0.6, -0.85), c(0.4, 0.6, -0.85), c(0.35, 0.7, -0.85)], side, F, classifyTriangle);
    expect(r.cut).toBe(false);
    expect(r.pieces).toHaveLength(1);
    expect(r.pieces[0].key).toBe("p:front_left_door");
  });
  it("a triangle across the front door / rear door border (u = -0.06) is cut on the plane, area kept, seam on the plane", () => {
    const x = -0.06 * (F.L / 2);
    const tri: [Corner, Corner, Corner] = [c(x - 0.1, 0.5, -0.85), c(x + 0.1, 0.5, -0.85), c(x, 0.7, -0.85)];
    const r = sliceTriangle(tri, side, F, classifyTriangle);
    expect(r.cut).toBe(true);
    expect(r.pieces.map((p) => p.key).sort()).toEqual(["p:front_left_door", "p:rear_left_door"]);
    const total = r.pieces.flatMap((p) => p.tris).reduce((s, t) => s + area(t), 0);
    expect(total).toBeCloseTo(area(tri), 6);
    for (const p of r.pieces) for (const t of p.tris) for (const k of t) {
      if (p.key === "p:front_left_door") expect(k.p[0]).toBeGreaterThanOrEqual(x - 1e-9); else expect(k.p[0]).toBeLessThanOrEqual(x + 1e-9);
    }
    // the seam may come in collinear pieces (the triangle is also cut by height planes): all on u = -0.06, total = the cut length 0.2
    expect(r.seams.length).toBeGreaterThan(0);
    for (const [a, b] of r.seams) { expect(a[0]).toBeCloseTo(x, 9); expect(b[0]).toBeCloseTo(x, 9); }
    expect(r.seams.reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0)).toBeCloseTo(0.2, 6);
  });
  it("no seam between a panel and the cabin (beltline cut is not a shut line)", () => {
    const r = sliceTriangle([c(0.1, 0.55 * F.H, -0.85), c(0.3, 0.55 * F.H, -0.85), c(0.2, 0.68 * F.H, -0.85)], side, F, classifyTriangle);
    expect(r.cut).toBe(true);
    expect(r.pieces.map((p) => p.key).sort()).toEqual(["cabin", "p:front_left_door"]);
    expect(r.seams).toHaveLength(0);
  });
});

describe("bodyKind: the Sportage model only for Kia", () => {
  const rep = (make: string) => ({ vehicle: { make, model: "x", bodyType: "suv" } }) as unknown as Report;
  it("catalog", () => {
    expect(bodyKind("kia-sportage")).toBe("suv_kia");
    expect(bodyKind("bmw-x3-8278")).toBe("suv");
  });
  it("uploads", () => {
    expect(bodyKind("u-1", rep("Kia"))).toBe("suv_kia");
    expect(bodyKind("u-2", rep("Hyundai"))).toBe("suv");
  });
});
