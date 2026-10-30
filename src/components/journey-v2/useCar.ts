// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Shared car-v2.glb loader: one GLTF cached per page, each block clones + normalizes to 4.4 m
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (smaller, softer headlight glow sprites)
"use client";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/** A/B test: ?model=kia swaps the hero model (Kia Sportage, CC-BY 4.0 karaman.arman / Sketchfab). */
export function isKiaModel(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("model") === "kia";
}
export function heroModelUrl(): string {
  if (typeof window === "undefined") return "/models/car-v2.glb";
  return new URLSearchParams(window.location.search).get("model") === "kia" ? "/models/kia-sportage.glb" : "/models/car-v2.glb";
}
let cached: Promise<THREE.Group> | null = null;
export function loadCarTemplate(): Promise<THREE.Group> {
  if (!cached) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    cached = loader.loadAsync(heroModelUrl()).then((g) => g.scene).catch((e) => { cached = null; throw e; });
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
  // headlight glow sprites (night scenes toggle visibility via userData); radial gradient so front view is a glow, not a square
  const gc = document.createElement("canvas"); gc.width = gc.height = 64;
  const gg = gc.getContext("2d")!; const grad = gg.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,240,200,1)"); grad.addColorStop(0.35, "rgba(255,220,150,0.55)"); grad.addColorStop(1, "rgba(255,210,120,0)");
  gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(gc);
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xf2f5ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const glows: THREE.Sprite[] = [];
  const axisX = wrap.userData.lengthAxis === "x";
  const front = axisX ? 2.2 : 1.0;
  for (const off of [-0.62, 0.62]) {
    const sp = new THREE.Sprite(glowMat.clone());
    sp.scale.setScalar(0.24);
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
