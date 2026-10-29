// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Shared car-v2.glb loader: one GLTF cached per page, each block clones + normalizes to 4.4 m
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

let cached: Promise<THREE.Group> | null = null;
export function loadCarTemplate(): Promise<THREE.Group> {
  if (!cached) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    cached = loader.loadAsync("/models/car-v2.glb").then((g) => g.scene).catch((e) => { cached = null; throw e; });
  }
  return cached;
}
/** Clone the shared template and normalize: length (longest horizontal axis) = 4.4 m, wheels on y=0, centred. */
export function cloneCar(template: THREE.Group): THREE.Group {
  const car = template.clone(true);
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const len = Math.max(size.x, size.z) || 1;
  const s = 4.4 / len;
  car.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(car);
  const c = b2.getCenter(new THREE.Vector3());
  car.position.set(-c.x, -b2.min.y, -c.z);
  const wrap = new THREE.Group();
  wrap.add(car);
  wrap.userData.lengthAxis = size.x >= size.z ? "x" : "z";
  // headlight glow sprites (night scenes toggle visibility via userData)
  const glowMat = new THREE.SpriteMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.85, depthWrite: false });
  const glows: THREE.Sprite[] = [];
  const axisX = wrap.userData.lengthAxis === "x";
  const front = axisX ? 2.2 : 1.0;
  for (const off of [-0.62, 0.62]) {
    const sp = new THREE.Sprite(glowMat.clone());
    sp.scale.setScalar(0.55);
    if (axisX) sp.position.set(front, 0.62, off); else sp.position.set(off, 0.62, front);
    sp.name = "headlight-glow";
    wrap.add(sp); glows.push(sp);
  }
  wrap.userData.glows = glows;
  return wrap;
}
export function setHeadlights(car: THREE.Group, on: boolean) {
  (car.userData.glows as THREE.Sprite[] | undefined)?.forEach((g) => { g.visible = on; });
  car.rotation.z = 0; // reset vibration tilt when toggled
}
/** Soft body vibration instead of wheel spin (wheels are part of one mesh). */
export function vibrate(car: THREE.Group, moving: number, t: number) {
  if (moving <= 0.01) { car.position.y *= 0.8; car.rotation.z *= 0.8; return; }
  car.position.y = Math.sin(t * 31) * 0.0015 * moving;
  car.rotation.z = Math.sin(t * 23) * 0.0012 * moving;
}
