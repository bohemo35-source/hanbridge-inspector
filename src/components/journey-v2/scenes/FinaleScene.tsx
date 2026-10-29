// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 6: golden-hour handover yard, car stops, headlights off, slow camera pull-back
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { setHeadlights, vibrate } from "../useCar";
import { M, box, face, lerp, seg } from "./helpers";

export const buildFinale: SceneBuilder = ({ scene, camera, car, setEnv }) => {
  setEnv("/journey-v2/env-golden-hour.jpg", 0x8a725c);
  scene.fog = new THREE.Fog(0x2e2118, 30, 130);
  scene.add(new THREE.AmbientLight(0x8a6a4a, 1.4));
  const sun = new THREE.DirectionalLight(0xffbe78, 2.2); sun.position.set(-18, 10, 14); scene.add(sun);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), M(0x5c564c, 0.9));
  yard.rotation.x = -Math.PI / 2; yard.receiveShadow = true; scene.add(yard);
  // client's garage: open bay, warm light inside (no people)
  const garage = new THREE.Group();
  const wall = M(0x6e5a48, 0.85);
  garage.add(box(10, 4.4, 0.4, wall, 0, 2.2, -5), box(0.4, 4.4, 10, wall, -5, 2.2, 0), box(0.4, 4.4, 10, wall, 5, 2.2, 0), box(10.8, 0.4, 10.8, M(0x3e332a, 0.9), 0, 4.6, 0));
  const inner = new THREE.PointLight(0xffc98a, 30, 18); inner.position.set(0, 2.6, -2); garage.add(inner);
  garage.position.set(0, 0, -16); scene.add(garage);
  scene.add(box(7, 0.06, 10, M(0x4c463e, 0.9), 0, 0.03, -8));
  // closing segment of the route line on the ground
  const linePts = [new THREE.Vector3(-30, 0.12, 28), new THREE.Vector3(-12, 0.12, 12), new THREE.Vector3(0, 0.12, 2)];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0xffc24b })));
  if (car) { face(car, 0.3, -1); setHeadlights(car, true); }
  return {
    triangles: 0,
    update: (p, t) => {
      const drive = seg(p, 0, 0.55);
      if (car) {
        car.position.set(lerp(-16, 0, drive), 0, lerp(22, -4, drive));
        vibrate(car, drive < 1 ? 1 : 0, t);
        setHeadlights(car, p < 0.62);
      }
      camera.position.set(lerp(7, 13, p), lerp(1.5, 4.5, p), lerp(8, 20, p));
      camera.lookAt(0, 0.8, -6);
    },
  };
};
