// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Garage studio 3D scene (plain three.js): film-style inspection bay, Kia Sportage hero model in neutral titanium, 13 clickable panels split from the parts model, explode, scan sweep, camera fly-to
// @created: 2026-11-02
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { PanelId } from "@/lib/domain/panels";

export const SODIUM = 0xeea65a;
const SIGNAL = 0x8cc7cf;
const PAINT = 0x5f646b; // neutral titanium: one car shape for every inspection, only the data changes

/** explode direction per panel (car space: +X front, +Y up, left = -Z) */
const EXPLODE: Record<PanelId, [number, number, number]> = {
  front_bumper: [1.25, 0, 0], hood: [0.45, 1.05, 0],
  front_left_fender: [0.55, 0.12, -0.95], front_right_fender: [0.55, 0.12, 0.95],
  front_left_door: [0.1, 0.12, -1.2], front_right_door: [0.1, 0.12, 1.2],
  rear_left_door: [-0.12, 0.12, -1.2], rear_right_door: [-0.12, 0.12, 1.2],
  rear_left_fender: [-0.55, 0.12, -0.95], rear_right_fender: [-0.55, 0.12, 0.95],
  trunk: [-1.05, 0.4, 0], rear_bumper: [-1.35, 0, 0], roof: [0, 1.15, 0],
};

/** One neutral model per body type. Kia: real model + its parts cut; templates: one textured mesh, panels found by geometry. */
export interface BodyModel { hero: string; parts?: string; length: number; doors: 3 | 5; rotY?: number }
export const KIA_MODEL: BodyModel = { hero: "/models/kia-sportage.glb", parts: "/models/kia-sportage-parts.glb", length: 4.4, doors: 5 };

export interface StudioHandle {
  /** colour per panel (null = nothing to say) and how loud it is (1 = remark, ~0.3 = factory paint) */
  setStatus(colors: Partial<Record<PanelId, { color: string; weight: number } | null>>): void;
  setHover(p: PanelId | null): void;
  setSelected(p: PanelId | null): void;
  setExploded(on: boolean): void;
  resetView(): void;
  project(p: PanelId): { x: number; y: number; visible: boolean } | null;
  dispose(): void;
}

export interface StudioEvents {
  onHover(p: PanelId | null): void;
  onPick(p: PanelId | null): void;
  onReady(): void;
  onFrame(): void;
}

type Piece = { mesh: THREE.Mesh; panel: PanelId | null; dir: THREE.Vector3; center: THREE.Vector3; overlay?: THREE.Mesh };

/** meshopt-quantized attributes (normalized int16) would clamp to ±1 when transformed: copy to float first */
function floatGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = src.getAttribute("position");
  const P = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) P.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  // keep the model's smooth normals and UVs: recomputed normals on split triangles look faceted, and templates keep their texture
  for (const [name, size] of [["normal", 3], ["uv", 2]] as const) {
    const at = src.getAttribute(name); if (!at) continue;
    const A = new Float32Array(at.count * size);
    for (let i = 0; i < at.count; i++) { A[i * size] = at.getX(i); A[i * size + 1] = at.getY(i); if (size === 3) A[i * size + 2] = at.getZ(i); }
    g.setAttribute(name, new THREE.BufferAttribute(A, size));
  }
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
  return g;
}

/**
 * Generic panel classifier for template bodies. u = x/(L/2) (+1 front), v = height share (0 floor), w = z/(W/2) (-1 left), n = face normal.
 * Glass, pillars, wheels and the underbody stay non-panel pieces.
 */
export function classifyTriangle(u: number, v: number, w: number, n: THREE.Vector3, doors: 3 | 5): string {
  const side = w < 0 ? "left" : "right";
  if (v < 0.42 && Math.abs(w) > 0.5 && (Math.abs(u - 0.64) < 0.2 || Math.abs(u + 0.64) < 0.2) && Math.abs(n.z) > 0.35) return "wheel";
  if (v < 0.12) return "under";
  if (v > 0.86 && n.y > 0.5) return "p:roof";
  if (u > 0.3 && n.y > 0.4 && v > 0.45 && v < 0.82 && Math.abs(w) < 0.85) return "p:hood";
  if (u < -0.55 && v > 0.36 && v < 0.84 && (n.x < -0.35 || n.y > 0.4) && Math.abs(w) < 0.8) return "p:trunk";
  if (u > 0.72 && v < 0.55) return "p:front_bumper";
  if (u < -0.74 && v < 0.42) return "p:rear_bumper";
  if (v > 0.6) return "cabin";
  if (Math.abs(w) < 0.55 && Math.abs(n.z) < 0.5) return "under";
  if (u > 0.36) return `p:front_${side}_fender`;
  if (doors === 3) return u > -0.32 ? `p:front_${side}_door` : `p:rear_${side}_fender`;
  if (u > -0.06) return `p:front_${side}_door`;
  if (u > -0.46) return `p:rear_${side}_door`;
  return `p:rear_${side}_fender`;
}

/** Back faces dark and matte: exploded panels never read as hollow shells. */
function matteInside<T extends THREE.MeshPhysicalMaterial>(m: T): T {
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.02);")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nif (!gl_FrontFacing) roughnessFactor = 1.0;")
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nif (!gl_FrontFacing) material.clearcoat = 0.0;\n#endif");
  };
  m.customProgramCacheKey = () => "studio-matte-inside";
  return m;
}

function gradientTexture(stops: [number, string][], w = 4, h = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!; const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialTexture(inner: string, outer: string, size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!; const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glow = (hex: number, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

/** Inspection bay: cyclorama, glossy floor, turntable with a sodium ring, light stands, LED columns, tool cart, tyres. */
function buildBay(scene: THREE.Scene, mobile: boolean) {
  const g = new THREE.Group(); scene.add(g);
  const props: THREE.Object3D[] = []; // stands, cart, tyres: hidden while they stand between the camera and the car
  // cyclorama
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 12, 64, 1, true), new THREE.MeshBasicMaterial({ map: gradientTexture([[0, "#07080a"], [0.55, "#121619"], [0.82, "#0b0d10"], [1, "#060708"]]), side: THREE.BackSide, fog: false }));
  cyc.position.y = 5.2; g.add(cyc);
  // floor: dim reflection under a dark glossy plane whose alpha fades out from the centre
  let refl: Reflector | null = null;
  if (!mobile) {
    refl = new Reflector(new THREE.CircleGeometry(16, 64), { textureWidth: 1024, textureHeight: 1024, color: 0x111316, clipBias: 0.003 });
    refl.rotation.x = -Math.PI / 2; refl.position.y = -0.001; g.add(refl);
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.42, metalness: 0.3, transparent: !mobile, opacity: mobile ? 1 : 0.86 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // floor guide lines: inspection bay grid, very faint
  const lineMat = new THREE.LineBasicMaterial({ color: 0xefe9df, transparent: true, opacity: 0.06 });
  for (let i = -6; i <= 6; i++) {
    const a = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i * 1.2, 0.002, -9), new THREE.Vector3(i * 1.2, 0.002, 9)]);
    const b = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9, 0.002, i * 1.2), new THREE.Vector3(9, 0.002, i * 1.2)]);
    g.add(new THREE.Line(a, lineMat), new THREE.Line(b, lineMat));
  }
  // turntable
  const table = new THREE.Group(); g.add(table);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.3, 0.07, 96), new THREE.MeshPhysicalMaterial({ color: 0x0d0f12, metalness: 0.7, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  disc.position.y = 0.035; disc.receiveShadow = true; table.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.28, 0.012, 8, 160), glow(SODIUM, 1.7)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.072; table.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.004, 6, 160), glow(SIGNAL, 1.4)); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.072; table.add(ring2);
  for (let i = 0; i < 72; i++) { // degree ticks
    const a = (i / 72) * Math.PI * 2, long = i % 6 === 0;
    const tk = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.16 : 0.07, 0.004, 0.008), new THREE.MeshBasicMaterial({ color: 0xefe9df, transparent: true, opacity: long ? 0.35 : 0.15 }));
    tk.position.set(Math.cos(a) * 3.05, 0.074, Math.sin(a) * 3.05); tk.rotation.y = -a; table.add(tk);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,.9)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.073; table.add(shadow);

  // light stands with softboxes (also the real light sources below)
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b1e22, metalness: 0.8, roughness: 0.35 });
  const stand = (x: number, z: number, h: number) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = Math.atan2(-x, -z); // softbox face (+Z) towards the car
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), metal); leg.position.set(Math.cos(a) * 0.3, 0.35, Math.sin(a) * 0.3); leg.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); s.add(leg); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, h), metal); pole.position.y = h / 2; s.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.22), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 })); box.position.set(0, h, 0); s.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.88), glow(0xf3efe6, 0.95)); face.position.set(0, h, 0.115); s.add(face);
    g.add(s); props.push(s); return s;
  };
  stand(-6.2, -1.2, 2.3); stand(5.9, -3.4, 2.1); stand(-3.8, -5.6, 2.6);
  // LED columns on the cyclorama: visible in the floor and the paint
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.2 + (i / 8) * 0.6) + Math.PI;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.4, 0.06), glow(i % 4 === 0 ? SODIUM : 0xdfe6ee, i % 4 === 0 ? 2.4 : 1.3));
    col.position.set(Math.cos(a) * 13.4, 1.9, Math.sin(a) * 13.4); g.add(col);
  }
  // tool cart with the paint gauge on top
  const cart = new THREE.Group(); cart.position.set(4.6, 0, -2.6); cart.rotation.y = -0.6; g.add(cart); props.push(cart);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.5), new THREE.MeshStandardMaterial({ color: 0x24282d, metalness: 0.5, roughness: 0.45 })); body.position.y = 0.55; cart.add(body);
  for (let d = 0; d < 3; d++) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.3 })); h.position.set(0, 0.32 + d * 0.25, 0.26); cart.add(h); }
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6 })); gauge.position.set(-0.2, 1.0, 0); cart.add(gauge);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), glow(SODIUM, 1.8)); screen.rotation.x = -Math.PI / 2; screen.position.set(-0.2, 1.027, -0.04); cart.add(screen);
  for (let w = 0; w < 4; w++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), metal); wh.rotation.x = Math.PI / 2; wh.position.set(w < 2 ? -0.42 : 0.42, 0.05, w % 2 ? 0.2 : -0.2); cart.add(wh); }
  // tyre stack
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92 });
  const tyres = new THREE.Group(); tyres.position.set(-5.4, 0, -2.0); g.add(tyres); props.push(tyres);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 12, 32), rubber); t.rotation.x = Math.PI / 2; t.position.set(0, 0.12 + i * 0.25, 0); t.castShadow = true; tyres.add(t); }
  return { group: g, table, props, reflector: refl };
}

export function createStudio(host: HTMLElement, ev: StudioEvents, opts: { mobile: boolean; zoom: boolean; model?: BodyModel }): StudioHandle {
  const model = opts.model ?? KIA_MODEL;
  const { mobile } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060708);
  scene.fog = new THREE.Fog(0x060708, 12, 26);
  const camera = new THREE.PerspectiveCamera(mobile ? 46 : 34, host.clientWidth / host.clientHeight, 0.1, 80);
  // portrait screens: the car must still fit across the width, so the camera backs off
  const distK = () => Math.min(1.55, Math.max(1, 0.8 / camera.aspect));
  const HOME = new THREE.Vector3(7.6, 2.1, 5.6);
  camera.position.copy(HOME).multiplyScalar(distK());
  (scene.fog as THREE.Fog).near = 12 * distK(); (scene.fog as THREE.Fog).far = 26 * distK();

  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader().setDataType(THREE.FloatType).load(mobile ? "/hdri/autoshop_01_1k.hdr" : "/hdri/autoshop_01_2k.hdr", (hdr) => {
    if (disposed) { hdr.dispose(); return; }
    const px = (hdr.image as unknown as { data?: Float32Array }).data;
    if (px) for (let i = 0; i < px.length; i++) if (px[i] > 12) px[i] = 12;
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose();
  });
  scene.environmentIntensity = 0.42;

  RectAreaLightUniformsLib.init();
  const soft = new THREE.RectAreaLight(0xf1f4f8, 3.2, 6, 2.2); soft.position.set(0, 4.6, 0); soft.lookAt(0, 0, 0);
  const sideL = new THREE.RectAreaLight(0xf3efe6, 4.5, 1.4, 1.0); sideL.position.set(-6.2, 2.3, -1.2); sideL.lookAt(0, 0.8, 0);
  const sideR = new THREE.RectAreaLight(0xf3efe6, 3.6, 1.4, 1.0); sideR.position.set(5.9, 2.1, -3.4); sideR.lookAt(0, 0.8, 0);
  const back = new THREE.RectAreaLight(0xf3efe6, 3.0, 1.4, 1.0); back.position.set(-3.8, 2.6, -5.6);
  // front fill from above the camera: long highlight along the doors
  const front = new THREE.RectAreaLight(0xf1f4f8, 2.2, 5, 0.6); front.position.set(4.5, 3.4, 5.5); front.lookAt(0, 0.7, 0); back.lookAt(0, 0.8, 0);
  // short reach + aimed high: past the car the beam fades out instead of painting a hot spot on the glossy floor in front of the camera
  const warm = new THREE.SpotLight(SODIUM, 60, 10.5, 0.3, 0.9, 2); warm.position.set(-7, 2.4, -6); warm.target.position.set(0, 1.25, 0);
  const cool = new THREE.SpotLight(SIGNAL, 60, 10.5, 0.3, 0.9, 2); cool.position.set(7.5, 2.2, -5.5); cool.target.position.set(0, 1.25, 0);
  const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(3, 9, 4); key.castShadow = true; key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, far: 25 });
  scene.add(soft, sideL, sideR, back, front, warm, warm.target, cool, cool.target, key, new THREE.HemisphereLight(0x8fa3b8, 0x0b0907, 0.35));

  const bay = buildBay(scene, mobile);
  const car = new THREE.Group(); car.position.y = 0.072; bay.table.add(car);

  // scan sweep: a thin vertical light curtain that passes along the car once the model is in
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(SODIUM).multiplyScalar(4), toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const scanWide = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.4), new THREE.MeshBasicMaterial({ map: gradientTexture([[0, "rgba(238,166,90,0)"], [0.5, "rgba(238,166,90,.35)"], [1, "rgba(238,166,90,0)"]], 256, 4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scanWide.material.map!.rotation = Math.PI / 2;
  const scanG = new THREE.Group(); scanG.add(scan, scanWide); scanG.rotation.y = Math.PI / 2; scanG.position.y = 1.15; car.add(scanG);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.75, 0); controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 4.2; controls.maxDistance = 12.5 * distK(); controls.maxPolarAngle = Math.PI * 0.48; controls.minPolarAngle = Math.PI * 0.12;
  controls.enablePan = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.45;
  // embedded in a scrolling page: the wheel and vertical swipes scroll the page, horizontal drags turn the car
  controls.enableZoom = opts.zoom;
  renderer.domElement.style.touchAction = opts.zoom ? "none" : "pan-y";
  controls.update();

  let composer: EffectComposer | null = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.32, 0.45, 0.95));
    composer.addPass(new OutputPass());
  }

  // ── car ──
  const pieces: Piece[] = [];
  const byPanel = new Map<PanelId, Piece>();
  const overlayMats = new Map<PanelId, THREE.MeshBasicMaterial>();
  const paintMats = new Map<PanelId, THREE.MeshStandardMaterial>();
  let heroMat: THREE.MeshStandardMaterial | null = null; // templates: exploded pieces keep the model's own texture
  let hero: THREE.Object3D | null = null;
  let disposed = false;
  let ready = false;
  const status = new Map<PanelId, { c: THREE.Color; w: number } | null>();
  let hover: PanelId | null = null, selected: PanelId | null = null;
  let explodeTarget = 0, explode = 0;
  let scanT = -1; // -1 idle, 0..1 sweeping

  /** Template GLBs come in unknown orientation: length goes to X, and the front is the end farther from the roof (bonnets are longer than boots). */
  const autoOrient = (m: THREE.Object3D) => {
    m.updateMatrixWorld(true);
    let sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    if (sz.z > sz.x) { m.rotation.y += Math.PI / 2; m.updateMatrixWorld(true); sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()); }
    const box = new THREE.Box3().setFromObject(m), v = new THREE.Vector3(); let sx = 0, n = 0;
    m.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; const pos = mesh.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i += 5) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); if (v.y > box.min.y + sz.y * 0.88) { sx += v.x; n++; } }
    });
    if (n && sx / n > (box.min.x + box.max.x) / 2) { m.rotation.y += Math.PI; m.updateMatrixWorld(true); }
  };
  const norm = (m: THREE.Object3D) => {
    if (model.rotY) { m.rotation.y = model.rotY; m.updateMatrixWorld(true); }
    else if (!model.parts) autoOrient(m);
    const b = new THREE.Box3().setFromObject(m); const sz = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3());
    const sc = model.length / sz.x; m.scale.multiplyScalar(sc); m.position.set(-c.x * sc, -b.min.y * sc, -c.z * sc);
    m.updateMatrixWorld(true);
  };
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(model.hero, (gl) => {
    if (disposed) return;
    hero = gl.scene; norm(hero);
    if (!model.parts) { buildPiecesFromHero(hero); car.add(hero); ready = true; scanT = 0; ev.onReady(); }
    else car.add(hero);
    hero.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = true;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => {
        const s = mt as THREE.MeshPhysicalMaterial;
        if ("envMapIntensity" in s) s.envMapIntensity = 0.9;
        if (/Wolf_Gray/i.test(mt.name)) { s.color.set(PAINT); s.metalness = 0.55; s.roughness = 0.3; if ("clearcoat" in s) { s.clearcoat = 1; s.clearcoatRoughness = 0.05; } s.envMapIntensity = 1.1; }
        if (/DRLs|HeadLightsGlass/i.test(mt.name) && "emissive" in s) { s.emissive = new THREE.Color(0xf4f6ff); s.emissiveIntensity = /DRLs/i.test(mt.name) ? 3.2 : 0.25; }
        if (/BrakeLights|RedMain/i.test(mt.name) && "emissive" in s) { s.emissive = new THREE.Color(0xff2a1f); s.emissiveIntensity = 0.35; }
        if (/Windows/i.test(mt.name)) { s.color.set(0x07090b); s.roughness = 0.05; s.metalness = 0.2; s.envMapIntensity = 1.4; }
      });
    });
    if (model.parts) loader.load(model.parts, (pg) => {
      if (disposed) return;
      const root = pg.scene; norm(root); root.updateMatrixWorld(true);
      buildPieces(root);
      ready = true; scanT = 0; ev.onReady();
    });
  });

  const paintBase = new THREE.MeshPhysicalMaterial({ color: PAINT, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 });
  const darkMat = matteInside(new THREE.MeshPhysicalMaterial({ color: 0x0a0b0d, metalness: 0.3, roughness: 0.55 }));
  const glassMat = matteInside(new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0.3, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.4 }));

  /** Template models: bake the textured mesh into car space and sort every triangle into a panel by where it sits and where it faces. */
  function buildPiecesFromHero(root: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(root); const L = box.max.x - box.min.x, H = box.max.y - box.min.y, W = box.max.z - box.min.z;
    const buckets = new Map<string, number[][]>(); // key -> [positions[], normals[], uvs[]]
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
    root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      heroMat ??= (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      const geo = floatGeometry(m.geometry).applyMatrix4(m.matrixWorld).toNonIndexed();
      const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal"), uv = geo.getAttribute("uv");
      for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        nn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
        const k = classifyTriangle((a.x + b.x + c.x) / 3 / (L / 2), ((a.y + b.y + c.y) / 3 - box.min.y) / H, (a.z + b.z + c.z) / 3 / (W / 2), nn, model.doors);
        let bk = buckets.get(k); if (!bk) buckets.set(k, (bk = [[], [], []]));
        bk[0].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        for (let j = 0; j < 3; j++) {
          if (nor) bk[1].push(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
          if (uv) bk[2].push(uv.getX(i + j), uv.getY(i + j));
        }
      }
      geo.dispose();
    });
    for (const [k, [P, N, UV]] of buckets) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      if (N.length === P.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); else g.computeVertexNormals();
      if (UV.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
      addPiece(k, g);
    }
  }

  /** Bake every part into car space and split shared parts into their panels by triangle position. */
  function buildPieces(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) meshes.push(m); });
    for (const m of meshes) {
      const n = Number((m.name || m.parent?.name || "").replace("tripo_part_", ""));
      const geo = floatGeometry(m.geometry).applyMatrix4(m.matrixWorld).toNonIndexed(); if (!geo.getAttribute("normal")) geo.computeVertexNormals();
      for (const [key, g] of splitPart(n, geo)) addPiece(key, g);
    }
  }

  function addPiece(key: string, g: THREE.BufferGeometry) {
      {
        const panel = (key.startsWith("p:") ? key.slice(2) : null) as PanelId | null;
        g.computeBoundingBox(); const center = g.boundingBox!.getCenter(new THREE.Vector3());
        let mat: THREE.Material;
        if (panel && heroMat) { const pm = heroMat.clone(); pm.side = THREE.DoubleSide; paintMats.set(panel, pm); mat = pm; }
        else if (panel) { const pm = matteInside(paintBase.clone()); paintMats.set(panel, pm); mat = pm; }
        else mat = heroMat ?? (key === "cabin" ? glassMat : darkMat);
        const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.visible = false; car.add(mesh);
        // templates: only the 13 body panels peel off, the dark core (glass, wheels, underbody) stays put — one mesh, no real parts to scatter
        const dir = panel ? new THREE.Vector3(...EXPLODE[panel]) : !model.parts ? new THREE.Vector3() : new THREE.Vector3(center.x * 0.25, key === "cabin" ? 0.55 : 0.05, Math.sign(center.z) * (Math.abs(center.z) > 0.6 ? 0.55 : 0));
        const piece: Piece = { mesh, panel, dir, center };
        pieces.push(piece);
        if (panel) {
          byPanel.set(panel, piece);
          // overlay on the assembled hero: same triangles, status colour, invisible until there is something to say
          const om = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, blending: THREE.AdditiveBlending });
          overlayMats.set(panel, om);
          const ov = new THREE.Mesh(g, om); ov.userData.panel = panel; ov.renderOrder = 2; car.add(ov);
          piece.overlay = ov;
        }
      }
  }

  /** Which panel a triangle belongs to, for parts that carry several (front fenders, rear quarters + tailgate, cabin + roof). */
  function splitPart(n: number, geo: THREE.BufferGeometry): Map<string, THREE.BufferGeometry> {
    const single: Record<number, string> = { 16: "p:front_bumper", 9: "p:hood", 12: "p:front_left_door", 11: "p:front_right_door", 7: "p:rear_left_door", 17: "p:rear_right_door", 13: "p:rear_bumper" };
    if (single[n]) return new Map([[single[n], geo]]);
    if (n !== 15 && n !== 3 && n !== 0) return new Map([[`x:${n}`, geo]]);
    const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal");
    geo.computeBoundingBox(); const bb = geo.boundingBox!;
    const maxZ = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
    const buckets = new Map<string, number[]>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      nn.fromBufferAttribute(nor, i);
      let k: string;
      if (n === 15) k = cz < 0 ? "p:front_left_fender" : "p:front_right_fender";
      else if (n === 3) k = Math.abs(cz) < maxZ * 0.6 || nn.x < -0.55 ? "p:trunk" : cz < 0 ? "p:rear_left_fender" : "p:rear_right_fender";
      else k = cy > bb.max.y - 0.16 && nn.y > 0.55 ? "p:roof" : "cabin";
      let arr = buckets.get(k); if (!arr) buckets.set(k, (arr = []));
      for (let j = 0; j < 3; j++) { arr.push(i + j); }
    }
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [k, idx] of buckets) {
      const g = new THREE.BufferGeometry();
      const P = new Float32Array(idx.length * 3), N = new Float32Array(idx.length * 3);
      idx.forEach((v, j) => { P.set([pos.getX(v), pos.getY(v), pos.getZ(v)], j * 3); N.set([nor.getX(v), nor.getY(v), nor.getZ(v)], j * 3); });
      g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      out.set(k, g);
    }
    return out;
  }

  // ── picking ──
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let downAt: { x: number; y: number; t: number } | null = null;
  const pick = (e: PointerEvent): PanelId | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = explode > 0.02 ? pieces.filter((p) => p.mesh.visible).map((p) => p.mesh) : [...byPanel.values()].flatMap((p) => (p.overlay ? [p.overlay] : []));
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const pc = pieces.find((p) => p.mesh === hit.object || p.overlay === hit.object);
    return pc?.panel ?? null;
  };
  const onMove = (e: PointerEvent) => { if (!ready || e.pointerType === "touch") return; const p = pick(e); if (p !== hover) ev.onHover(p); renderer.domElement.style.cursor = p ? "pointer" : "grab"; };
  const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; controls.autoRotate = false; };
  const onUp = (e: PointerEvent) => {
    if (!downAt || !ready) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), dt = performance.now() - downAt.t; downAt = null;
    if (moved < 6 && dt < 500) ev.onPick(pick(e));
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  // ── camera fly-to ──
  let fly: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  const flyTo = (to: THREE.Vector3) => { fly = { from: camera.position.clone(), to, t: 0 }; controls.autoRotate = false; };
  const tableAngle = () => bay.table.rotation.y;

  // ── loop ──
  const tmp = new THREE.Vector3(); const col = new THREE.Color();
  let raf = 0, last = performance.now(), running = true;
  const io = new IntersectionObserver((es) => { running = es[0]?.isIntersecting ?? true; if (running && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: "200px" });
  io.observe(host);
  const loop = (now: number) => {
    raf = 0; if (disposed || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    explode += (explodeTarget - explode) * Math.min(1, dt * 3.2);
    const ek = explode < 0.001 ? 0 : explode;
    if (hero) hero.visible = ek < 0.02;
    for (const p of pieces) {
      p.mesh.visible = ek >= 0.02;
      tmp.copy(p.dir).multiplyScalar(ek * (p.panel ? 1 : 0.8));
      p.mesh.position.copy(tmp);
      if (p.overlay) p.overlay.position.copy(tmp);
    }
    // scan sweep: front → back, panels light up as it passes
    if (scanT >= 0) { scanT += dt / 2.6; if (scanT > 1.15) scanT = -1; }
    const scanX = 2.6 - 5.2 * Math.max(0, scanT);
    scanG.position.x = scanX;
    const sOp = scanT >= 0 ? Math.sin(Math.min(1, scanT) * Math.PI) : 0;
    (scan.material as THREE.MeshBasicMaterial).opacity = sOp; (scanWide.material as THREE.MeshBasicMaterial).opacity = sOp * 0.9;
    for (const [panel, om] of overlayMats) {
      const st = status.get(panel) ?? null; const c = st?.c ?? null, w = st?.w ?? 0;
      const pc = byPanel.get(panel)!;
      const passed = scanT < 0 || pc.center.x > scanX;
      const isSel = panel === selected, isHov = panel === hover;
      let target = 0;
      if (c && passed) target = (0.22 + 0.06 * Math.sin(now / 520 + pc.center.x)) * w;
      if (isHov) target = Math.max(target, 0.28);
      if (isSel) target = 0.42 + 0.06 * Math.sin(now / 300);
      if (ek >= 0.02) target = 0; // exploded: colour goes into the paint instead
      om.opacity += (target - om.opacity) * Math.min(1, dt * 8);
      om.color.copy(isSel || (isHov && !c) ? col.set(SODIUM) : c ?? col.set(0xefe9df));
      const pm = paintMats.get(panel);
      if (pm) { pm.emissive.copy(c ?? col.set(0x000000)); pm.emissiveIntensity = (isSel ? 0.55 : isHov ? 0.35 : c ? 0.22 * w : 0) * (ek >= 0.02 ? 1 : 0); if (isSel && !c) { pm.emissive.set(SODIUM); } }
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.1); const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - Math.pow(-2 * fly.t + 2, 3) / 2;
      camera.position.lerpVectors(fly.from, fly.to, k); if (fly.t >= 1) fly = null;
    }
    controls.update();
    const camAz = Math.atan2(camera.position.z, camera.position.x), camR = Math.hypot(camera.position.x, camera.position.z);
    for (const p of bay.props) {
      const az = Math.atan2(p.position.z, p.position.x); let d = Math.abs(az - camAz); if (d > Math.PI) d = 2 * Math.PI - d;
      p.visible = !(d < 0.42 && Math.hypot(p.position.x, p.position.z) < camR);
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
    ev.onFrame();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); composer?.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(host);

  return {
    setStatus(colors) { for (const [p, c] of Object.entries(colors)) status.set(p as PanelId, c ? { c: new THREE.Color(c.color), w: c.weight } : null); },
    setHover(p) { hover = p; },
    setSelected(p) {
      selected = p;
      if (!p) return;
      const pc = byPanel.get(p); if (!pc) return;
      // world direction of the panel (the table may have turned), camera goes out along it
      const c = pc.center.clone().add(pc.dir.clone().multiplyScalar(explode));
      c.applyAxisAngle(new THREE.Vector3(0, 1, 0), tableAngle());
      const dir = new THREE.Vector3(c.x, 0, c.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 1);
      dir.normalize();
      const dist = (explode > 0.5 ? 9.5 : 7.2) * distK();
      const up = p === "roof" || p === "hood" || p === "trunk" ? 4.6 : 2.0;
      flyTo(new THREE.Vector3(dir.x * dist, up, dir.z * dist));
    },
    setExploded(on) { explodeTarget = on ? 1 : 0; if (on) flyTo(camera.position.clone().setLength(10.5 * distK()).setY(Math.max(3.2, camera.position.y))); },
    resetView() { flyTo(HOME.clone().multiplyScalar(distK())); controls.autoRotate = true; },
    project(p) {
      const pc = byPanel.get(p); if (!pc) return null;
      const v = pc.center.clone().add(pc.dir.clone().multiplyScalar(explode)); v.y += 0.12;
      car.localToWorld(v); v.project(camera);
      return { x: (v.x * 0.5 + 0.5) * host.clientWidth, y: (-v.y * 0.5 + 0.5) * host.clientHeight, visible: v.z < 1 };
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove); renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      bay.reflector?.dispose(); // its render target
      const texs = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh | THREE.Line; if (!(m as THREE.Mesh).isMesh && !(m as THREE.Line).isLine) return;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
          if (!x) return;
          for (const v of Object.values(x)) if (v instanceof THREE.Texture) texs.add(v);
          x.dispose();
        });
      });
      texs.forEach((t) => t.dispose());
      scene.environment?.dispose(); pmrem.dispose(); composer?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
