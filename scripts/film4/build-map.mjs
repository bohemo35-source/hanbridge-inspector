// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Build the film v4 map layer from Natural Earth land (world-atlas land-50m topojson, public domain): coastline path (filled with a halftone dot pattern in the component) in the film's equirectangular frame (lon 10..145, lat 30..62 → 1000×500)
// @created: 2026-11-02
// usage: node scripts/film4/build-map.mjs <land-50m.json>  →  src/components/film4/map-data.json
import { readFileSync, writeFileSync } from "node:fs";
const topo = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
const arcs = topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const ring = (ids) => ids.flatMap((id, n) => { const a = id < 0 ? [...arcs[~id]].reverse() : arcs[id]; return n ? a.slice(1) : a; });
const polys = [];
for (const g of topo.objects.land.geometries) {
  const P = g.type === "Polygon" ? [g.arcs] : g.arcs;
  for (const p of P) polys.push(p.map(ring));
}
const LON0 = 10, LON1 = 145, LAT0 = 30, LAT1 = 62;
const X = (lon) => ((lon - LON0) / (LON1 - LON0)) * 1000, Y = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * 500;
// coastline: rings clipped loosely to a padded frame, points thinned to ≥0.9 units apart
const PAD = 6;
let coast = "";
for (const p of polys) for (const r of p) {
  if (!r.some(([lo, la]) => lo > LON0 - PAD && lo < LON1 + PAD && la > LAT0 - PAD && la < LAT1 + PAD)) continue;
  let last = null, seg = "";
  for (const [lo, la] of r) {
    const x = X(lo), y = Y(la);
    if (last && Math.hypot(x - last[0], y - last[1]) < 0.9) continue;
    seg += `${seg ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; last = [x, y];
  }
  coast += seg + "Z";
}
// land dots are an SVG <pattern> filled into the coast path (no per-dot data)
writeFileSync(new URL("../../src/components/film4/map-data.json", import.meta.url), JSON.stringify({ source: "Natural Earth 1:50m land via world-atlas@2.0.2 (public domain)", coast }));
console.log("coast chars", coast.length);
