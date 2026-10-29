// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Shared 3D kit for journey-v2 blocks: ACES renderer, PMREM env, desktop bloom, eco mode, full dispose
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export interface SceneKit {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  car: THREE.Group | null;
  mobile: boolean;
  tex: (path: string, repeat?: [number, number]) => THREE.Texture;
  setEnv: (path: string, bgColor?: number) => void;
  envFromTexture: (tex: THREE.Texture) => void;
}
export interface SceneHandle { update: (p: number, t: number) => void; triangles: number }
export type SceneBuilder = (kit: SceneKit) => SceneHandle;

const MAX_CANVASES = 2;
let liveCanvases = 0;
export function acquireCanvas(): boolean { if (liveCanvases >= MAX_CANVASES) return false; liveCanvases++; return true; }
export function releaseCanvas() { liveCanvases = Math.max(0, liveCanvases - 1); }

export function countTriangles(scene: THREE.Scene): number {
  let n = 0;
  scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3; } });
  return Math.round(n);
}

export interface Mounted { dispose: () => void; setProgress: (p: number) => void; fps: () => number; triangles: number }
export function mountScene(host: HTMLElement, build: SceneBuilder, car: THREE.Group | null, envPath?: string): Mounted {
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(46, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 300);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texLoader = new THREE.TextureLoader();
  const disposables: Array<{ dispose: () => void }> = [];
  let envTex: THREE.Texture | null = null;

  const kit: SceneKit = {
    scene, camera, car, mobile,
    tex: (path, repeat) => {
      const t = texLoader.load(path);
      t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      disposables.push(t);
      return t;
    },
    envFromTexture: (tex) => { scene.environment = pmrem.fromEquirectangular(tex).texture; },
    setEnv: (path, bgColor) => {
      texLoader.load(path, (tex) => {
        if (disposed) return;
        tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
        envTex = tex;
        scene.environment = pmrem.fromEquirectangular(tex).texture;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: bgColor ?? 0x8a929c, fog: false }));
        sphere.name = "env-sphere";
        scene.add(sphere);
      });
    },
  };
  if (envPath) kit.setEnv(envPath);
  if (car) scene.add(car);

  const handle = build(kit);
  let composer: EffectComposer | null = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.55, 0.7, 0.82));
    composer.addPass(new OutputPass());
  }
  const triangles = countTriangles(scene);
  host.dataset.triangles = String(triangles);

  let disposed = false, raf = 0, progress = 0, frames = 0, fpsVal = 0, lastFpsT = performance.now();
  const clock = new THREE.Clock();
  const loop = () => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    handle.update(progress, clock.elapsedTime);
    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (now - lastFpsT >= 1000) { fpsVal = Math.round((frames * 1000) / (now - lastFpsT)); frames = 0; lastFpsT = now; host.dataset.fps = String(fpsVal); }
  };
  loop();
  const onResize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); composer?.setSize(host.clientWidth, host.clientHeight); };
  window.addEventListener("resize", onResize);
  return {
    setProgress: (p) => { progress = p; },
    fps: () => fpsVal,
    triangles,
    dispose: () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[]; (Array.isArray(mat) ? mat : [mat]).forEach((x) => x?.dispose()); } });
      disposables.forEach((d) => d.dispose());
      envTex?.dispose(); scene.environment?.dispose(); pmrem.dispose();
      composer?.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    },
  };
}
