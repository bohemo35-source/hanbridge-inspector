// Build kia-sportage-parts.glb: Kia islands -> 22 nodes named like the Tripo part map (tripo_part_N), world space, +X front, left -Z.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { meshopt, weld } from '@gltf-transform/functions';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const src = await io.read(process.argv[2]);
const scene = src.getRoot().listScenes()[0];
const wrap = src.createNode('r').setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
for (const c of scene.listChildren()) { scene.removeChild(c); wrap.addChild(c); } scene.addChild(wrap);
const mul = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const RE = {
  wheel: /Main_(plastic_matte|metal_rim|tread|brakes_rotors|metal_brakes|paint_glossy_tertiary)|chrome_shiny/,
  cabin: /leather|carpet|interior|stitch|almdetail|new_project_49|Matte__99CC|Windows|windsmask/,
  mirror: /mirror/,
  front: /HeadLightsGlass|DRLs|exteriorost/,
  rear: /BrakeLights|RedMain|Red1|shader_(rear|brake|turn)/,
};
const parts = new Map(); // id -> {pos:[], nrm:[]}
const stats = new Map();
function classify(mat, c, s) {
  const L = c[2] < 0;
  if (RE.wheel.test(mat)) { const front = c[0] > 0; return front ? (L ? 4 : 1) : (L ? 5 : 2); }
  if (RE.mirror.test(mat) && Math.abs(c[0]) > 2.3 && Math.abs(c[2]) < 0.35 && s[2] < 0.4) return -1; // emblems removed
  if (RE.mirror.test(mat)) return (Math.abs(c[2]) > 0.8 && c[1] > 0.9 && c[0] > 0.2 && c[0] < 1.2 && s[0] < 0.5) ? (L ? 18 : 10) : 0;
  if (RE.cabin.test(mat)) return 0;
  if (RE.front.test(mat)) return c[0] > 0 ? 21 : 19;
  if (RE.rear.test(mat)) return c[0] < -2.0 && c[1] < 0.9 ? 20 : 19;
  if (/SilverSkid/.test(mat)) return 13;
  // body-like islands (paint, black cladding, chrome trims)
  if (s[0] > 2.2) return c[1] < 0.55 ? 8 : 0;          // sills / roof rails / long trims
  if (c[1] < 0.22 && s[0] > 0.8) return 6;             // under trays
  if (Math.abs(c[2]) > 0.8 && c[1] > 0.95 && c[1] < 1.3 && Math.abs(c[0] - 0.6) < 0.5 && s[0] < 0.45) return L ? 18 : 10; // mirror caps
  if (c[0] > 1.95) return 16;                           // front bumper
  if (c[0] > 0.95) return (c[1] > 0.85 && s[2] > 1.0) ? 9 : 15; // hood / front fenders
  if (c[0] < -2.05 && c[1] < 0.85) return 13;                          // rear bumper
  if (c[0] < -1.2) return (c[1] > 1.45 && s[2] > 0.9) ? 14 : 3; // spoiler / tailgate + rear quarters
  if (c[1] < 0.3) return 8;
  if (c[1] > 1.55) return 0;                            // roof
  if (Math.abs(c[2]) > 0.55) return c[0] > -0.05 ? (L ? 12 : 11) : (L ? 7 : 17); // doors
  return 0;
}
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()?.getName() || '';
    const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), idx = prim.getIndices();
    const n = pos.getCount(); const p = [0,0,0];
    const W = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos.getElement(i, p); W.set(mul(M, p), i*3); }
    const NW = new Float32Array(n * 3); if (nor) for (let i = 0; i < n; i++) { nor.getElement(i, p); const a = mul(M,p), o = mul(M,[0,0,0]); const v=[a[0]-o[0],a[1]-o[1],a[2]-o[2]]; const l=Math.hypot(...v)||1; NW.set([v[0]/l,v[1]/l,v[2]/l], i*3); }
    const key = new Map(), rep = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = `${Math.round(W[i*3]*4000)},${Math.round(W[i*3+1]*4000)},${Math.round(W[i*3+2]*4000)}`; if (!key.has(k)) key.set(k, i); rep[i] = key.get(k); }
    const par = Int32Array.from({ length: n }, (_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const tri = idx ? idx.getCount() / 3 : n / 3; const I = (k) => idx ? idx.getScalar(k) : k;
    for (let t = 0; t < tri; t++) { const a = rep[I(3*t)], b = rep[I(3*t+1)], c = rep[I(3*t+2)]; par[f(a)] = f(b); par[f(b)] = f(c); }
    const comps = new Map();
    for (let t = 0; t < tri; t++) { const r = f(rep[I(3*t)]); let c = comps.get(r); if (!c) { c = { t: [], min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] }; comps.set(r, c); } c.t.push(t);
      for (let j = 0; j < 3; j++) { const v = I(3*t+j); for (let d = 0; d < 3; d++) { c.min[d] = Math.min(c.min[d], W[v*3+d]); c.max[d] = Math.max(c.max[d], W[v*3+d]); } } }
    for (const c of comps.values()) {
      const ctr = c.min.map((v, d) => (v + c.max[d]) / 2), sz = c.min.map((v, d) => c.max[d] - v);
      const id = classify(mat, ctr, sz); if (id < 0) continue;
      if (process.env.FIND && ((ctr[0] > 2.2 || ctr[0] < -2.0) && Math.abs(ctr[2]) < 0.35 && Math.max(...sz) < 0.6)) console.error('CAND', mat.slice(-30), c.t.length, ctr.map(v=>v.toFixed(2)).join(','), sz.map(v=>v.toFixed(2)).join(','));
      let P = parts.get(id); if (!P) { P = { pos: [], nrm: [] }; parts.set(id, P); }
      for (const t of c.t) for (let j = 0; j < 3; j++) { const v = I(3*t+j); P.pos.push(W[v*3], W[v*3+1], W[v*3+2]); P.nrm.push(NW[v*3], NW[v*3+1], NW[v*3+2]); }
      const st = stats.get(id) ?? { tris: 0, min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9], mats: new Set() }; st.tris += c.t.length; st.mats.add(mat.replace(/M_2022_Kia_Sportage_+(WO_Wheels__)?/, '').slice(0, 18));
      for (let d = 0; d < 3; d++) { st.min[d] = Math.min(st.min[d], c.min[d]); st.max[d] = Math.max(st.max[d], c.max[d]); } stats.set(id, st);
    }
  }
}
const out = new Document(); const buf = out.createBuffer(); const sc = out.createScene();
const mat = out.createMaterial('part');
for (const [id, P] of [...parts].sort((a, b) => a[0] - b[0])) {
  const prim = out.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(P.pos)).setBuffer(buf))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(P.nrm)).setBuffer(buf));
  sc.addChild(out.createNode(`tripo_part_${id}`).setMesh(out.createMesh(`tripo_part_${id}`).addPrimitive(prim)));
}
await out.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(process.argv[3], out);
for (const [id, st] of [...stats].sort((a, b) => a[0] - b[0])) console.log(String(id).padStart(2), String(st.tris).padStart(6), 'x', st.min[0].toFixed(2), st.max[0].toFixed(2), 'y', st.min[1].toFixed(2), st.max[1].toFixed(2), 'z', st.min[2].toFixed(2), st.max[2].toFixed(2), [...st.mats].join(' '));
