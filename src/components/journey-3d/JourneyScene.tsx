// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Scroll journey scene Korea->Vladivostok: buildCar on a route, code scenery, Muse Image backdrop domes, stage HUD
// @created: 2026-10-28
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { BodyType } from "../damage-map-3d/bodyTemplates";
import { buildCar } from "../damage-map-3d/buildCar";
import { STAGE_IDS, STAGE_LABELS, buildRouteCurve, progressCenterOf, stageAt, stageIndex, type StageId } from "./route";
import { buildScenery } from "./scenery";

export interface JourneySceneProps {
  bodyType: BodyType;
  doors?: 3 | 5;
  lang: "ru" | "en";
  currentStage?: StageId;
  compact?: boolean;
}

const T = {
  ru: { here: "Ваша машина здесь", ready: "Report ready", cleared: "Cleared", next: "Далее", done: "Пройдено" },
  en: { here: "Your car is here", ready: "Report ready", cleared: "Cleared", next: "Up next", done: "Done" },
};

const PALETTES = [
  { fog: "#141a24", bg: "#141a24", hemi: 0.7, sun: 1.2 }, // inspection dusk
  { fog: "#0a1020", bg: "#0a1020", hemi: 0.45, sun: 0.5 }, // night road
  { fog: "#1a1c26", bg: "#1a1c26", hemi: 0.6, sun: 0.8 }, // port dusk
  { fog: "#2a3648", bg: "#2a3648", hemi: 0.85, sun: 1.3 }, // sea dawn
  { fog: "#4a4038", bg: "#4a4038", hemi: 1.0, sun: 1.8 }, // Vladivostok sunrise
  { fog: "#3a3f45", bg: "#3a3f45", hemi: 0.9, sun: 1.4 }, // customs morning
  { fog: "#4f4234", bg: "#4f4234", hemi: 1.0, sun: 1.7 }, // delivery sunrise
];

function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function JourneyScene(props: JourneySceneProps) {
  const { bodyType, doors, lang, currentStage, compact = false } = props;
  const t = T[lang];
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState<StageId>(currentStage ?? "inspection");
  const live = useRef({ target: compact ? progressCenterOf(currentStage ?? "inspection") : 0, currentStage, compact });
  live.current.currentStage = currentStage;
  live.current.compact = compact;
  if (compact) live.current.target = progressCenterOf(currentStage ?? "inspection");

  useEffect(() => {
    const noFlag = new URLSearchParams(window.location.search).has("no3d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMobile(window.matchMedia("(max-width: 768px)").matches);
    setWebgl(!noFlag && !reduced && hasWebGL2());
  }, []);

  // Scroll -> target progress (non-compact)
  useEffect(() => {
    if (compact || !webgl) return;
    const onScroll = () => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      live.current.target = p;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [compact, webgl]);

  useEffect(() => {
    if (!webgl || !hostRef.current) return;
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTES[0].bg);
    scene.fog = new THREE.Fog(PALETTES[0].fog, 40, 260);
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 900);

    const hemi = new THREE.HemisphereLight("#cfd8ec", "#1a1512", 0.7);
    const sun = new THREE.DirectionalLight("#ffdcb0", 1.2);
    sun.position.set(30, 45, 20);
    const fill = new THREE.DirectionalLight("#bcd0ff", 0.55);
    fill.position.set(-25, 18, -30);
    scene.add(hemi, sun, fill, new THREE.AmbientLight("#ffffff", 0.22));

    const curve = buildRouteCurve();
    const scenery = buildScenery();
    scene.add(scenery.group);
    const car = buildCar(bodyType, { doors, stations: 80 });
    scene.add(car.root);

    // Dim stages after the client's current stage
    if (currentStage) {
      const ci = stageIndex(currentStage);
      scenery.zones.forEach((zone, id) => {
        if (stageIndex(id) <= ci) return;
        zone.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => { m.transparent = true; m.opacity = 0.32; });
        });
      });
    }

    // Backdrop domes (crossfade)
    const loader = new THREE.TextureLoader();
    const textures = STAGE_IDS.map((s) => {
      const tex = loader.load(`/journey/${s}.jpg`);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });
    const domeGeo = new THREE.SphereGeometry(420, 24, 16);
    const mkDome = () => new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, fog: false, depthWrite: false }));
    const domeA = mkDome();
    const domeB = mkDome();
    (domeA.material as THREE.MeshBasicMaterial).map = textures[0];
    domeA.scale.set(1, 0.45, 1);
    domeB.scale.set(1, 0.45, 1);
    domeA.position.set(90, 0, -175);
    domeB.position.copy(domeA.position);
    scene.add(domeA, domeB);
    let domeStage = 0;

    let raf = 0;
    let smooth = live.current.target;
    let frames = 0;
    let ecoCheckedAt = performance.now();
    let eco = false;
    const clock = new THREE.Clock();
    const carPos = new THREE.Vector3();
    const deckPos = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      smooth += (live.current.target - smooth) * (live.current.compact ? 0.12 : 1 - Math.pow(0.0015, dt));
      const p = Math.min(1, Math.max(0, smooth));
      const stage = stageAt(p);
      setActive((prev) => (prev === stage ? prev : stage));
      const segT = p * STAGE_IDS.length - stageIndex(stage);

      // Palette / fog crossfade
      const a = PALETTES[stageIndex(stage)];
      const b = PALETTES[Math.min(PALETTES.length - 1, stageIndex(stage) + 1)];
      const mix = (x: number, y: number) => x + (y - x) * Math.min(1, segT);
      (scene.background as THREE.Color).set(a.bg).lerp(new THREE.Color(b.bg), Math.min(1, segT));
      scene.fog?.color.copy((scene.background as THREE.Color));
      hemi.intensity = mix(a.hemi, b.hemi);
      sun.intensity = mix(a.sun, b.sun);

      // Backdrop crossfade at segment edges
      const si = stageIndex(stage);
      if (si !== domeStage) {
        const old = domeStage < si ? domeA : domeB;
        const cur = domeStage < si ? domeB : domeA;
        (cur.material as THREE.MeshBasicMaterial).map = textures[si];
        (cur.material as THREE.MeshBasicMaterial).needsUpdate = true;
        (old.material as THREE.MeshBasicMaterial).opacity = 0;
        (cur.material as THREE.MeshBasicMaterial).opacity = 1;
        domeStage = si;
      }

      // Ship bobbing + car placement (on deck during sea)
      scenery.ship.position.y = Math.sin(time * 0.8) * 0.18;
      scenery.ship.rotation.z = Math.sin(time * 0.6) * 0.012;
      if (!eco) scenery.waterMaterial.uniforms.uTime.value = time;

      curve.getPointAt(Math.min(0.999, p), carPos);
      const tangent = curve.getTangentAt(Math.min(0.999, p));
      let yaw = Math.atan2(tangent.x, tangent.z);
      if (stage === "sea") {
        deckPos.setFromMatrixPosition(scenery.ship.matrixWorld);
        deckPos.y = scenery.shipDeckY + scenery.ship.position.y;
        const w = Math.min(1, Math.min(segT, 1 - segT) * 3);
        carPos.lerp(deckPos, w);
        yaw = scenery.ship.rotation.y + Math.PI;
      }
      car.root.position.copy(carPos);
      car.root.rotation.set(0, yaw, 0);

      // Camera follows behind/above, slight orbit at sea
      const orbit = stage === "sea" ? Math.sin(time * 0.35) * 3.2 : 0;
      tmp.copy(tangent).multiplyScalar(-11);
      camera.position.set(carPos.x + tmp.x + orbit, carPos.y + 4.6, carPos.z + tmp.z);
      camera.lookAt(carPos.x + tangent.x * 9, carPos.y + 1.1, carPos.z + tangent.z * 9);
      domeA.position.x = camera.position.x * 0.4 + 55;
      domeB.position.copy(domeA.position);

      // Eco: mean FPS over first 2s < 40 -> static water, pixelRatio 1
      frames++;
      if (!eco && performance.now() - ecoCheckedAt > 2000) {
        const fps = frames / ((performance.now() - ecoCheckedAt) / 1000);
        if (fps < 40) {
          eco = true;
          host.dataset.eco = "1";
          renderer.setPixelRatio(1);
          scenery.water.material = new THREE.MeshStandardMaterial({ color: "#12303f", roughness: 0.85 });
          if (scene.fog && "far" in scene.fog) scene.fog.far = 190;
        }
        frames = 0;
        ecoCheckedAt = performance.now();
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      textures.forEach((x) => x.dispose());
      domeGeo.dispose();
      scenery.dispose();
      car.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, bodyType, doors]);

  if (webgl === false) {
    return (
      <div className="journey-fallback mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="journey-fallback">
        {STAGE_IDS.map((s) => (
          <article key={s} className={`overflow-hidden rounded-xl border ${s === currentStage ? "border-amber-300" : "border-zinc-800"} bg-zinc-900`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/journey/${s}.jpg`} alt="" className="h-36 w-full object-cover" />
            <div className="p-4">
              <h3 className="font-medium text-zinc-50">{STAGE_LABELS[s][lang]}</h3>
              {s === currentStage && <p className="mt-1 text-sm text-amber-300">● {t.here}</p>}
              {s === "inspection" && <p className="mt-1 text-xs text-zinc-400">{t.ready}</p>}
              {s === "customs" && <p className="mt-1 text-xs text-zinc-400">{t.cleared}</p>}
            </div>
          </article>
        ))}
      </div>
    );
  }

  const currentIdx = currentStage ? stageIndex(currentStage) : -1;
  return (
    <div ref={outerRef} className="relative w-full" style={{ height: compact ? undefined : mobile ? "500vh" : "700vh" }}>
      <div className={compact ? "relative h-[70vh] min-h-[420px] w-full overflow-hidden" : "sticky top-0 h-screen w-full overflow-hidden"}>
        <div ref={hostRef} className="absolute inset-0" data-testid="journey-canvas-host" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{stageIndex(active) + 1} / 7</p>
          <h2 className="mt-1 text-2xl font-semibold text-white sm:text-4xl">{STAGE_LABELS[active][lang]}</h2>
          {currentStage === active && (
            <p className="mt-2 inline-flex animate-pulse items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-zinc-950">● {t.here}</p>
          )}
          {active === "inspection" && <p className="mt-2 text-sm text-emerald-300">{t.ready}</p>}
          {active === "customs" && (
            <p className="mt-3 inline-block -rotate-6 rounded border-2 border-emerald-300 px-3 py-1 text-lg font-bold uppercase tracking-widest text-emerald-300">{t.cleared}</p>
          )}
        </div>
        {currentStage && (
          <div className="absolute right-4 top-4 hidden flex-col gap-1 sm:flex">
            {STAGE_IDS.map((s, i) => (
              <span key={s} className={`rounded px-2 py-0.5 text-right text-[11px] ${i === currentIdx ? "bg-amber-300 font-semibold text-zinc-950" : i < currentIdx ? "text-zinc-400" : "text-zinc-600"}`}>
                {i < currentIdx ? `${t.done}: ` : ""}{STAGE_LABELS[s][lang]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
