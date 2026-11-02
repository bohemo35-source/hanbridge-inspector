// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Shrink Tripo body templates for the web: weld + simplify (meshoptimizer), textures → WebP ≤1024 px (sharp), meshopt compression
// @created: 2026-11-02
// usage (deps are not in the app: npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp in a scratch dir):
//   node scripts/bodies/optimize.mjs <in.glb> <out.glb> [ratio=0.3]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, textureCompress, meshopt, resample } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [inp, out, r = "0.3"] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(inp);
await doc.transform(
  dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Number(r), error: Number(process.env.ERR ?? 0.01) }), resample(), prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(out, doc);
const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0);
console.log(out, "triangles", Math.round(tris));
