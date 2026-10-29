// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Garage inspection scroll scene: real 32-part car on a lift, exploded view, gauge labels, verdict
// @created: 2026-10-29
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Report } from "@/lib/schema";
import { panelLabel } from "@/lib/domain/panels";
import {
  BEAT_CAPTIONS, REASSEMBLE_CAPTION, PART_MAP, beatAt, entryOffset, explodeAmount, explodeOffset, findingsByPanel,
  liftAmount, obdInfo, partExplodeT, partIndex, progressCenterOfBeat, readingsByPart, verdictCounts,
  type Beat,
} from "./parts";

export interface GarageSceneProps {
  report?: Report;
  lang: "ru" | "en";
  paint?: string;
  compact?: boolean;
  debugParts?: boolean;
  /** Pin the scene to the middle of a beat (lab captures). */
  pinnedBeat?: Beat;
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
  [0.0, 30, 8.2, 0.8, 0.6],
  [0.15, 58, 7.4, 1.0, 0.75],
  [0.3, 96, 6.8, 0.45, 1.15],
  [0.55, 150, 9.0, 3.6, 1.15],
  [0.66, 182, 6.4, 7.0, 0.9],
  [0.75, 215, 9.0, 3.8, 1.15],
  [0.88, 262, 8.2, 2.0, 1.0],
  [1.0, 322, 7.8, 1.3, 0.75],
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

function buildEnvironment(mobile: boolean): { group: THREE.Group; liftArms: THREE.Group; reflector: Reflector | null; cones: THREE.Object3D[]; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const mat = (m: THREE.Material) => { disposables.push(m); return m; };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { disposables.push(g); return g; };

  // Floor: real mirror under a dark glossy epoxy layer (desktop), plain glossy plane on mobile.
  let reflector: Reflector | null = null;
  if (!mobile) {
    reflector = new Reflector(geo(new THREE.PlaneGeometry(46, 30)), {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x232831,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.02;
    group.add(reflector);
  }
  const floor = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(46, 30)),
    mat(new THREE.MeshPhysicalMaterial({
      color: 0x05070a, roughness: mobile ? 0.28 : 0.42, metalness: 0.45,
      transparent: !mobile, opacity: mobile ? 1 : 0.86, envMapIntensity: 0.2,
    })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls + tool cabinets as dark silhouettes.
  const wallMat = mat(new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.95 }));
  const cabMat = mat(new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 0.8, metalness: 0.35 }));
  const backWall = new THREE.Mesh(geo(new THREE.BoxGeometry(46, 7, 0.3)), wallMat);
  backWall.position.set(0, 3.5, -7.5);
  const leftWall = new THREE.Mesh(geo(new THREE.BoxGeometry(0.3, 7, 30)), wallMat);
  leftWall.position.set(-13, 3.5, 0);
  group.add(backWall, leftWall);
  for (let i = 0; i < 5; i++) {
    const cab = new THREE.Mesh(geo(new THREE.BoxGeometry(1.7, 2.1, 0.55)), cabMat);
    cab.position.set(-6.4 + i * 1.85, 1.05, -7.05);
    group.add(cab);
    const strip = new THREE.Mesh(geo(new THREE.BoxGeometry(1.5, 0.03, 0.03)), mat(new THREE.MeshBasicMaterial({ color: 0x2c3542 })));
    strip.position.set(-6.4 + i * 1.85, 1.7, -6.76);
    group.add(strip);
  }

  // Ceiling LED strips (emissive) + light cones / haze.
  const cones: THREE.Object3D[] = [];
  const ledMat = mat(new THREE.MeshBasicMaterial({ color: 0xeaf2ff }));
  for (const z of [-2.6, 0, 2.6]) {
    const led = new THREE.Mesh(geo(new THREE.BoxGeometry(9, 0.06, 0.28)), ledMat);
    led.position.set(0, 4.4, z);
    group.add(led);
    const cone = new THREE.Mesh(
      geo(new THREE.ConeGeometry(1.7, 4.4, 24, 1, true)),
      mat(new THREE.MeshBasicMaterial({ color: 0x9db8dd, transparent: true, opacity: 0.01, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    );
    cone.position.set(0, 2.2, z);
    cones.push(cone);
    group.add(cone);
  }

  // Low scissor platform lift: two runways on X-legs; nothing tall between the camera and the car.
  const lift = new THREE.Group();
  const postMat = mat(new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.4, metalness: 0.8 }));
  const yellowMat = mat(new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5, metalness: 0.3 }));
  const basePlate = new THREE.Mesh(geo(new THREE.BoxGeometry(4.6, 0.06, 2.3)), postMat);
  basePlate.position.set(0, 0.03, 0);
  basePlate.receiveShadow = true;
  lift.add(basePlate);
  const liftArms = new THREE.Group();
  for (const side of [-1, 1]) {
    const runway = new THREE.Mesh(geo(new THREE.BoxGeometry(4.3, 0.1, 0.55)), postMat);
    runway.position.set(0, 0, side * 0.78);
    runway.castShadow = true;
    const edge = new THREE.Mesh(geo(new THREE.BoxGeometry(4.3, 0.012, 0.06)), yellowMat);
    edge.position.set(0, 0.056, side * 1.03);
    liftArms.add(runway, edge);
  }
  lift.add(liftArms);
  // scissor legs scale with the lift height (updated per frame via userData)
  const legs = new THREE.Group();
  for (const side of [-1, 1]) for (const dir of [-1, 1]) {
    const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(2.6, 0.07, 0.07)), postMat);
    leg.position.set(0, 0, side * 0.78);
    leg.userData.dir = dir;
    legs.add(leg);
  }
  lift.add(legs);
  liftArms.userData.legs = legs;
  group.add(lift);

  return { group, liftArms, reflector, cones, dispose: () => disposables.forEach((d) => d.dispose()) };
}

export default function GarageScene(props: GarageSceneProps) {
  const { report, lang, paint = "#2b3139", compact = false, debugParts = false, pinnedBeat } = props;
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [near, setNear] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [beat, setBeat] = useState<Beat>(pinnedBeat ?? 0);
  const [verdictIn, setVerdictIn] = useState(false);
  const live = useRef({ target: pinnedBeat !== undefined ? progressCenterOfBeat(pinnedBeat) : debugParts ? 0.52 : compact ? progressCenterOfBeat(3) : 0 });

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
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    host.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.Fog(0x0a0c10, 14, 34);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 120);

    RectAreaLightUniformsLib.init();
    const rect1 = new THREE.RectAreaLight(0xdfeaff, 2.6, 8, 0.5);
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
    scene.add(rect1, rect2, key, warm, warm.target, new THREE.HemisphereLight(0x8fa3c4, 0x14100c, 0.65));

    const env = buildEnvironment(isMobile);
    scene.add(env.group);

    // Car: wrapper (normalised metres) -> liftGroup (entry drive + lift) handled here.
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    const paintBase = new THREE.Color(paint);
    interface PartRec {
      node: THREE.Object3D; name: string; orig: THREE.Vector3;
      mats: THREE.MeshPhysicalMaterial[]; baseColors: THREE.Color[];
      center: THREE.Vector3; label?: CSS2DObject; labelEl?: HTMLDivElement;
    }
    const parts: PartRec[] = [];
    let triangles = 0;
    let invScale = 1;
    let disposed = false;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load("/models/hero-car-parts.glb", (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 4.4 / size.x;
      invScale = 1 / scale;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      carGroup.add(model);
      model.updateMatrixWorld(true);

      const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, metalness: 0.35, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 });
      const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0x141518, metalness: 0.3, roughness: 0.9, clearcoat: 0.2 });
      const lightMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe0ff, emissive: 0xaecbf5, emissiveIntensity: 1.1, metalness: 0.1, roughness: 0.25 });
      const underMat = new THREE.MeshPhysicalMaterial({ color: 0x191b1e, metalness: 0.2, roughness: 1, envMapIntensity: 0.3 });

      let meshIdx = 0;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const rawName = mesh.name || o.parent?.name || "";
        const name = PART_MAP[rawName] ? rawName : `tripo_part_${meshIdx}`;
        meshIdx++;
        const def = PART_MAP[name];
        const kind = def?.kind ?? "detail";
        let material: THREE.MeshPhysicalMaterial;
        if (debugParts) {
          const hue = (partIndex(name) * 137.5) % 360;
          material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(`hsl(${hue},70%,55%)`), roughness: 0.5, metalness: 0.1 });
        } else if (kind === "cabin" || kind === "mirror") material = cabinMat.clone();
        else if (kind === "wheel") material = wheelMat.clone();
        else if (kind === "light") material = lightMat.clone();
        else if (kind === "underbody") material = underMat.clone();
        else material = new THREE.MeshPhysicalMaterial({ color: paintBase.clone(), metalness: 0.45, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 0.9 });
        try {
          const g = mergeVertices(mesh.geometry.deleteAttribute("normal") ?? mesh.geometry, 1e-4);
          g.computeVertexNormals();
          mesh.geometry.dispose();
          mesh.geometry = g;
        } catch { /* keep original normals */ }
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        const idx = mesh.geometry.getIndex();
        triangles += (idx ? idx.count : mesh.geometry.getAttribute("position").count) / 3;

        const partBox = new THREE.Box3().setFromObject(mesh);
        const partCenter = partBox.getCenter(new THREE.Vector3());
        carGroup.worldToLocal(partCenter);
        const rec: PartRec = {
          node: mesh, name, orig: mesh.position.clone(),
          mats: [material], baseColors: [material.color.clone()],
          center: partCenter,
        };
        // Gauge / debug labels anchored in carGroup space; they follow the part via per-frame offset.
        const makeLabel = (html: string, cls: string) => {
          const el = document.createElement("div");
          el.className = cls;
          el.innerHTML = html;
          const obj = new CSS2DObject(el);
          obj.position.copy(partCenter).y += name === "tripo_part_0" ? 0.25 : 0.32;
          if (name === "tripo_part_0") { obj.position.x += size.x * scale * 0.28; obj.position.z -= 0.8; }
          carGroup.add(obj);
          return { obj, el };
        };
        if (debugParts) {
          const { obj, el } = makeLabel(`<b>${name}</b>`, "garage-debug-label");
          rec.label = obj; rec.labelEl = el;
        } else {
          const reading = readings.get(name);
          const fin = def?.panel ? panelFindings.get(def.panel) : undefined;
          if (reading || fin) {
            const bits: string[] = [];
            if (reading) bits.push(`<b style="color:${CLASS_COLOR[reading.cls]}">${reading.microns} ${lang === "ru" ? "мкм" : "µm"}</b>`);
            if (reading && reading.cls !== "factory") bits.push(`<span style="color:${CLASS_COLOR[reading.cls]}">${CLASS_LABEL[lang][reading.cls]}</span>`);
            if (fin?.verified) bits.push(`<span style="color:#86efac">✓ ${lang === "ru" ? "подтверждено" : "verified"}</span>`);
            else if (fin?.unverified) bits.push(`<span style="color:#c4b5fd">${lang === "ru" ? "не подтверждено" : "unconfirmed"}</span>`);
            const { obj, el } = makeLabel(bits.join(" · "), "garage-gauge-label");
            el.style.opacity = "0";
            rec.label = obj; rec.labelEl = el;
          }
        }
        parts.push(rec);
      });
      host.dataset.triangles = String(Math.round(triangles));
      host.dataset.parts = String(parts.length);
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
        if (rec.label) {
          rec.label.position.set(rec.center.x + off.x, rec.center.y + off.y + (rec.name === "tripo_part_0" ? 0.25 : 0.32), rec.center.z + off.z);
          if (rec.name === "tripo_part_0") { rec.label.position.x += 1.2; rec.label.position.z -= 0.8; }
        }
        if (rec.labelEl) {
          const show = debugParts ? 1 : info.beat === 3 ? clamp01((p - 0.56) / 0.04) : info.beat === 4 && obd ? 0.55 : 0;
          rec.labelEl.style.opacity = String(debugParts ? 1 : show);
        }
        if (!debugParts && def?.kind !== "body") {
          const reading = readings.get(rec.name);
          const fin = def?.panel ? panelFindings.get(def.panel) : undefined;
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

      if (debugParts) { camPos.set(6.2, 2.3, 6.0); camTgt.set(0, 0.95, 0); }
      else cameraPose(p, camPos, camTgt, entry);
      camera.position.copy(camPos);
      camera.lookAt(camTgt);

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
                {[...readings.values()].map((r) => (
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
    <div ref={outerRef} data-garage-outer className="relative w-full" style={{ height: compact || pinnedBeat !== undefined || debugParts ? undefined : mobile ? "650vh" : "500vh" }}>
      <div className={compact ? "relative h-[78vh] min-h-[480px] w-full overflow-hidden" : pinnedBeat !== undefined || debugParts ? "relative h-[100svh] w-full overflow-hidden" : "sticky top-0 h-[100svh] w-full overflow-hidden"}>
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
                {[...readings.values()].filter((r) => r.cls !== "factory").map((r) => `${panelLabel(r.panel, lang)}: ${r.microns} ${lang === "ru" ? "мкм" : "µm"}`).join(" · ") || (lang === "ru" ? "Все замеры в заводской норме" : "All readings within factory range")}
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
        {debugParts && (
          <p className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-1.5 font-mono text-xs text-white">debug=parts · tripo_part_0..31</p>
        )}
      </div>
    </div>
  );
}
