// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: 2.5D journey: Muse Image plate fills the viewport, buildCar + minimal foreground geometry blended by fog/rim light; 3 beats per stage
// @created: 2026-10-28
// @updated: 2026-10-29 muse-code
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { BodyType } from "../damage-map-3d/bodyTemplates";
import { buildCar } from "../damage-map-3d/buildCar";
import { STAGE_IDS, STAGE_LABELS, beatAt, buildRouteCurve, progressCenterOf, progressOf, stageIndex, type StageId } from "./route";
import { buildScenery } from "./scenery";
import { CONTENT_LABELS, STAGE_CONTENT, TOTAL_TIME } from "./stageContent";

export interface JourneySceneProps {
  bodyType: BodyType;
  doors?: 3 | 5;
  lang: "ru" | "en";
  currentStage?: StageId;
  compact?: boolean;
  /** Optional report counters for the inspection proof beat; block hides when absent. */
  reportSummary?: { findings: number; confirmed: number };
}

const T = {
  ru: { here: "Ваша машина здесь", ready: "Report ready", cleared: "Cleared", done: "Пройдено", photoFix: "Фотофиксация состояния", findings: "находок", confirmed: "подтверждено", doc1: "СБКТС / ЭПТС", doc2: "Таможенная декларация", doc3: "Выпуск — Cleared" },
  en: { here: "Your car is here", ready: "Report ready", cleared: "Cleared", done: "Done", photoFix: "Condition photo record", findings: "findings", confirmed: "confirmed", doc1: "SBKTS / EPTS", doc2: "Customs declaration", doc3: "Release — Cleared" },
};

/** Sky tint per stage for the rim light (sampled from the plate mood, not the photo file). */
const SKY = ["#ffd9a8", "#7fa8ff", "#ffb37a", "#ffd9b0", "#ffc9a0", "#cfe0ee", "#ffd2a0"];
const FALLBACK_FOG = ["#2a2f38", "#101725", "#33291f", "#31435a", "#4a3a2c", "#3c4148", "#46392c"];

function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

/** Mean colour of the bottom 10% of an image — the fog/ground tint that hides the plate seam. */
function bottomTint(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 48;
        c.height = 24;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve("#22262e");
        ctx.drawImage(img, 0, 0, 48, 24);
        const d = ctx.getImageData(0, 21, 48, 3).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        resolve(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
      } catch { resolve("#22262e"); }
    };
    img.onerror = () => resolve("#22262e");
    img.src = src;
  });
}

function contactShadowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.62)");
  grad.addColorStop(0.65, "rgba(0,0,0,0.34)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export default function JourneyScene(props: JourneySceneProps) {
  const { bodyType, doors, lang, currentStage, compact = false, reportSummary } = props;
  const t = T[lang];
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const bgFrontRef = useRef<HTMLImageElement>(null);
  const bgBackRef = useRef<HTMLImageElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState<StageId>(currentStage ?? "inspection");
  const [plate, setPlate] = useState<StageId>(currentStage ?? "inspection");
  const [prevPlate, setPrevPlate] = useState<StageId | null>(null);
  const [beat, setBeat] = useState<0 | 1 | 2>(0);
  const [beatStep, setBeatStep] = useState(0);
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

  useEffect(() => {
    if (compact || !webgl) return;
    const onScroll = () => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      live.current.target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [compact, webgl]);

  // Plate crossfade (0.6s): previous plate stays under the fading-in current one.
  useEffect(() => {
    if (active === plate) return;
    setPrevPlate(plate);
    setPlate(active);
    const id = window.setTimeout(() => setPrevPlate(null), 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const scrollToStage = (stage: StageId) => {
    const el = outerRef.current;
    if (!el) return;
    const top = el.offsetTop + progressOf(stage) * (el.offsetHeight - window.innerHeight);
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    if (!webgl || !hostRef.current) return;
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color(FALLBACK_FOG[0]), 22, 105);
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 900);

    const hemi = new THREE.HemisphereLight("#cfd8ec", "#1a1512", 0.75);
    const sun = new THREE.DirectionalLight("#ffdcb0", 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
    sun.shadow.camera.far = 90;
    const rim = new THREE.DirectionalLight(SKY[0], 1.6);
    rim.name = "rim";
    scene.add(hemi, sun, sun.target, rim, new THREE.AmbientLight("#ffffff", 0.22));

    const curve = buildRouteCurve();
    const scenery = buildScenery();
    // Ground is unlit fog colour: it melts into the plate's bottom edge instead of shading into a seam.
    scenery.ground.material = new THREE.MeshBasicMaterial({ color: FALLBACK_FOG[0] });
    scene.add(scenery.group);
    // 2.5D rule: per stage only its own minimal foreground stays visible.
    const bridgeZone = scenery.zones.get("korea_road");
    if (bridgeZone) bridgeZone.visible = false; // bridge lives on the photo plate only
    const hillsZone = scenery.zones.get("vladivostok");
    if (hillsZone) hillsZone.visible = false; // 3D hills argue with the mountain plate — plate wins
    const deliveryZone = scenery.zones.get("delivery");
    if (deliveryZone) deliveryZone.visible = false; // thin side strips read as artefacts; road + plate carry the stage
    const roadObj = scenery.group.getObjectByName("road");
    scenery.water.visible = false;

    const car = buildCar(bodyType, { doors, stations: 80 });
    car.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; } });
    scene.add(car.root);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 3.4),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.name = "contact-shadow";
    scene.add(shadowPlane);

    // Post: bloom for headlights/taillights + emissive panels (eco disables).
    let composer: EffectComposer | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.55, 0.5, 0.85);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch { composer = null; }

    // Fog tint per stage from the plate's bottom edge.
    const tints = new Map<number, THREE.Color>();
    STAGE_IDS.forEach((s, i) => {
      void bottomTint(`/journey/${s}.jpg`).then((css) => tints.set(i, new THREE.Color(css)));
    });
    const fogTarget = new THREE.Color(FALLBACK_FOG[0]);

    let raf = 0;
    let smooth = live.current.target;
    let frames = 0;
    let ecoCheckedAt = performance.now();
    let eco = false;
    let shownStage = -1;
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
      const info = beatAt(p);
      const stage = info.stage;
      const si = stageIndex(stage);
      setActive((prev) => (prev === stage ? prev : stage));
      setBeat((prev) => (prev === info.beat ? prev : info.beat));
      const step = Math.min(3, Math.floor(info.local * 4));
      setBeatStep((prev) => (prev === step ? prev : step));

      if (si !== shownStage) {
        shownStage = si;
        scenery.zones.forEach((zone, id) => { zone.visible = id === stage; });
        if (bridgeZone) bridgeZone.visible = false;
        if (hillsZone) hillsZone.visible = false;
        if (deliveryZone) deliveryZone.visible = false;
        if (roadObj) roadObj.visible = stage !== "sea";
        scenery.water.visible = stage === "sea";
        scenery.ground.visible = stage !== "sea"; // at sea the water plane runs to the horizon
        scenery.group.traverse((o) => { if (o.name === "city-lights") o.visible = false; });
      }

      // Fog + ground ease toward the plate's bottom tint (hides the seam).
      fogTarget.copy(tints.get(si) ?? new THREE.Color(FALLBACK_FOG[si]));
      scene.fog?.color.lerp(fogTarget, 0.04);
      (scenery.ground.material as THREE.MeshBasicMaterial).color.copy(scene.fog!.color);
      rim.color.set(SKY[si]);

      // Backdrop parallax: ±2.5% drift across the stage segment.
      const segLocal = p * STAGE_IDS.length - si;
      const drift = `${((segLocal - 0.5) * -2.5).toFixed(3)}%`;
      if (bgFrontRef.current) bgFrontRef.current.style.transform = `scale(1.08) translateX(${drift})`;
      if (bgBackRef.current) bgBackRef.current.style.transform = `scale(1.08) translateX(${drift})`;

      scenery.ship.position.y = Math.sin(time * 0.8) * 0.18;
      scenery.ship.rotation.z = Math.sin(time * 0.6) * 0.012;
      if (!eco && scenery.water.visible) {
        scenery.waterMaterial.uniforms.uTime.value = time;
        (scenery.waterMaterial.uniforms.uFogColor.value as THREE.Color).copy(scene.fog!.color);
      }

      curve.getPointAt(Math.min(0.999, p), carPos);
      const tangent = curve.getTangentAt(Math.min(0.999, p));
      let yaw = Math.atan2(tangent.x, tangent.z);
      if (stage === "sea") {
        deckPos.setFromMatrixPosition(scenery.ship.matrixWorld);
        deckPos.y = scenery.shipDeckY + scenery.ship.position.y;
        const w = Math.min(1, Math.min(segLocal, 1 - segLocal) * 3);
        carPos.lerp(deckPos, w);
        yaw = scenery.ship.rotation.y + Math.PI;
      }
      car.root.position.copy(carPos);
      car.root.rotation.set(0, yaw, 0);
      shadowPlane.position.set(carPos.x, carPos.y + 0.04, carPos.z);
      shadowPlane.rotation.z = -yaw;

      sun.position.set(carPos.x + 16, carPos.y + 24, carPos.z + 9);
      sun.target.position.copy(carPos);
      rim.position.set(carPos.x - tangent.x * 9, carPos.y + 5.5, carPos.z - tangent.z * 9);

      const orbit = stage === "sea" ? Math.sin(time * 0.35) * 3.2 : 0;
      tmp.copy(tangent).multiplyScalar(camera.aspect < 0.8 ? -17 : -10.5);
      // Gentle camera roll on the sea beat; static otherwise (car stays put, no added motion controls).
      const sway = stage === "sea" ? Math.sin(time * 0.8) * 0.12 : 0;
      camera.position.set(carPos.x + tmp.x + orbit, carPos.y + 4.4 + sway, carPos.z + tmp.z);
      camera.lookAt(carPos.x + tangent.x * 9, carPos.y + 1.1, carPos.z + tangent.z * 9);

      frames++;
      if (!eco && performance.now() - ecoCheckedAt > 2000) {
        const fps = frames / ((performance.now() - ecoCheckedAt) / 1000);
        if (fps < 40) {
          eco = true;
          host.dataset.eco = "1";
          renderer.setPixelRatio(1);
          composer = null;
          scenery.water.material = new THREE.MeshStandardMaterial({ color: "#12303f", roughness: 0.85 });
          if (scene.fog && "far" in scene.fog) scene.fog.far = 80;
        }
        frames = 0;
        ecoCheckedAt = performance.now();
      }
      if (composer && !eco) composer.render();
      else renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      composer?.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      scenery.dispose();
      car.dispose();
      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
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
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{STAGE_CONTENT[s].what[lang]}</p>
              <p className="mt-2 text-xs text-zinc-400">{CONTENT_LABELS.typical[lang]}: {STAGE_CONTENT[s].typical[lang]}</p>
              {s === "inspection" && <p className="mt-1 text-xs text-zinc-400">{t.ready}</p>}
              {s === "customs" && <p className="mt-1 text-xs text-zinc-400">{t.cleared}</p>}
            </div>
          </article>
        ))}
        <p className="text-sm text-zinc-400 sm:col-span-2 lg:col-span-3">{TOTAL_TIME[lang]}</p>
      </div>
    );
  }

  const activeIdx = stageIndex(active);
  const currentIdx = currentStage ? stageIndex(currentStage) : -1;
  const content = STAGE_CONTENT[active];
  const showInfo = !compact && beat === 1;
  const showProof = !compact && beat === 2 && (active === "inspection" || active === "port_busan" || active === "vladivostok" || active === "customs");

  return (
    <div ref={outerRef} data-journey-outer className="relative w-full" style={{ height: compact ? undefined : mobile ? "1000vh" : "1400vh" }}>
      <div className={compact ? "relative h-[70vh] min-h-[420px] w-full overflow-hidden" : "sticky top-0 h-[100svh] w-full overflow-hidden"}>
        {/* Photo plate = hero of the frame; crossfade 0.6s, parallax via refs */}
        <div className="absolute inset-0 overflow-hidden bg-[#14171d]">
          {prevPlate && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={bgBackRef} src={`/journey/${prevPlate}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover will-change-transform" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={plate} ref={bgFrontRef} src={`/journey/${plate}.jpg`} alt="" className="absolute inset-0 h-full w-full animate-[journeyPlateIn_600ms_ease-out] object-cover will-change-transform" />
          <style>{`@keyframes journeyPlateIn{from{opacity:0}to{opacity:1}}`}</style>
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        </div>
        <div ref={hostRef} className="absolute inset-0" data-testid="journey-canvas-host" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">{activeIdx + 1} / 7</p>
          <h2 className="mt-1 text-2xl font-semibold text-white sm:text-4xl">{STAGE_LABELS[active][lang]}</h2>
          {currentStage === active && (
            <p className="mt-2 inline-flex animate-pulse items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-zinc-950">● {t.here}</p>
          )}
          {active === "inspection" && <p className="mt-2 text-sm text-emerald-300">{t.ready}</p>}
          {active === "customs" && (
            <p className="mt-3 inline-block -rotate-6 rounded border-2 border-emerald-300 px-3 py-1 text-lg font-bold uppercase tracking-widest text-emerald-300">{t.cleared}</p>
          )}
        </div>

        {!compact && (
          <aside className={`absolute left-4 top-20 w-[320px] max-w-[78vw] rounded-2xl border border-white/15 bg-black/45 p-4 text-zinc-100 shadow-xl backdrop-blur-md transition-all duration-500 sm:left-8 sm:top-1/2 sm:-translate-y-1/2 ${showInfo ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`} aria-hidden={!showInfo}>
            <dl className="space-y-3 text-sm leading-relaxed">
              {(["what", "docs", "owner", "clientSees", "typical"] as const).map((field) => (
                <div key={field}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">{CONTENT_LABELS[field][lang]}</dt>
                  <dd className="mt-0.5 text-zinc-100">{content[field][lang]}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}

        {!compact && (
          <div className={`absolute bottom-24 right-4 w-[330px] max-w-[80vw] rounded-2xl border border-white/15 bg-black/45 p-3 text-zinc-100 backdrop-blur-md transition-all duration-500 sm:bottom-8 sm:right-8 ${showProof ? "pointer-events-auto opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`} aria-hidden={!showProof}>
            {active === "inspection" && (
              <div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={n} src={`/journey/proof/inspection-${n}.jpg`} alt="" className="h-14 w-full rounded object-cover" loading="lazy" />
                  ))}
                </div>
                {reportSummary && (
                  <p className="mt-2 text-xs text-zinc-200">{reportSummary.findings} {t.findings} · {reportSummary.confirmed} {t.confirmed}</p>
                )}
              </div>
            )}
            {(active === "port_busan" || active === "vladivostok") && (
              <p className="flex items-center gap-2 text-sm"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/90 text-sm font-bold text-zinc-950">✓</span>{t.photoFix}</p>
            )}
            {active === "customs" && (
              <ul className="space-y-2 text-sm">
                {[t.doc1, t.doc2, t.doc3].map((label, i) => (
                  <li key={label} className={`flex items-center gap-2 transition-opacity duration-500 ${beatStep > i ? "opacity-100" : "opacity-30"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${beatStep > i ? "bg-emerald-400 text-zinc-950" : "bg-zinc-600 text-zinc-200"}`}>{beatStep > i ? "✓" : i + 1}</span>
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!compact && (
          <nav className="absolute right-3 top-3 rounded-xl bg-black/40 p-2 backdrop-blur-md sm:right-5 sm:top-5" aria-label="Journey stages">
            <ol className="flex flex-col gap-0.5">
              {STAGE_IDS.map((s, i) => (
                <li key={s}>
                  <button type="button" onClick={() => scrollToStage(s)} className={`block w-full rounded px-2 py-1 text-right text-[11px] leading-tight transition-colors ${i === activeIdx ? "bg-amber-300 font-semibold text-zinc-950" : currentIdx >= 0 && i < currentIdx ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-200 hover:text-white"}`}>
                    {currentIdx >= 0 && i < currentIdx ? `${t.done}: ` : ""}{STAGE_LABELS[s][lang]}
                  </button>
                  {i === activeIdx && (
                    <span className="flex justify-end gap-1 px-2 pb-1 pt-0.5" aria-hidden>
                      {[0, 1, 2].map((b) => (
                        <span key={b} className={`h-1.5 w-1.5 rounded-full ${b <= beat ? "bg-amber-300" : "bg-zinc-500/70"}`} />
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-1 max-w-[170px] px-2 pb-1 text-right text-[10px] leading-snug text-zinc-300">{TOTAL_TIME[lang]}</p>
          </nav>
        )}
      </div>
    </div>
  );
}

