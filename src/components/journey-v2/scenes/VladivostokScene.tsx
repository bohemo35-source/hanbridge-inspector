// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 4: Vladivostok dawn, rounded sopki hills, ship unloads the car onto the pier
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { setHeadlights, vibrate } from "../useCar";
import { M, box, face, lerp, seg } from "./helpers";

export const buildVladivostok: SceneBuilder = ({ scene, camera, car, setEnv }) => {
  setEnv("/journey-v2/env-vladivostok-dawn.jpg", 0x6b5a52);
  scene.fog = new THREE.Fog(0x2a2320, 40, 190);
  scene.add(new THREE.AmbientLight(0x6b5a4a, 1.3));
  const sun = new THREE.DirectionalLight(0xffc98a, 2); sun.position.set(-30, 18, -40); scene.add(sun);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 200), M(0x27384a, 0.3, 0.4));
  water.rotation.x = -Math.PI / 2; water.position.set(-60, -0.4, -30); scene.add(water);
  const pier = box(90, 1.2, 22, M(0x3c4148, 0.7), 25, 0.4, 0); scene.add(pier);
  // rounded forested sopki: flattened spheres, never peaks
  const hillMat = M(0x2c4632, 0.95);
  const hills: Array<[number, number, number, number]> = [[-70, -90, 55, 15], [-10, -110, 70, 19], [60, -105, 62, 16], [120, -85, 50, 13], [-120, -70, 48, 12]];
  for (const [x, z, r, h] of hills) { const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14), hillMat); hill.scale.y = h / r; hill.position.set(x, 0, z); scene.add(hill); }
  // cable-stayed bridge silhouette in the distance
  const bridgeMat = M(0x4a4238, 0.7);
  scene.add(box(120, 1, 3, bridgeMat, -20, 14, -95));
  scene.add(box(1.4, 30, 1.4, bridgeMat, -20, 22, -95));
  const cablePts: THREE.Vector3[] = [];
  for (let i = -5; i <= 5; i++) { cablePts.push(new THREE.Vector3(-20, 36, -95), new THREE.Vector3(-20 + i * 10, 14.6, -95)); }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts), new THREE.LineBasicMaterial({ color: 0x8a7a68 })));
  // ship at pier, ramp lowers, car drives off
  const ship = new THREE.Group();
  ship.add(box(15, 7, 46, M(0x3a5068, 0.45, 0.6), 0, 4.2, 0), box(13, 5, 36, M(0xcfd6dd, 0.5, 0.3), 0, 10.2, 1));
  const rampPivot = new THREE.Group(); rampPivot.position.set(-7.5, 4.4, 6);
  rampPivot.add(box(11, 0.35, 6.5, M(0x3a4552, 0.5, 0.6), -5.5, 0, 0));
  ship.add(rampPivot); ship.position.set(2, 0, -28); scene.add(ship);
  if (car) setHeadlights(car, true);
  return {
    triangles: 0,
    update: (p, t) => {
      rampPivot.rotation.z = lerp(-1.15, 0.28, seg(p, 0.05, 0.35));
      if (car) {
        const off = seg(p, 0.35, 0.85);
        face(car, -1, 0.25);
        car.position.set(lerp(2, 38, off), lerp(5.2, 1.05, seg(p, 0.35, 0.6)), lerp(-22, -2, off));
        if (off > 0.25) car.rotation.z = 0; // ramp tilt handled by y descent; keep body level on pier
        vibrate(car, off > 0 && off < 1 ? 1 : 0, t);
        setHeadlights(car, p < 0.9);
      }
      camera.position.set(lerp(-16, 20, p), lerp(3.6, 6.5, p), lerp(22, 26, p));
      camera.lookAt(lerp(2, 32, p), 2.4, lerp(-20, -4, p));
    },
  };
};
