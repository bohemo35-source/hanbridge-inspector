// Run from a folder with @gltf-transform/core,extensions,functions@4 + meshoptimizer installed: node prep-hero.mjs kia_sportage.glb public/models/kia-sportage.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { dedup, prune, weld, meshopt, flatten, join, getBounds } from '@gltf-transform/functions';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder});
const doc = await io.read(process.argv[2]);
const scene = doc.getRoot().listScenes()[0];
const wrap = doc.createNode('kia_root').setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]); // +90° Y: front +Z -> +X
for (const c of scene.listChildren()) { scene.removeChild(c); wrap.addChild(c); }
scene.addChild(wrap);
import { KHRMaterialsClearcoat } from '@gltf-transform/extensions';
const cc = doc.createExtension(KHRMaterialsClearcoat);
for (const m of doc.getRoot().listMaterials()) {
  const n = m.getName();
  if (/Wolf_Gray/.test(n)) { m.setBaseColorFactor([0.26, 0.27, 0.29, 1]).setMetallicFactor(0.4).setRoughnessFactor(0.42); m.setExtension('KHR_materials_clearcoat', cc.createClearcoat().setClearcoatFactor(0.6).setClearcoatRoughnessFactor(0.08)); }
  else if (/chrome_shiny|ChromeTrims|metal_rim|SilverSkid/.test(n)) { m.setMetallicFactor(1).setRoughnessFactor(0.18); }
  else if (/Windows|HeadLightsGlass|BrakeLightsGlass/.test(n)) { m.setRoughnessFactor(0.03).setMetallicFactor(0); }
  else if (/1black|windsmask/.test(n)) { m.setRoughnessFactor(0.35); }
  else if (/DRLs/.test(n)) { m.setEmissiveFactor([0,0,0]).setBaseColorFactor([0.75,0.77,0.8,1]).setRoughnessFactor(0.2); }
}
// --- remove Kia emblems: small chrome (mirror.001) islands on the centre line at the very front/back
const mulM = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
let removed = 0;
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) { if (!/^mirror/.test(prim.getMaterial()?.getName() || '')) continue;
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(); const n = pos.getCount(); const p = [0,0,0];
    const W = []; for (let i = 0; i < n; i++) { pos.getElement(i, p); W.push(mulM(M, p)); }
    const key = new Map(), rep = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = W[i].map(v => Math.round(v*4000)).join(','); if (!key.has(k)) key.set(k, i); rep[i] = key.get(k); }
    const par = Int32Array.from({ length: n }, (_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const tri = idx.getCount() / 3;
    for (let t = 0; t < tri; t++) { const a = rep[idx.getScalar(3*t)], b = rep[idx.getScalar(3*t+1)], c = rep[idx.getScalar(3*t+2)]; par[f(a)] = f(b); par[f(b)] = f(c); }
    const box = new Map();
    for (let t = 0; t < tri; t++) { const r = f(rep[idx.getScalar(3*t)]); let b = box.get(r); if (!b) { b = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] }; box.set(r, b); }
      for (let j = 0; j < 3; j++) { const v = W[idx.getScalar(3*t+j)]; for (let d = 0; d < 3; d++) { b.min[d] = Math.min(b.min[d], v[d]); b.max[d] = Math.max(b.max[d], v[d]); } } }
    const drop = new Set([...box].filter(([, b]) => { const c = b.min.map((v, d) => (v + b.max[d]) / 2); const w = b.max[2] - b.min[2]; return Math.abs(c[0]) > 2.3 && Math.abs(c[2]) < 0.35 && w < 0.4; }).map(([r]) => r));
    const keep = []; for (let t = 0; t < tri; t++) { if (drop.has(f(rep[idx.getScalar(3*t)]))) { removed++; continue; } keep.push(idx.getScalar(3*t), idx.getScalar(3*t+1), idx.getScalar(3*t+2)); }
    idx.setArray(new Uint32Array(keep));
  } }
console.log('emblem triangles removed', removed);
await doc.transform(dedup(), flatten(), prune(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
console.log(JSON.stringify(getBounds(scene)));
for (const m of doc.getRoot().listMaterials()) console.log(m.getName(), m.getBaseColorFactor().map(v=>v.toFixed(2)).join(','), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'alpha', m.getAlphaMode(), m.getBaseColorTexture()?'tex':'');
await io.write(process.argv[3], doc);
