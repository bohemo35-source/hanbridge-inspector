// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 5: top-down long road, terrain changes, route line draws ahead, ends as a simple map
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { setHeadlights, vibrate } from "../useCar";
import { M, face, textSprite, lerp, seg } from "./helpers";
import { blobShadowTexture } from "./PlateScene";

const CITIES: Array<{ name: string; x: number; z: number }> = [
  { name: "Vladivostok", x: 52, z: 66 }, { name: "Novosibirsk", x: 8, z: -6 },
  { name: "Almaty", x: -34, z: 30 }, { name: "Tashkent", x: -58, z: 42 }, { name: "Moscow ~9 000 km · 12–14 days", x: -52, z: -58 },
];
export const buildRoad: SceneBuilder = ({ scene, camera, car, tex, mobile }) => {
  scene.background = new THREE.Color(0x0d1218);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6); sun.position.set(20, 40, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  // larger, more varied map-photo tiles: coast -> forest -> steppe -> suburb(steppe tinted + asphalt repeat)
  const zones = [
    { tex: "/journey-v2/tex-terrain-coast.jpg", z: 82, rep: [8, 3] as [number, number], tint: 0xffffff },
    { tex: "/journey-v2/tex-terrain-forest.jpg", z: 27, rep: [7, 3] as [number, number], tint: 0xe8f0e0 },
    { tex: "/journey-v2/tex-terrain-steppe.jpg", z: -27, rep: [6, 2] as [number, number], tint: 0xffffff },
    { tex: "/journey-v2/tex-terrain-steppe.jpg", z: -82, rep: [9, 4] as [number, number], tint: 0xb8b0a0 },
  ];
  for (const zn of zones) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(260, 56), new THREE.MeshStandardMaterial({ map: tex(zn.tex, zn.rep), roughness: 1, color: zn.tint }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(0, 0, zn.z); tile.receiveShadow = true; scene.add(tile);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.8), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.06; scene.add(blob);
  if (car) car.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 190), new THREE.MeshStandardMaterial({ map: tex("/journey-v2/tex-asphalt-wet.jpg", [1, 16]), roughness: 0.7, color: 0x777d85 }));
  road.rotation.x = -Math.PI / 2; road.rotation.z = 0.5; road.position.y = 0.03; road.receiveShadow = true; scene.add(road);
  // instanced trees in the forest band
  // seen from above: round canopies (flattened icosahedra) with colour/size variation, not cones
  const treeGeo = new THREE.IcosahedronGeometry(1.2, 1); treeGeo.scale(1, 0.55, 1);
  const trees = new THREE.InstancedMesh(treeGeo, M(0xffffff, 1), mobile ? 160 : 420);
  const dummy = new THREE.Object3D();
  const tc = new THREE.Color();
  for (let i = 0; i < trees.count; i++) { dummy.position.set((Math.random() - 0.5) * 170, 0.9, -26 + Math.random() * 48); if (Math.abs(dummy.position.x) < 6) dummy.position.x += 10; dummy.scale.setScalar(0.7 + Math.random() * 0.8); dummy.rotation.y = Math.random() * 6.28; dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix); trees.setColorAt(i, tc.setHSL(0.27 + Math.random() * 0.06, 0.35 + Math.random() * 0.2, 0.16 + Math.random() * 0.1)); }
  trees.castShadow = true;
  scene.add(trees);
  // route line, drawn ahead of the car (endgame: closes into the map)
  const routePts = [new THREE.Vector3(52, 0.25, 66), new THREE.Vector3(26, 0.25, 28), new THREE.Vector3(8, 0.25, -6), new THREE.Vector3(-20, 0.25, -32), new THREE.Vector3(-52, 0.25, -58), new THREE.Vector3(-34, 0.25, 10), new THREE.Vector3(-34, 0.25, 30), new THREE.Vector3(-58, 0.25, 42)];
  const routeGeo = new THREE.BufferGeometry().setFromPoints(routePts);
  const route = new THREE.Line(routeGeo, new THREE.LineBasicMaterial({ color: 0xffc24b }));
  scene.add(route);
  const labels = CITIES.map((c) => { const s = textSprite(c.name); s.position.set(c.x, 2, c.z); s.visible = false; scene.add(s); return s; });
  if (car) { setHeadlights(car, false); face(car, -0.45, -1); }
  const totalPts = routePts.length;
  return {
    triangles: 0,
    update: (p, t) => {
      const drive = seg(p, 0, 0.72), map = seg(p, 0.78, 1);
      // car travels along -z with slight x drift, camera above
      const cz = lerp(68, -58, drive), cx = lerp(4, -16, drive);
      if (car) { car.position.set(cx, 0.05, cz); car.visible = map < 0.85; vibrate(car, drive < 1 ? 1 : 0, t); blob.position.set(cx, 0.06, cz); blob.visible = car.visible; }
      routeGeo.setDrawRange(0, Math.max(2, Math.round(1 + p * (totalPts - 1))));
      labels.forEach((s) => { s.visible = map > 0.25; });
      camera.position.set(lerp(cx + 6, 0, map), lerp(26, 105, map), lerp(cz + 20, 8, map));
      camera.lookAt(lerp(cx, 0, map), 0, lerp(cz - 8, 0, map));
    },
  };
};
