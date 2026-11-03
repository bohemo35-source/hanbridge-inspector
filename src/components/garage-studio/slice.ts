// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Template bodies: exact panel borders. Triangles that straddle a panel border are cut along the classifier's planes (u/v/w thresholds),
//           each piece goes to its own panel, and the cut lines between two different pieces come back as seam segments (drawn as thin shut lines)
// @created: 2026-11-03

export type Vec3 = { x: number; y: number; z: number };
/** one corner: position (car space), smooth normal, uv */
export interface Corner { p: [number, number, number]; n: [number, number, number]; uv: [number, number] }
/** (u, v, w, face normal) → piece key; u = x/(L/2) (+1 front), v = height share (0 floor), w = z/(W/2) (-1 left) */
export type Classify = (u: number, v: number, w: number, n: Vec3, doors: 3 | 5) => string;
export interface Frame { L: number; H: number; W: number; minY: number; doors: 3 | 5 }

/** every u / v / w value where classifyTriangle can change its answer (normal tests are per face, they never split a face) */
export const CUTS = {
  u: [0.84, 0.72, 0.44, 0.36, 0.3, -0.06, -0.32, -0.44, -0.46, -0.55, -0.74, -0.84],
  v: [0.12, 0.36, 0.42, 0.45, 0.55, 0.6, 0.82, 0.84, 0.86],
  w: [-0.85, -0.8, -0.55, -0.5, 0, 0.5, 0.55, 0.8, 0.85],
} as const;
type Axis = keyof typeof CUTS;

const lerpC = (a: Corner, b: Corner, t: number): Corner => ({
  p: [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t],
  n: [a.n[0] + (b.n[0] - a.n[0]) * t, a.n[1] + (b.n[1] - a.n[1]) * t, a.n[2] + (b.n[2] - a.n[2]) * t],
  uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * t, a.uv[1] + (b.uv[1] - a.uv[1]) * t],
});

export function sliceTriangle(tri: [Corner, Corner, Corner], faceN: Vec3, f: Frame, classify: Classify) {
  const coord = (c: { p: [number, number, number] }, ax: Axis) => (ax === "u" ? c.p[0] / (f.L / 2) : ax === "v" ? (c.p[1] - f.minY) / f.H : c.p[2] / (f.W / 2));
  const keyAt = (p: [number, number, number]) => classify(p[0] / (f.L / 2), (p[1] - f.minY) / f.H, p[2] / (f.W / 2), faceN, f.doors);
  const centroid = (poly: Corner[]) => poly.reduce<[number, number, number]>((s, c) => [s[0] + c.p[0] / poly.length, s[1] + c.p[1] / poly.length, s[2] + c.p[2] / poly.length], [0, 0, 0]);
  const whole = keyAt(centroid(tri));
  if (tri.every((c) => keyAt(c.p) === whole)) return { pieces: [{ key: whole, tris: [tri] }], seams: [] as [number, number, number][][], cut: false };

  // cut the polygon list by every threshold plane that passes through the triangle
  let polys: Corner[][] = [tri];
  const planes: [Axis, number][] = [];
  for (const ax of ["u", "v", "w"] as Axis[]) {
    const vals = tri.map((c) => coord(c, ax)); const lo = Math.min(...vals), hi = Math.max(...vals);
    for (const t of CUTS[ax]) {
      if (t <= lo || t >= hi) continue;
      planes.push([ax, t]);
      const next: Corner[][] = [];
      for (const poly of polys) {
        const a: Corner[] = [], b: Corner[] = [];
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i], q = poly[(i + 1) % poly.length];
          const dp = coord(p, ax) - t, dq = coord(q, ax) - t;
          (dp < 0 ? a : b).push(p);
          if ((dp < 0) !== (dq < 0)) { const x = lerpC(p, q, dp / (dp - dq)); a.push(x); b.push(x); }
        }
        if (a.length >= 3) next.push(a);
        if (b.length >= 3) next.push(b);
      }
      polys = next;
    }
  }
  const byKey = new Map<string, [Corner, Corner, Corner][]>();
  const seams: [number, number, number][][] = [];
  const EPS = 1e-4;
  for (const poly of polys) {
    const k = keyAt(centroid(poly));
    let list = byKey.get(k); if (!list) byKey.set(k, (list = []));
    for (let i = 1; i + 1 < poly.length; i++) list.push([poly[0], poly[i], poly[i + 1]]);
    // edges lying on a cut plane: a seam when the other side belongs to another piece (each seam kept once: from the smaller key)
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      for (const [ax, t] of planes) {
        if (Math.abs(coord(p, ax) - t) > EPS || Math.abs(coord(q, ax) - t) > EPS) continue;
        const mid: [number, number, number] = [(p.p[0] + q.p[0]) / 2, (p.p[1] + q.p[1]) / 2, (p.p[2] + q.p[2]) / 2];
        const side = Math.sign(coord({ p: centroid(poly) }, ax) - t) || 1;
        const probe: [number, number, number] = [...mid];
        const step = 2e-3 * -side, idx = ax === "u" ? 0 : ax === "v" ? 1 : 2, scale = ax === "u" ? f.L / 2 : ax === "v" ? f.H : f.W / 2;
        probe[idx] += step * scale;
        const other = keyAt(probe);
        if (other !== k && k < other && k.startsWith("p:") && other.startsWith("p:")) seams.push([p.p, q.p]); // shut lines between two panels only
      }
    }
  }
  return { pieces: [...byKey].map(([key, tris]) => ({ key, tris })), seams, cut: true };
}
