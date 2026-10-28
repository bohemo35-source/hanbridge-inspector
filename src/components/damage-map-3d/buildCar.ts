// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Procedural brand-neutral car: lofted body split into 13 panels + glass, wheels, lights, seams, explode vectors
// @created: 2026-10-28
import * as THREE from "three";
import { templateFor, type BodyParams, type BodyType } from "./bodyTemplates";
import { PANEL_IDS, type PanelId } from "./panels";

export type PartKind = "panel" | "glass" | "trim" | "wheel" | "light" | "inner";

export interface CarPart {
  id: string;
  kind: PartKind;
  object: THREE.Object3D;
  /** world-space centre of the part when assembled */
  center: THREE.Vector3;
  /** average outward normal (panels only) */
  normal: THREE.Vector3;
  /** offset applied at explode = 1 */
  explode: THREE.Vector3;
  /** panel outline, moves with the panel (panels only) */
  seams?: THREE.LineSegments;
  tris: number;
}

export interface CarModel {
  type: BodyType;
  params: BodyParams;
  root: THREE.Group;
  parts: CarPart[];
  panels: Map<PanelId, CarPart>;
  missingPanels: PanelId[];
  trisTotal: number;
  dispose: () => void;
}

export const BASE_PAINT = "#9aa1aa";

/* ---------- profile helpers ---------- */
function interp(points: [number, number][], z: number): number {
  // points ordered by z decreasing; cosine interpolation between neighbours
  if (z >= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (z <= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [z0, y0] = points[i];
    const [z1, y1] = points[i + 1];
    if (z <= z0 && z >= z1) {
      const t = (z0 - z) / (z0 - z1);
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      return y0 + (y1 - y0) * s;
    }
  }
  return last[1];
}

function halfWidth(p: BodyParams, z: number): number {
  const s = Math.min(1, Math.abs(z) / (p.length / 2));
  return (p.width / 2) * Math.pow(Math.max(0, 1 - Math.pow(s, p.planExp)), 1 / p.planExp);
}

function bottomAt(p: BodyParams, z: number): number {
  let y = p.sill;
  for (const za of [p.axleFront, p.axleRear]) {
    const d = z - za;
    if (Math.abs(d) < p.archR) y = Math.max(y, p.tireR + Math.sqrt(p.archR * p.archR - d * d));
  }
  return y;
}

const beltAt = (p: BodyParams, z: number) => {
  const t = (p.length / 2 - z) / p.length; // 0 front → 1 rear
  return p.beltFront + (p.beltRear - p.beltFront) * t;
};
const topAt = (p: BodyParams, z: number) => interp(p.top, z);
const shoulderAt = (p: BodyParams, z: number) => Math.min(beltAt(p, z), topAt(p, z) - 0.05);

/* ---------- grid surface ---------- */
interface Grid {
  nI: number;
  nJ: number;
  pos: Float32Array;
  nor: Float32Array;
}

function gridGeometry(nI: number, nJ: number, fill: (i: number, j: number, out: THREE.Vector3) => void): Grid {
  const pos = new Float32Array(nI * nJ * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < nI; i++)
    for (let j = 0; j < nJ; j++) {
      fill(i, j, v);
      const k = (i * nJ + j) * 3;
      pos[k] = v.x;
      pos[k + 1] = v.y;
      pos[k + 2] = v.z;
    }
  const idx: number[] = [];
  for (let i = 0; i < nI - 1; i++)
    for (let j = 0; j < nJ - 1; j++) {
      const a = i * nJ + j, b = (i + 1) * nJ + j, c = i * nJ + j + 1, d = (i + 1) * nJ + j + 1;
      idx.push(a, c, b, c, d, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // orientation check: the middle top vertex must face up
  const mid = (Math.floor(nI / 2) * nJ + Math.floor(nJ / 2)) * 3;
  const nor = g.getAttribute("normal").array as Float32Array;
  if (nor[mid + 1] < 0) for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
  return { nI, nJ, pos, nor: new Float32Array(nor) };
}

const vAt = (g: Grid, i: number, j: number, out: THREE.Vector3) => {
  const k = (i * g.nJ + j) * 3;
  return out.set(g.pos[k], g.pos[k + 1], g.pos[k + 2]);
};
const nAt = (g: Grid, i: number, j: number, out: THREE.Vector3) => {
  const k = (i * g.nJ + j) * 3;
  return out.set(g.nor[k], g.nor[k + 1], g.nor[k + 2]);
};

/** Build one mesh per label from quads of a grid; returns geometries + seam segments per label. */
function splitGrid(g: Grid, label: (i: number, j: number) => string | null) {
  const nQi = g.nI - 1, nQj = g.nJ - 1;
  const labels: (string | null)[] = new Array(nQi * nQj);
  for (let i = 0; i < nQi; i++) for (let j = 0; j < nQj; j++) labels[i * nQj + j] = label(i, j);
  const L = (i: number, j: number) => (i < 0 || j < 0 || i >= nQi || j >= nQj ? null : labels[i * nQj + j]);

  const out = new Map<string, { pos: number[]; nor: number[]; idx: number[]; map: Map<number, number>; seams: number[] }>();
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const vert = (o: ReturnType<typeof bucket>, vi: number) => {
    let k = o.map.get(vi);
    if (k === undefined) {
      k = o.pos.length / 3;
      o.map.set(vi, k);
      o.pos.push(g.pos[vi * 3], g.pos[vi * 3 + 1], g.pos[vi * 3 + 2]);
      o.nor.push(g.nor[vi * 3], g.nor[vi * 3 + 1], g.nor[vi * 3 + 2]);
    }
    return k;
  };
  function bucket(id: string) {
    let o = out.get(id);
    if (!o) {
      o = { pos: [], nor: [], idx: [], map: new Map(), seams: [] };
      out.set(id, o);
    }
    return o;
  }
  const seamPt = (o: ReturnType<typeof bucket>, i: number, j: number) => {
    vAt(g, i, j, v);
    nAt(g, i, j, n);
    o.seams.push(v.x + n.x * 0.004, v.y + n.y * 0.004, v.z + n.z * 0.004);
  };
  for (let i = 0; i < nQi; i++)
    for (let j = 0; j < nQj; j++) {
      const id = labels[i * nQj + j];
      if (!id) continue;
      const o = bucket(id);
      const a = vert(o, i * g.nJ + j), b = vert(o, (i + 1) * g.nJ + j), c = vert(o, i * g.nJ + j + 1), d = vert(o, (i + 1) * g.nJ + j + 1);
      o.idx.push(a, c, b, c, d, b);
      // edges where the neighbour has another label → seam
      if (L(i - 1, j) !== id) { seamPt(o, i, j); seamPt(o, i, j + 1); }
      if (L(i + 1, j) !== id) { seamPt(o, i + 1, j); seamPt(o, i + 1, j + 1); }
      if (L(i, j - 1) !== id) { seamPt(o, i, j); seamPt(o, i + 1, j); }
      if (L(i, j + 1) !== id) { seamPt(o, i, j + 1); seamPt(o, i + 1, j + 1); }
    }
  const res = new Map<string, { geo: THREE.BufferGeometry; seams: Float32Array; tris: number }>();
  for (const [id, o] of out) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(o.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(o.nor, 3));
    geo.setIndex(o.idx);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    res.set(id, { geo, seams: new Float32Array(o.seams), tris: o.idx.length / 3 });
  }
  return res;
}

/* ---------- materials ---------- */
export function makePaintMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: BASE_PAINT,
    metalness: 0.55,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new THREE.Color("#000000"),
  });
}

/* ---------- main builder ---------- */
export function buildCar(type: BodyType, opts: { doors?: 3 | 5; stations?: number } = {}): CarModel {
  const p = templateFor(type, opts.doors);
  const root = new THREE.Group();
  root.name = `car-${type}`;
  const parts: CarPart[] = [];
  const disposables: { dispose: () => void }[] = [];
  const half = p.length / 2;

  /* lower body */
  const nI = opts.stations ?? 200;
  const KS = 16, KT = 40; // points per side / across top
  const nJ = KS + KT + KS + 1;
  const zOf = (i: number) => half - (i / (nI - 1)) * p.length;
  const lower = gridGeometry(nI, nJ, (i, j, out) => {
    const z = zOf(i);
    const w = halfWidth(p, z);
    const yb = bottomAt(p, z);
    const ysh = Math.max(yb + 0.02, shoulderAt(p, z));
    const yt = Math.max(ysh + 0.005, topAt(p, z));
    if (j <= KS) {
      // left side, bottom → shoulder
      const t = j / KS;
      const y = yb + (ysh - yb) * t;
      const bulge = 1 - 0.05 * Math.pow(2 * t - 1, 2);
      out.set(-w * bulge, y, z);
    } else if (j <= KS + KT) {
      // top arc, left → right
      const t = (j - KS) / KT; // 0..1
      const phi = Math.PI * (1 - t);
      const c = Math.cos(phi), s = Math.sin(phi);
      const n = 4;
      const x = w * 0.95 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = ysh + (yt - ysh) * Math.pow(Math.abs(s), 2 / n);
      out.set(x, y, z);
    } else {
      const t = 1 - (j - KS - KT) / KS;
      const y = yb + (ysh - yb) * t;
      const bulge = 1 - 0.05 * Math.pow(2 * t - 1, 2);
      out.set(w * bulge, y, z);
    }
  });

  const v = new THREE.Vector3(), n = new THREE.Vector3(), tmp = new THREE.Vector3();
  const quadCenter = (g: Grid, i: number, j: number) => {
    v.set(0, 0, 0);
    n.set(0, 0, 0);
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      v.add(vAt(g, i + di, j + dj, tmp));
      n.add(nAt(g, i + di, j + dj, tmp));
    }
    v.multiplyScalar(0.25);
    n.normalize();
  };

  const lowerLabel = (i: number, j: number): string | null => {
    quadCenter(lower, i, j);
    const { x, y, z } = v;
    const w = halfWidth(p, z);
    const left = x > 0; // car's left side is +x when the front faces +z
    if (z > p.frontBumperStart) return y < p.bumperTopFront + 0.06 ? "front_bumper" : "hood";
    if (z < p.rearBumperStart) return y < p.bumperTopRear ? "rear_bumper" : "trunk";
    const top = n.y > 0.6 && Math.abs(x) < 0.9 * w;
    if (top) {
      if (z > p.zA) return "hood";
      if (z < p.zB) return "trunk";
      return null; // under the greenhouse, hidden
    }
    const side = left ? "left" : "right";
    if (z > p.doorFrontStart) return `front_${side}_fender`;
    if (z > p.bPillar) return `front_${side}_door`;
    if (p.rearDoors && z > p.rearDoorEnd) return `rear_${side}_door`;
    return `rear_${side}_fender`;
  };
  const lowerParts = splitGrid(lower, lowerLabel);

  /* greenhouse */
  const nG = Math.round(nI * ((p.zA - p.zB) / p.length)) + 2;
  const GS = 10, GT = 30;
  const nGJ = GS + GT + GS + 1;
  const zg = (i: number) => p.zA - (i / (nG - 1)) * (p.zA - p.zB);
  const green = gridGeometry(nG, nGJ, (i, j, out) => {
    const z = zg(i);
    const w = halfWidth(p, z);
    const y0 = shoulderAt(p, z) - 0.005;
    const r = Math.max(y0 + 0.004, interp(p.roof, z));
    const crown = Math.min(0.07, (r - y0) * 0.35);
    const ys = r - crown;
    const wb = w * 0.93, wt = w * 0.72;
    if (j <= GS) {
      const t = j / GS;
      out.set(-(wb + (wt - wb) * t), y0 + (ys - y0) * t, z);
    } else if (j <= GS + GT) {
      const t = (j - GS) / GT;
      const phi = Math.PI * (1 - t);
      const c = Math.cos(phi), s = Math.sin(phi);
      out.set(wt * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3), ys + crown * Math.pow(Math.abs(s), 2 / 3), z);
    } else {
      const t = 1 - (j - GS - GT) / GS;
      out.set(wb + (wt - wb) * t, y0 + (ys - y0) * t, z);
    }
  });
  const greenLabel = (i: number, j: number): string => {
    quadCenter(green, i, j);
    const { x, z } = v;
    const wt = halfWidth(p, z) * 0.72;
    if (n.y > 0.72 && z < p.roofFront && z > p.roofRear && Math.abs(x) < 0.9 * wt) return "roof";
    if (Math.abs(n.y) < 0.75 && Math.abs(z - p.bPillar) < 0.05) return "pillar";
    return "glass";
  };
  const greenParts = splitGrid(green, greenLabel);

  /* inner dark tub (shows through panel gaps and in exploded view) */
  const innerGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(lower.pos.length);
    for (let k = 0; k < pos.length; k += 3) {
      pos[k] = lower.pos[k] * 0.975;
      pos[k + 1] = (lower.pos[k + 1] - 0.62) * 0.975 + 0.62;
      pos[k + 2] = lower.pos[k + 2] * 0.985;
    }
    innerGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const idx: number[] = [];
    for (let i = 0; i < nI - 1; i++)
      for (let j = 0; j < nJ - 1; j++) {
        const a = i * nJ + j, b = (i + 1) * nJ + j, c = i * nJ + j + 1, d = (i + 1) * nJ + j + 1;
        idx.push(a, c, b, c, d, b);
      }
    innerGeo.setIndex(idx);
    innerGeo.computeVertexNormals();
  }
  const innerMat = new THREE.MeshStandardMaterial({ color: "#07090c", roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.name = "inner";
  root.add(inner);
  disposables.push(innerGeo, innerMat);
  parts.push({ id: "inner", kind: "inner", object: inner, center: new THREE.Vector3(), normal: new THREE.Vector3(), explode: new THREE.Vector3(), tris: (nI - 1) * (nJ - 1) * 2 });

  /* materials */
  const glassMat = new THREE.MeshPhysicalMaterial({ color: "#1b2532", metalness: 0.15, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#16191e", metalness: 0.4, roughness: 0.45 });
  const seamMat = new THREE.LineBasicMaterial({ color: "#030405", transparent: true, opacity: 0.9 });
  disposables.push(glassMat, trimMat, seamMat);

  const sideOf = (id: string) => (id.includes("left") ? 1 : id.includes("right") ? -1 : 0);
  const explodeFor = (id: string, c: THREE.Vector3): THREE.Vector3 => {
    const s = sideOf(id);
    switch (id) {
      case "roof": return new THREE.Vector3(0, 1.05, 0);
      case "hood": return new THREE.Vector3(0, 0.7, 0.55);
      case "trunk": return p.type === "sedan" ? new THREE.Vector3(0, 0.65, -0.6) : new THREE.Vector3(0, 0.35, -0.85);
      case "front_bumper": return new THREE.Vector3(0, 0, 0.9);
      case "rear_bumper": return new THREE.Vector3(0, 0, -0.9);
      case "glass": case "pillar": return new THREE.Vector3(0, 0.55, 0);
      default:
        if (id.endsWith("_door")) return new THREE.Vector3(s * 0.95, 0, 0);
        if (id.startsWith("front_")) return new THREE.Vector3(s * 0.8, 0.05, 0.4);
        if (id.startsWith("rear_")) return new THREE.Vector3(s * 0.8, 0.05, -0.4);
        return c.clone().setY(0).normalize().multiplyScalar(0.6);
    }
  };

  const addSurfacePart = (id: string, kind: PartKind, geo: THREE.BufferGeometry, seams: Float32Array | null, tris: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = id;
    mesh.userData.partId = id;
    const holder = new THREE.Group();
    holder.name = `part:${id}`;
    holder.add(mesh);
    let seamObj: THREE.LineSegments | undefined;
    if (seams && seams.length) {
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(seams, 3));
      seamObj = new THREE.LineSegments(sg, seamMat.clone());
      seamObj.name = `seams:${id}`;
      holder.add(seamObj);
      disposables.push(sg, seamObj.material as THREE.Material);
    }
    root.add(holder);
    disposables.push(geo);
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    // average normal
    const na = geo.getAttribute("normal");
    const avg = new THREE.Vector3();
    for (let k = 0; k < na.count; k++) avg.add(tmp.fromBufferAttribute(na, k));
    avg.normalize();
    const part: CarPart = { id, kind, object: holder, center, normal: avg, explode: explodeFor(id, center), seams: seamObj, tris };
    parts.push(part);
    return part;
  };

  const panels = new Map<PanelId, CarPart>();
  const panelParts = new Map<string, { geo: THREE.BufferGeometry; seams: Float32Array; tris: number }>();
  for (const [id, r] of lowerParts) panelParts.set(id, r);
  const roof = greenParts.get("roof");
  if (roof) panelParts.set("roof", roof);
  for (const [id, r] of panelParts) {
    const mat = makePaintMaterial();
    disposables.push(mat);
    const part = addSurfacePart(id, "panel", r.geo, r.seams, r.tris, mat);
    if ((PANEL_IDS as readonly string[]).includes(id)) panels.set(id as PanelId, part);
  }
  const glass = greenParts.get("glass");
  if (glass) addSurfacePart("glass", "glass", glass.geo, null, glass.tris, glassMat);
  const pillar = greenParts.get("pillar");
  if (pillar) addSurfacePart("pillar", "trim", pillar.geo, null, pillar.tris, trimMat);

  /* wheels */
  const tireMat = new THREE.MeshStandardMaterial({ color: "#0d0e10", roughness: 0.92, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: "#b8bdc4", roughness: 0.28, metalness: 1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: "#2a2e34", roughness: 0.5, metalness: 0.6 });
  disposables.push(tireMat, rimMat, hubMat);
  const tireGeo = new THREE.CylinderGeometry(p.tireR, p.tireR, p.tireW, 48, 1);
  const rimGeo = new THREE.CylinderGeometry(p.tireR * 0.7, p.tireR * 0.7, 0.02, 40, 1);
  const spokeGeo = new THREE.BoxGeometry(0.02, p.tireR * 1.34, 0.05);
  disposables.push(tireGeo, rimGeo, spokeGeo);
  for (const [name, za, side] of [
    ["wheel_fl", p.axleFront, 1],
    ["wheel_fr", p.axleFront, -1],
    ["wheel_rl", p.axleRear, 1],
    ["wheel_rr", p.axleRear, -1],
  ] as const) {
    const g = new THREE.Group();
    g.name = `part:${name}`;
    const x = side * (halfWidth(p, za) * 0.97 - p.tireW / 2);
    const wheel = new THREE.Group();
    wheel.position.set(x, p.tireR, za);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeo, hubMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.x = side * (p.tireW / 2 + 0.002);
    wheel.add(tire, rim);
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Mesh(spokeGeo, rimMat);
      sp.position.x = side * (p.tireW / 2 + 0.014);
      sp.rotation.x = (k / 5) * Math.PI * 2;
      wheel.add(sp);
    }
    g.add(wheel);
    root.add(g);
    parts.push({ id: name, kind: "wheel", object: g, center: new THREE.Vector3(x, p.tireR, za), normal: new THREE.Vector3(side, 0, 0), explode: new THREE.Vector3(side * 0.65, 0, 0), tris: 0 });
  }

  /* light bars (brand-neutral full-width strips) */
  const lightBar = (front: boolean) => {
    const y = (front ? p.bumperTopFront : p.bumperTopRear) + 0.07;
    // walk from the end inward until the body is wide enough
    let z = front ? half : -half;
    const step = front ? -0.005 : 0.005;
    const target = (p.width / 2) * 0.46;
    for (let k = 0; k < 200 && halfWidth(p, z) < target; k++) z += step;
    const geo = new THREE.BoxGeometry(target * 2, 0.032, 0.03);
    const mat = new THREE.MeshStandardMaterial({ color: front ? "#f4f6ff" : "#ff2a2a", emissive: front ? "#dfe8ff" : "#ff1a1a", emissiveIntensity: front ? 2.2 : 1.8 });
    disposables.push(geo, mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, y, z + (front ? -0.012 : 0.012));
    const g = new THREE.Group();
    g.name = `part:light_${front ? "front" : "rear"}`;
    g.add(m);
    root.add(g);
    parts.push({ id: `light_${front ? "front" : "rear"}`, kind: "light", object: g, center: m.position.clone(), normal: new THREE.Vector3(0, 0, front ? 1 : -1), explode: new THREE.Vector3(0, 0, front ? 0.9 : -0.9), tris: 12 });
  };
  lightBar(true);
  lightBar(false);

  const missingPanels = PANEL_IDS.filter((id) => !panels.has(id));
  const trisTotal = parts.reduce((s, x) => s + x.tris, 0);
  return {
    type,
    params: p,
    root,
    parts,
    panels,
    missingPanels,
    trisTotal,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/** Axis-aligned boxes of panels at a given explode factor (for overlap checks). */
export function panelBoxes(model: CarModel, t: number): Map<string, THREE.Box3> {
  const res = new Map<string, THREE.Box3>();
  for (const part of model.parts) {
    if (part.kind !== "panel") continue;
    const mesh = part.object.children[0] as THREE.Mesh;
    const box = mesh.geometry.boundingBox!.clone();
    box.translate(part.explode.clone().multiplyScalar(t));
    res.set(part.id, box);
  }
  return res;
}
