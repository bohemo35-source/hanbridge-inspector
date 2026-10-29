// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 1: Seoul night bridge over a wide river, car crosses, camera rises
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { setHeadlights, vibrate } from "../useCar";
import { M, box, face, points, clamp01, lerp, seg } from "./helpers";

export const buildSeoul: SceneBuilder = ({ scene, camera, car, setEnv }) => {
  setEnv("/journey-v2/env-seoul-night.jpg", 0x39424e);
  scene.fog = new THREE.Fog(0x070b14, 30, 160);
  scene.add(new THREE.AmbientLight(0x33415c, 1.1));
  const moon = new THREE.DirectionalLight(0x9db8e8, 1.4); moon.position.set(-20, 30, -10); scene.add(moon);
  // river + bridge deck
  const river = new THREE.Mesh(new THREE.PlaneGeometry(300, 220), M(0x0a1626, 0.25, 0.4));
  river.rotation.x = -Math.PI / 2; river.position.y = -3; scene.add(river);
  const deck = box(10, 0.5, 190, M(0x27313e, 0.55), 0, 0, -20); scene.add(deck);
  const rail = M(0x2b3542, 0.5, 0.5);
  for (const x of [-5, 5]) scene.add(box(0.25, 1, 190, rail, x, 0.9, -20));
  for (let z = -110; z < 70; z += 9) for (const x of [-5, 5]) { const p = box(0.12, 0.9, 0.12, rail, x, 0.7, z); scene.add(p); }
  // towers + cables (lines)
  const cableMat = new THREE.LineBasicMaterial({ color: 0x6f87a8, transparent: true, opacity: 0.7 });
  for (const z of [-70, 10]) {
    scene.add(box(0.7, 26, 0.7, M(0x232c38, 0.6, 0.4), -5, 13, z), box(0.7, 26, 0.7, M(0x232c38, 0.6, 0.4), 5, 13, z), box(11, 0.7, 0.7, M(0x232c38, 0.6, 0.4), 0, 25, z));
    const pts: THREE.Vector3[] = [];
    for (let i = -6; i <= 6; i++) { pts.push(new THREE.Vector3(-5, 25, z), new THREE.Vector3(-5, 0.6, z + i * 6)); pts.push(new THREE.Vector3(5, 25, z), new THREE.Vector3(5, 0.6, z + i * 6)); }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  }
  // city lights both banks + traffic light streams
  const cityL = points(700, [60, 14, 170], 0, 0xffc37a, 0.5); cityL.position.set(-45, 0, -20); scene.add(cityL);
  const cityR = points(700, [60, 14, 170], 0, 0x9fc2ff, 0.5); cityR.position.set(45, 0, -20); scene.add(cityR);
  const traffic = points(260, [8, 0.6, 180], 0.8, 0xffe2a0, 0.45); scene.add(traffic);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let z = -105; z < 65; z += 15) for (const x of [-4.6, 4.6]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lampMat); s.position.set(x, 2.2, z); scene.add(s); scene.add(box(0.08, 2.2, 0.08, rail, x, 1.1, z)); }
  const carLight = new THREE.PointLight(0xffd9a0, 60, 22); scene.add(carLight);
  if (car) { setHeadlights(car, true); face(car, 0, -1); }
  return {
    triangles: 0,
    update: (p, t) => {
      const z = lerp(55, -85, p);
      if (car) { car.position.set(1.8, 0.28, z); vibrate(car, 1, t); }
      carLight.position.set(1.8, 3.2, z + 3);
      traffic.position.z = Math.sin(t * 0.15) * 2;
      const rise = seg(p, 0.55, 1);
      camera.position.set(lerp(4.4, 13, rise), lerp(1.35, 12, rise), z + lerp(7, 15, rise));
      camera.lookAt(1.4, lerp(0.8, 1.5, rise), z - lerp(6, 12, rise));
      camera.fov = 46; camera.updateProjectionMatrix();
    },
  };
};
export { clamp01 };
