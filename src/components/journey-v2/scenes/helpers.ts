// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tiny shared builders for journey-v2 scenes (boxes, lights, facing, text sprites)
// @created: 2026-10-29
"use client";
import * as THREE from "three";
export const M = (c: number, r = 0.85, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}
export function face(car: THREE.Group, dx: number, dz: number) { car.rotation.y = Math.atan2(-dz, dx); }
export function points(count: number, spread: [number, number, number], yBase: number, color: number, size = 0.35): THREE.Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * spread[0]; pos[i * 3 + 1] = yBase + Math.random() * spread[1]; pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, sizeAttenuation: true }));
}
export function textSprite(text: string, color = "#e8eef4"): THREE.Sprite {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d")!; g.font = "600 52px system-ui"; g.textAlign = "center"; g.fillStyle = color; g.fillText(text, 256, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(14, 3.5, 1);
  return s;
}
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
