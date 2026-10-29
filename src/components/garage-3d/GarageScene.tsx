// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Garage inspection scroll scene: real 32-part car on a lift, exploded view, gauge labels, verdict
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (TZ-13 look: autoshop HDRI reflections, rim + softbox light, metallic parts with dark matte insides, blurred floor reflection)
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import type { Report } from "@/lib/schema";
import { panelLabel } from "@/lib/domain/panels";
import {
  BEAT_CAPTIONS, REASSEMBLE_CAPTION, PART_MAP, allReadings, beatAt, entryOffset, explodeAmount, explodeOffset, findingsByPanel,
  heroWeight, liftAmount, obdInfo, panelLabelOffset, partExplodeT, partIndex, progressCenterOfBeat, readingsByPart, verdictCounts,
  type Beat,
} from "./parts";
import { leadStyle, useStageFade } from "@/components/journey-v2/useStageFade";

export interface GarageSceneProps {
  report?: Report;
  lang: "ru" | "en";
  paint?: string;
  compact?: boolean;
  debugParts?: boolean;
  /** Pin the scene to the middle of a beat (lab captures). */
  pinnedBeat?: Beat;
  /** Journey chain: overlap + crossfade with the previous block / darken into the next one. */
  lead?: boolean;
  exit?: number;
}

const CLASS_COLOR: Record<string, string> = { factory: "#34d399", repaint: "#fbbf24", putty: "#f87171" };
const CLASS_LABEL = {
  ru: { factory: "норма", repaint: "перекрас", putty: "шпатлёвка / ремонт" },
  en: { factory: "factory", repaint: "repaint", putty: "filler / repair" },
};

function hasWebGL2(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/**
 * Camera keyframes on a monotone azimuth orbit (never crosses the car):
 * [progress, azimuthDeg, radius, height, lookAtY]. 0deg = front (+x), 90deg = right side (+z).
 */
const CAM_KEYS: Array<[number, number, number, number, number]> = [
  [0.0, 32, 6.6, 0.85, 0.6],
  [0.15, 58, 6.1, 1.0, 0.75],
  [0.3, 96, 6.8, 0.45, 1.15],
  [0.55, 150, 9.0, 3.6, 1.15],
  [0.66, 182, 6.4, 7.2, 0.9],
  [0.75, 215, 9.0, 3.8, 1.15],
  [0.88, 262, 6.9, 1.9, 1.0],
  [1.0, 322, 6.3, 1.25, 0.75],
];

function cameraPose(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3, carX: number) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1][0]) i++;
  const [p0, aAz, aR, aH, aY] = CAM_KEYS[i];
  const [p1, bAz, bR, bH, bY] = CAM_KEYS[i + 1];
  const t = smooth((p - p0) / Math.max(1e-6, p1 - p0));
  const az = ((aAz + (bAz - aAz) * t) * Math.PI) / 180;
  const r = aR + (bR - aR) * t;
  outPos.set(Math.cos(az) * r, aH + (bH - aH) * t, Math.sin(az) * r);
  outTgt.set(0, aY + (bY - aY) * t, 0);
  if (p < 0.15) outTgt.x += carX * 0.55; // follow the car while it drives in
}

function canvasTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 128, h = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Reflector with a 9-tap blur and a strength knob: a glossy epoxy floor, not a mirror. */
const BLUR_REFLECTOR_SHADER = {
  name: "BlurReflectorShader",
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uBlur: { value: 0.006 }, uStrength: { value: 0.45 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() { vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uBlur; uniform float uStrength; varying vec4 vUv;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w; vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) { float w = (x == 0 && y == 0) ? 2.0 : 1.0; acc += texture2D(tDiffuse, uv + vec2(float(x), float(y) * 1.6) * uBlur).rgb * w; wsum += w; }
      gl_FragColor = vec4(color + acc / wsum * uStrength, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/** Physical material whose back faces render dark and matte: exploded panels never read as empty shells. */
function withMatteInside<T extends THREE.MeshPhysicalMaterial>(m: T): T {
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.025, 0.027, 0.03);")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nif (!gl_FrontFacing) roughnessFactor = 1.0;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nif (!gl_FrontFacing) metalnessFactor = 0.0;")
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nif (!gl_FrontFacing) material.clearcoat = 0.0;\n#endif\n#ifdef USE_SHEEN\nif (!gl_FrontFacing) material.sheenColor = vec3(0.0);\n#endif");
  };
  m.customProgramCacheKey = () => "matte-inside";
  return m;
}

function buildEnvironment(mobile: boolean): { group: THREE.Group; liftArms: THREE.Group; reflector: Reflector | null; cones: THREE.Object3D[]; leds: THREE.Object3D[]; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const mat = (m: THREE.Material) => { disposables.push(m); return m; };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { disposables.push(g); return g; };
  const texLoader = new THREE.TextureLoader();

  // Floor: Muse Image epoxy texture over a weakened Reflector (desktop), plain textured plane on mobile.
  let reflector: Reflector | null = null;
  if (!mobile) {
    reflector = new Reflector(geo(new THREE.PlaneGeometry(46, 30)), {
      clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x07080a, shader: BLUR_REFLECTOR_SHADER,
    });
    reflector.rotation.x = -Math.PI / 2; reflector.position.y = -0.02; group.add(reflector);
  }
  const floorTex = texLoader.load("/garage/floor-epoxy.jpg");
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 4); floorTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(floorTex);
  const floor = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(46, 30)),
    mat(new THREE.MeshStandardMaterial({ map: floorTex, color: 0x80858c, roughness: 0.6, metalness: 0.05, transparent: !mobile, opacity: mobile ? 1 : 0.82, envMapIntensity: 0.25 })),
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);

  // Yellow lift-zone marking + drain grate (geometry over the floor texture).
  const markMat = mat(new THREE.MeshStandardMaterial({ color: 0xd8a812, roughness: 0.7 }));
  const mark = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(geo(new THREE.BoxGeometry(w, 0.012, d)), markMat); m.position.set(x, 0.008, z); group.add(m); };
  mark(5.4, 0.09, 0, -1.55); mark(5.4, 0.09, 0, 1.55); mark(0.09, 3.2, -2.7, 0); mark(0.09, 3.2, 2.7, 0);
  const drain = new THREE.Mesh(geo(new THREE.BoxGeometry(3.6, 0.014, 0.42)), mat(new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.9, metalness: 0.4 })));
  drain.position.set(0, 0.009, 2.35); group.add(drain);
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, 0.016, 0.36)), mat(new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.6, roughness: 0.5 }))); s.position.set(-1.6 + i * 0.4, 0.01, 2.35); group.add(s); }

  // Contact shadow under the car (radial gradient).
  const contactTex = canvasTexture((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2); r.addColorStop(0, "rgba(0,0,0,0.85)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 256, 256);
  disposables.push(contactTex);
  const contact = new THREE.Mesh(geo(new THREE.PlaneGeometry(5.6, 3.0)), mat(new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.75 })));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.015; group.add(contact);

  // Walls with Muse Image panel texture.
  const wallTex = texLoader.load("/garage/wall-panel.jpg");
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(8, 2); wallTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(wallTex);
  const wallMat = mat(new THREE.MeshStandardMaterial({ map: wallTex, color: 0x777d85, roughness: 0.85, metalness: 0.3 }));
  const backWall = new THREE.Mesh(geo(new THREE.BoxGeometry(46, 7, 0.3)), wallMat); backWall.position.set(0, 3.5, -7.5);
  const leftWall = new THREE.Mesh(geo(new THREE.BoxGeometry(0.3, 7, 30)), wallMat); leftWall.position.set(-13, 3.5, 0);
  const rightWall = new THREE.Mesh(geo(new THREE.BoxGeometry(0.3, 7, 30)), wallMat); rightWall.position.set(13, 3.5, 0);
  group.add(backWall, leftWall, rightWall);
  // Glowing strip + textless icon signs on the back wall.
  const strip = new THREE.Mesh(geo(new THREE.BoxGeometry(20, 0.07, 0.05)), mat(new THREE.MeshBasicMaterial({ color: 0x7dd3fc })));
  strip.position.set(0, 3.15, -7.32); group.add(strip);
  const signDraws: Array<(g: CanvasRenderingContext2D) => void> = [
    (g) => { g.fillStyle = "#0ea5e9"; g.beginPath(); g.moveTo(18, 32); g.lineTo(46, 32); g.lineTo(46, 22); g.lineTo(64, 40); g.lineTo(46, 58); g.lineTo(46, 48); g.lineTo(18, 48); g.fill(); },
    (g) => { g.strokeStyle = "#34d399"; g.lineWidth = 9; g.beginPath(); g.moveTo(18, 42); g.lineTo(34, 56); g.lineTo(62, 24); g.stroke(); },
    (g) => { g.strokeStyle = "#fbbf24"; g.lineWidth = 8; g.beginPath(); g.arc(34, 34, 16, 0.6, 5.2); g.stroke(); g.beginPath(); g.moveTo(46, 46); g.lineTo(62, 62); g.stroke(); },
  ];
  signDraws.forEach((draw, i) => {
    const t = canvasTexture((g, w, h) => { g.fillStyle = "#0b1220"; g.fillRect(0, 0, w, h); g.save(); g.scale(w / 80, h / 80); draw(g); g.restore(); }, 96, 96);
    disposables.push(t);
    const sign = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.55, 0.55)), mat(new THREE.MeshBasicMaterial({ map: t })));
    sign.position.set(-3.2 + i * 3.2, 2.55, -7.33); group.add(sign);
  });

  // Detailed cabinets (drawers + handles), tyre stack, workbench, compressor, OBD stand along the back wall.
  const cabMat = mat(new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.65, metalness: 0.45 }));
  const darkMat = mat(new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9, metalness: 0.2 }));
  const handleMat = mat(new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.8 }));
  for (let i = 0; i < 5; i++) {
    const x = -7.2 + i * 1.85;
    const cab = new THREE.Mesh(geo(new THREE.BoxGeometry(1.7, 2.1, 0.55)), cabMat); cab.position.set(x, 1.05, -7.05); cab.castShadow = true; group.add(cab);
    for (let d = 0; d < 3; d++) {
      const front = new THREE.Mesh(geo(new THREE.BoxGeometry(1.5, 0.5, 0.03)), darkMat); front.position.set(x, 0.45 + d * 0.6, -6.76); group.add(front);
      const handle = new THREE.Mesh(geo(new THREE.BoxGeometry(0.6, 0.035, 0.03)), handleMat); handle.position.set(x, 0.62 + d * 0.6, -6.74); group.add(handle);
    }
  }
  for (let i = 0; i < 4; i++) { const tyre = new THREE.Mesh(geo(new THREE.TorusGeometry(0.34, 0.13, 10, 24)), darkMat); tyre.rotation.x = Math.PI / 2; tyre.position.set(3.4, 0.14 + i * 0.26, -6.9); group.add(tyre); }
  const bench = new THREE.Mesh(geo(new THREE.BoxGeometry(2.4, 0.08, 0.7)), cabMat); bench.position.set(5.6, 0.95, -7.0); group.add(bench);
  for (const dx of [-1.05, 1.05]) { const legB = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.95, 0.6)), darkMat); legB.position.set(5.6 + dx, 0.48, -7.0); group.add(legB); }
  const tank = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 18)), mat(new THREE.MeshStandardMaterial({ color: 0x7a2e22, roughness: 0.55, metalness: 0.5 })));
  tank.rotation.z = Math.PI / 2; tank.position.set(7.6, 0.36, -7.0); group.add(tank);
  // OBD stand: pole + glowing graph screen (no digits/text).
  const obdScreenTex = canvasTexture((g, w, h) => { g.fillStyle = "#03130c"; g.fillRect(0, 0, w, h); g.strokeStyle = "#34d399"; g.lineWidth = 3; g.beginPath(); for (let x = 0; x < w; x += 6) { const y = h * 0.55 - Math.sin(x * 0.09) * 14 - (x > w * 0.6 ? 10 : 0); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.strokeStyle = "rgba(52,211,153,0.35)"; for (let y = 16; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }, 160, 100);
  disposables.push(obdScreenTex);
  const pole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.035, 0.05, 1.25, 10)), handleMat); pole.position.set(2.6, 0.62, -6.55); group.add(pole);
  const screen = new THREE.Mesh(geo(new THREE.BoxGeometry(0.62, 0.42, 0.04)), darkMat); screen.position.set(2.6, 1.4, -6.55); screen.rotation.x = -0.18; group.add(screen);
  const screenFace = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.56, 0.36)), mat(new THREE.MeshBasicMaterial({ map: obdScreenTex }))); screenFace.position.set(2.6, 1.41, -6.52); screenFace.rotation.x = -0.18; group.add(screenFace);

  // Ceiling: beam grid + 6 linear fixtures with housings (emissive strip inside a dark case).
  const cones: THREE.Object3D[] = []; const leds: THREE.Object3D[] = [];
  const beamMat = mat(new THREE.MeshStandardMaterial({ color: 0x191d23, roughness: 0.85, metalness: 0.4 }));
  for (const z of [-3.4, -1.15, 1.15, 3.4]) { const beam = new THREE.Mesh(geo(new THREE.BoxGeometry(14, 0.16, 0.14)), beamMat); beam.position.set(0, 4.55, z); group.add(beam); }
  for (const x of [-5, 0, 5]) { const beam = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 0.16, 8.5)), beamMat); beam.position.set(x, 4.55, 0); group.add(beam); }
  const ledMat = mat(new THREE.MeshBasicMaterial({ color: 0xdce8fa }));
  for (const z of [-2.6, 0, 2.6]) for (const x of [-3.4, 3.4]) {
    const fixture = new THREE.Group();
    const housing = new THREE.Mesh(geo(new THREE.BoxGeometry(3.4, 0.09, 0.34)), beamMat); fixture.add(housing);
    const stripLed = new THREE.Mesh(geo(new THREE.BoxGeometry(3.2, 0.03, 0.2)), ledMat); stripLed.position.y = -0.055; fixture.add(stripLed);
    fixture.position.set(x, 4.42, z); leds.push(fixture); group.add(fixture);
    if (x === 3.4) {
      const cone = new THREE.Mesh(geo(new THREE.ConeGeometry(1.7, 4.4, 24, 1, true)), mat(new THREE.MeshBasicMaterial({ color: 0x9db8dd, transparent: true, opacity: 0.0035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      cone.position.set(0, 2.2, z); cones.push(cone); group.add(cone);
    }
  }

  // Scissor lift: bevel-ish stacked platforms, hydraulic cylinder, yellow ends, rubber pads.
  const lift = new THREE.Group();
  const postMat = mat(new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.3 }));
  const yellowMat = mat(new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5, metalness: 0.3 }));
  const rubberMat = mat(new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 1 }));
  const basePlate = new THREE.Mesh(geo(new THREE.BoxGeometry(4.6, 0.06, 2.3)), postMat); basePlate.position.set(0, 0.03, 0); basePlate.receiveShadow = true; lift.add(basePlate);
  const liftArms = new THREE.Group();
  for (const side of [-1, 1]) {
    const runway = new THREE.Mesh(geo(new THREE.BoxGeometry(4.3, 0.1, 0.55)), postMat); runway.position.set(0, 0, side * 0.78); runway.castShadow = true;
    const edge = new THREE.Mesh(geo(new THREE.BoxGeometry(0.18, 0.11, 0.57)), yellowMat); edge.position.set(2.1, 0, side * 0.78);
    const edge2 = edge.clone(); edge2.position.x = -2.1;
    const pad = new THREE.Mesh(geo(new THREE.BoxGeometry(3.9, 0.02, 0.42)), rubberMat); pad.position.set(0, 0.06, side * 0.78);
    liftArms.add(runway, edge, edge2, pad);
  }
  const cyl = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 10)), handleMat); cyl.rotation.x = Math.PI / 2; cyl.position.set(0.9, -0.02, 0.78); liftArms.add(cyl);
  lift.add(liftArms);
  const legs = new THREE.Group();
  for (const side of [-1, 1]) for (const dir of [-1, 1]) {
    const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(2.6, 0.07, 0.07)), postMat);
    leg.position.set(0, 0, side * 0.78); leg.userData.dir = dir; legs.add(leg);
  }
  lift.add(legs); liftArms.userData.legs = legs; group.add(lift);

  return { group, liftArms, reflector, cones, leds, dispose: () => disposables.forEach((d) => d.dispose()) };
}

export default function GarageScene(props: GarageSceneProps) {
  const { report, lang, paint = "#2b3139", compact = false, debugParts = false, pinnedBeat, lead = false, exit = 0 } = props;
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [near, setNear] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [beat, setBeat] = useState<Beat>(pinnedBeat ?? 0);
  const [verdictIn, setVerdictIn] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const scrolling = !(compact || pinnedBeat !== undefined || debugParts);
  useStageFade(outerRef, stageRef, veilRef, lead && scrolling, scrolling ? exit : 0);
  const live = useRef({ target: pinnedBeat !== undefined ? (pinnedBeat === 5 ? 0.98 : progressCenterOfBeat(pinnedBeat)) : debugParts ? 0.52 : compact ? progressCenterOfBeat(3) : 0 });

  const readings = readingsByPart(report);
  const panelFindings = findingsByPanel(report);
  const obd = obdInfo(report);
  const counts = verdictCounts(report);

  useEffect(() => {
    const noFlag = new URLSearchParams(window.location.search).has("no3d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMobile(window.matchMedia("(max-width: 768px)").matches);
    setWebgl(!noFlag && !reduced && hasWebGL2());
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => setNear(e.isIntersecting)), { rootMargin: "900px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (compact || pinnedBeat !== undefined || debugParts || !webgl) return;
    const onScroll = () => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      live.current.target = total > 0 ? clamp01(-rect.top / total) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [compact, pinnedBeat, debugParts, webgl]);

  useEffect(() => {
    if (!webgl || !near || !hostRef.current) return;
    const host = hostRef.current;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    host.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.Fog(0x0a0c10, 13, 36);
    const pmrem = new THREE.PMREMGenerator(renderer);
    // Reflections/ambient: CC0 autoshop HDRI (Poly Haven; 1k on phones). Visible far background stays the Muse Image panorama.
    new RGBELoader().setDataType(THREE.FloatType).load(isMobile ? "/hdri/autoshop_01_1k.hdr" : "/hdri/autoshop_01_2k.hdr", (hdr) => {
      if (disposed) { hdr.dispose(); return; }
      const px = (hdr.image as unknown as { data?: Float32Array }).data;
      if (px) for (let i = 0; i < px.length; i++) if (px[i] > 16) px[i] = 16; // tame the strip lights: no blown hotspots through bloom
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
    });
    scene.environmentIntensity = 0.5;
    new THREE.TextureLoader().load("/garage/env-garage.jpg", (tex) => {
      if (disposed) return;
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(42, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: 0x565b62, fog: false }));
      scene.add(sphere);
    });

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 120);

    RectAreaLightUniformsLib.init();
    const rect1 = new THREE.RectAreaLight(0xdfeaff, 2.0, 8, 0.5);
    rect1.position.set(0, 4.35, -2.4);
    rect1.lookAt(0, 0, -2.4);
    const rect2 = rect1.clone();
    rect2.position.set(0, 4.35, 2.4);
    rect2.lookAt(0, 0, 2.4);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(6, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.camera.far = 30;
    const warm = new THREE.SpotLight(0xff9a3c, 22, 45, 0.55, 1);
    warm.position.set(-10, 4.4, -6.5);
    warm.target.position.set(0, 0.8, 0);
    // big soft top box over the lift: reads as a long highlight along the roof and bonnet
    const softbox = new THREE.RectAreaLight(0xf4f7ff, 2.4, 6.5, 3.2);
    softbox.position.set(0, 4.2, 0); softbox.lookAt(0, 0, 0);
    // cool rim lights low behind both sides: a bright edge along the silhouette from any orbit angle
    const rimL = new THREE.SpotLight(0xbcd4ff, 26, 22, 0.5, 0.9, 1.6); rimL.position.set(-6.5, 2.2, -5.5); rimL.target.position.set(0, 0.9, 0);
    const rimR = new THREE.SpotLight(0xbcd4ff, 26, 22, 0.5, 0.9, 1.6); rimR.position.set(6.5, 2.2, 5.5); rimR.target.position.set(0, 0.9, 0);
    scene.add(rect1, rect2, softbox, key, warm, warm.target, rimL, rimL.target, rimR, rimR.target, new THREE.HemisphereLight(0x9fb2d0, 0x1a1510, 0.8));

    const env = buildEnvironment(isMobile);
    scene.add(env.group);

    // Car: v2 hero (textured) + v2 parts, same coords; hero bbox defines one shared normalisation.
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    const paintBase = new THREE.Color(paint);
    interface LabelRec { obj: CSS2DObject; el: HTMLDivElement; offX: number; offZ: number }
    interface PartRec {
      node: THREE.Object3D; name: string; orig: THREE.Vector3;
      mats: THREE.MeshPhysicalMaterial[]; baseColors: THREE.Color[];
      center: THREE.Vector3; labels: LabelRec[];
    }
    const parts: PartRec[] = [];
    const heroMats: THREE.Material[] = [];
    let heroGroup: THREE.Group | null = null;
    let partsGroup: THREE.Group | null = null;
    let triangles = 0;
    let invScale = 1;
    let disposed = false;

    const countTris = (root: THREE.Object3D) => { let t = 0; root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const idx = m.geometry.getIndex(); t += (idx ? idx.count : m.geometry.getAttribute("position").count) / 3; } }); return t; };
    const samplePaint = (root: THREE.Object3D): THREE.Color => {
      let found: THREE.Color | null = null;
      root.traverse((o) => {
        if (found) return;
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
        const mtl = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        const img = mtl?.map?.image as CanvasImageSource & { width: number; height: number } | undefined;
        if (!img?.width) return;
        try {
          const c = document.createElement("canvas"); c.width = 16; c.height = 16;
          const g = c.getContext("2d"); if (!g) return;
          g.drawImage(img, 0, 0, 16, 16);
          const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { const lum = (d[i] + d[i + 1] + d[i + 2]) / 765; if (lum < 0.12 || lum > 0.88) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
          if (n > 8) found = new THREE.Color(r / n / 255, gg / n / 255, b / n / 255);
        } catch { /* keep fallback paint */ }
      });
      return found ?? paintBase.clone();
    };

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load("/models/car-v2.glb", (heroGltf) => {
      if (disposed) return;
      const hero = heroGltf.scene;
      // Same formula for both models: length (x) -> 4.4 m, wheels on floor, centred on x/z.
      const applyNorm = (m: THREE.Object3D) => {
        const b = new THREE.Box3().setFromObject(m);
        const sz = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3());
        const sc = 4.4 / sz.x; invScale = 1 / sc;
        m.scale.setScalar(sc); m.position.set(-c.x * sc, -b.min.y * sc, -c.z * sc);
        return sc;
      };
      applyNorm(hero);
      heroGroup = hero; carGroup.add(hero);
      hero.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = true; (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => { const sm = mt as THREE.MeshStandardMaterial; if ("envMapIntensity" in sm) sm.envMapIntensity = 0.9; heroMats.push(mt); }); });
      triangles += countTris(hero);
      const sampled = debugParts ? paintBase.clone() : samplePaint(hero);
      if (!debugParts) paintBase.copy(sampled).multiplyScalar(0.88); // parts read slightly brighter than the textured hero under the same light

      loader.load("/models/car-v2-parts.glb", (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        applyNorm(model);
        partsGroup = model; carGroup.add(model);
        model.updateMatrixWorld(true);
        const cabinMat = (new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, metalness: 0.35, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 }));
        const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0x141518, metalness: 0.3, roughness: 0.9, clearcoat: 0.2 });
        const underMat = new THREE.MeshPhysicalMaterial({ color: 0x191b1e, metalness: 0.2, roughness: 1, envMapIntensity: 0.3 });
        model.traverse((o) => {
          const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
          const name = mesh.name || o.parent?.name || "";
          const def = PART_MAP[name]; const kind = def?.kind ?? "detail";
          let material: THREE.MeshPhysicalMaterial;
          if (debugParts) { const hue = (partIndex(name) * 137.5) % 360; material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(`hsl(${hue},70%,55%)`), roughness: 0.5, metalness: 0.1 }); }
          else if (kind === "cabin" || kind === "mirror") material = withMatteInside(cabinMat.clone()); // clone() drops onBeforeCompile: wrap each copy
          else if (kind === "wheel") material = wheelMat.clone();
          else if (kind === "underbody") material = withMatteInside(underMat.clone());
          // metallic paint: base metal flake + glossy clearcoat picks up the autoshop HDRI; insides dark matte
          else material = withMatteInside(new THREE.MeshPhysicalMaterial({ color: paintBase.clone(), metalness: 0.5, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 }));
          material.transparent = true;
          mesh.material = material; mesh.castShadow = true;
          const partBox = new THREE.Box3().setFromObject(mesh);
          const partCenter = partBox.getCenter(new THREE.Vector3()); carGroup.worldToLocal(partCenter);
          const partSize = partBox.getSize(new THREE.Vector3());
          const rec: PartRec = { node: mesh, name, orig: mesh.position.clone(), mats: [material], baseColors: [material.color.clone()], center: partCenter, labels: [] };
          const makeLabel = (html: string, cls: string, offX: number, offZ: number) => {
            const el = document.createElement("div"); el.className = cls; el.innerHTML = html;
            const obj = new CSS2DObject(el); obj.position.set(partCenter.x + offX, partCenter.y + 0.32, partCenter.z + offZ);
            carGroup.add(obj); rec.labels.push({ obj, el, offX, offZ });
          };
          if (debugParts) makeLabel(`<b>${name}</b>`, "garage-debug-label", 0, 0);
          else for (const panel of def?.panels ?? []) {
            const reading = readings.get(name)?.find((r) => r.panel === panel);
            const fin = panelFindings.get(panel);
            if (!reading && !fin) continue;
            const bits: string[] = [];
            if (reading) bits.push(`<b style="color:${CLASS_COLOR[reading.cls]}">${reading.microns} ${lang === "ru" ? "мкм" : "µm"}</b>`);
            if (reading && reading.cls !== "factory") bits.push(`<span style="color:${CLASS_COLOR[reading.cls]}">${CLASS_LABEL[lang][reading.cls]}</span>`);
            if (fin?.verified) bits.push(`<span style="color:#86efac">✓ ${lang === "ru" ? "подтверждено" : "verified"}</span>`);
            else if (fin?.unverified) bits.push(`<span style="color:#c4b5fd">${lang === "ru" ? "не подтверждено" : "unconfirmed"}</span>`);
            const lo = panelLabelOffset(panel, partSize);
            makeLabel(bits.join(" · "), "garage-gauge-label", lo.x, lo.z);
            rec.labels[rec.labels.length - 1].el.style.opacity = "0";
          }
          parts.push(rec);
        });
        triangles += countTris(model);
        host.dataset.triangles = String(Math.round(triangles));
        host.dataset.parts = String(parts.length);
      }, undefined, () => { host.dataset.modelError = "1"; });
    }, undefined, () => { host.dataset.modelError = "1"; });

    let composer: EffectComposer | null = null;
    if (!isMobile) {
      try {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.35, 0.5, 0.85));
        composer.addPass(new OutputPass());
      } catch { composer = null; }
    }

    const ecoOff = new URLSearchParams(window.location.search).get("eco") === "off";
    let raf = 0;
    let smoothP = live.current.target;
    let frames = 0;
    let ecoAt = performance.now();
    let eco = false;
    const clock = new THREE.Clock();
    const camPos = new THREE.Vector3();
    const camTgt = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      smoothP += (live.current.target - smoothP) * (1 - Math.pow(0.002, dt));
      const p = clamp01(smoothP);
      const info = beatAt(p);
      setBeat((prev) => (prev === info.beat ? prev : info.beat));
      setVerdictIn(info.beat === 5 && info.local > 0.3);

      const entry = entryOffset(p);
      const lift = liftAmount(p);
      const explode = explodeAmount(p, !!obd);
      carGroup.position.set(entry, lift, 0);
      env.liftArms.position.y = 0.11 + lift;
      const legs = env.liftArms.userData.legs as THREE.Group;
      const h = 0.11 + lift;
      legs.children.forEach((leg) => {
        const ang = Math.asin(Math.min(0.95, h / 2.6)) * (leg.userData.dir as number);
        leg.rotation.z = ang;
        leg.position.y = h / 2;
      });

      // Beat 3: tint measured panels by paint class; verified findings pulse.
      const tintK = info.beat === 3 ? smooth(info.local * 3) : info.beat === 4 ? 1 : 0;
      for (const rec of parts) {
        const def = PART_MAP[rec.name];
        const off = def ? explodeOffset(rec.name, partExplodeT(def, explode)) : { x: 0, y: 0, z: 0 };
        rec.node.position.set(rec.orig.x + off.x * invScale, rec.orig.y + off.y * invScale, rec.orig.z + off.z * invScale);
        for (const lab of rec.labels) {
          lab.obj.position.set(rec.center.x + off.x + lab.offX, rec.center.y + off.y + 0.32, rec.center.z + off.z + lab.offZ);
          const show = debugParts ? 1 : info.beat === 3 ? clamp01((p - 0.56) / 0.04) : info.beat === 4 && obd ? 0.55 : 0;
          lab.el.style.opacity = String(debugParts ? 1 : show);
        }
        if (!debugParts && def?.kind !== "body") {
          const reading = readings.get(rec.name)?.find((r) => r.cls !== "factory") ?? readings.get(rec.name)?.[0];
          const fin = def?.panels.map((pn) => panelFindings.get(pn)).find((f) => f?.verified) ?? (def?.panels[0] ? panelFindings.get(def.panels[0]) : undefined);
          rec.mats.forEach((m, i) => {
            const base = rec.baseColors[i];
            if (reading && tintK > 0 && reading.cls !== "factory") {
              tmpColor.set(CLASS_COLOR[reading.cls]);
              m.color.copy(base).lerp(tmpColor, tintK * 0.35);
            } else m.color.copy(base);
            const pulse = fin?.verified && info.beat >= 3 && info.beat <= 4;
            m.emissive.set(pulse ? CLASS_COLOR[reading?.cls ?? "repaint"] : "#000000");
            m.emissiveIntensity = pulse ? 0.35 + Math.sin(time * 4) * 0.18 : 0;
          });
        }
      }

      const heroW = debugParts ? 0 : heroWeight(p);
      // transparency only while cross-fading: an always-transparent car sorts badly (dark blotches on the body)
      const setFade = (m: THREE.Material, o: number) => {
        const fading = o < 0.999;
        if (m.transparent !== fading) { m.transparent = fading; m.needsUpdate = true; }
        m.opacity = o;
        m.depthWrite = o > 0.5;
      };
      if (heroGroup) { heroGroup.visible = heroW > 0.01; heroMats.forEach((m) => setFade(m, heroW)); }
      if (partsGroup) { partsGroup.visible = heroW < 0.99; parts.forEach((r) => r.mats.forEach((m) => setFade(m, 1 - heroW))); }
      if (debugParts) { camPos.set(6.2, 2.3, 6.0); camTgt.set(0, 0.95, 0); }
      else cameraPose(p, camPos, camTgt, entry);
      camera.position.copy(camPos);
      camera.lookAt(camTgt);
      // top-down readings view flies above the ceiling strips: hide them (and their haze) so they never cover the car
      const aboveCeiling = camPos.y > 4.1;
      env.leds.forEach((l) => { l.visible = !aboveCeiling; });
      if (!eco) env.cones.forEach((c) => { c.visible = !aboveCeiling; });

      frames++;
      if (!eco && performance.now() - ecoAt > 2000) {
        const fps = frames / ((performance.now() - ecoAt) / 1000);
        host.dataset.fps = fps.toFixed(1);
        if (fps < 40 && !ecoOff) {
          eco = true;
          host.dataset.eco = "1";
          renderer.setPixelRatio(1);
          composer = null;
          if (env.reflector) env.reflector.visible = false;
          env.cones.forEach((c) => { c.visible = false; });
        }
        frames = 0;
        ecoAt = performance.now();
      }
      if (composer && !eco) composer.render();
      else renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      labelRenderer.setSize(host.clientWidth, host.clientHeight);
      composer?.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const m = mesh.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x?.dispose());
        }
      });
      env.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      if (labelRenderer.domElement.parentElement === host) host.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, near, mobile]);

  if (webgl === false) {
    return (
      <div className="garage-fallback mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="garage-fallback">
        {([0, 1, 2, 3, 4, 5] as Beat[]).map((b) => (
          <article key={b} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="font-medium text-zinc-50">{BEAT_CAPTIONS[b][lang]}</h3>
            {b === 3 && readings.size > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                {allReadings(report).map((r) => (
                  <li key={r.part} className="flex justify-between gap-2">
                    <span>{panelLabel(r.panel, lang)}</span>
                    <b style={{ color: CLASS_COLOR[r.cls] }}>{r.microns} {lang === "ru" ? "мкм" : "µm"} · {CLASS_LABEL[lang][r.cls]}</b>
                  </li>
                ))}
              </ul>
            )}
            {b === 4 && (obd
              ? <p className="mt-2 text-sm text-zinc-300">OBD: {obd.systems ?? "—"} {lang === "ru" ? "систем" : "systems"}{obd.errors !== null ? `, ${lang === "ru" ? "ошибок" : "errors"} ${obd.errors}` : ""}</p>
              : <p className="mt-2 text-sm text-zinc-500">{lang === "ru" ? "Нет данных OBD в отчёте" : "No OBD data in the report"}</p>)}
            {b === 5 && report && (
              <p className="mt-2 text-sm text-zinc-300">
                <b>{report.verdict.decision.replace("_", " ")}</b> · {counts.total} {lang === "ru" ? "находок" : "findings"}, {counts.confirmed} {lang === "ru" ? "подтверждено" : "confirmed"}
              </p>
            )}
          </article>
        ))}
      </div>
    );
  }

  const obdText = obd && obd.systems !== null
    ? `OBD: ${obd.systems} ${lang === "ru" ? "систем" : "systems"}${obd.errors !== null ? `, ${lang === "ru" ? "ошибок" : "errors"} ${obd.errors}` : ""}`
    : obd ? "OBD" : null;

  return (
    <div ref={outerRef} data-garage-outer className="relative w-full" style={scrolling ? leadStyle(mobile ? "650vh" : "500vh", lead) : undefined}>
      <div ref={stageRef} style={lead && scrolling ? { opacity: 0 } : undefined} className={compact ? "relative h-[78vh] min-h-[480px] w-full overflow-hidden" : pinnedBeat !== undefined || debugParts ? "relative h-[100svh] w-full overflow-hidden" : "sticky top-0 h-[100svh] w-full overflow-hidden"}>
        <div ref={hostRef} className="absolute inset-0 bg-[#0a0c10]" data-testid="garage-canvas-host" />
        <style>{`
          .garage-gauge-label{pointer-events:none;background:rgba(8,10,14,.78);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:2px 7px;font:500 11px/1.5 system-ui,sans-serif;color:#e4e7ee;white-space:nowrap;transition:opacity .2s}
          .garage-debug-label{pointer-events:none;background:rgba(8,10,14,.8);border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:1px 5px;font:600 10px/1.5 ui-monospace,monospace;color:#fff;white-space:nowrap}
        `}</style>

        {!debugParts && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{beat + 1} / 6</p>
            <h2 className="mt-1 max-w-2xl text-2xl font-semibold text-white sm:text-4xl">{beat === 4 && !obdText ? REASSEMBLE_CAPTION[lang] : BEAT_CAPTIONS[beat][lang]}</h2>
            {beat === 4 && obdText && <p className="mt-2 inline-block rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">{obdText}</p>}
            {beat === 3 && readings.size > 0 && (
              <p className="mt-2 text-sm text-zinc-300">
                {allReadings(report).filter((r) => r.cls !== "factory").map((r) => `${panelLabel(r.panel, lang)}: ${r.microns} ${lang === "ru" ? "мкм" : "µm"}`).join(" · ") || (lang === "ru" ? "Все замеры в заводской норме" : "All readings within factory range")}
              </p>
            )}
          </div>
        )}

        {!debugParts && report && (
          <div className={`absolute bottom-24 right-4 w-[320px] max-w-[82vw] rounded-2xl border border-white/15 bg-black/55 p-4 text-zinc-100 backdrop-blur-md transition-all duration-500 sm:bottom-8 sm:right-8 ${verdictIn ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`} aria-hidden={!verdictIn}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{lang === "ru" ? "Вердикт" : "Verdict"}</p>
            <p className={`mt-1 text-3xl font-bold ${report.verdict.decision === "BUY" ? "text-emerald-300" : report.verdict.decision === "WALK_AWAY" ? "text-red-300" : "text-amber-300"}`}>
              {report.verdict.decision.replace("_", " ")}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {counts.total} {lang === "ru" ? "находок" : "findings"} · {counts.confirmed} {lang === "ru" ? "подтверждено" : "confirmed"}
            </p>
            <a href={`/r/${report.id}`} className="mt-3 inline-block rounded-full bg-amber-300 px-4 py-1.5 text-sm font-semibold text-zinc-950">
              {lang === "ru" ? "Открыть отчёт" : "Open report"}
            </a>
          </div>
        )}
        <div ref={veilRef} aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-0" />
        {debugParts && (
          <p className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-1.5 font-mono text-xs text-white">debug=parts · tripo_part_0..21</p>
        )}
      </div>
    </div>
  );
}
