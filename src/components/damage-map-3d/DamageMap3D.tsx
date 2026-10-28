// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: 3D damage map: studio scene, panels coloured by paint gauge / findings, click → panel, explode view
// @created: 2026-10-28
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import type { Finding, PaintReading } from "@/lib/schema";
import type { BodyType } from "./bodyTemplates";
import { BASE_PAINT, buildCar, type CarModel } from "./buildCar";
import { allPanelVisuals, COLORS, panelLabel, type PanelId, type PanelVisual } from "./panels";

export interface DamageMap3DProps {
  bodyType: BodyType;
  doors?: 3 | 5;
  readings: PaintReading[];
  findings: Finding[];
  selected: PanelId | null;
  onSelect: (id: PanelId | null) => void;
  lang?: "en" | "ru";
  className?: string;
}

const T = {
  ru: { gauge: "Толщиномер", explode: "Разобрать", assemble: "Собрать", reset: "Сброс вида", hint: "тяни — вращать · щипок — зум · клик — детали", legend: ["≤150 мкм завод", "151–220 перекрас", ">220 шпатлёвка", "не подтверждено"], webgl: "3D недоступно в этом браузере — показана схема панелей." },
  en: { gauge: "Paint gauge", explode: "Explode", assemble: "Assemble", reset: "Reset view", hint: "drag to rotate · pinch to zoom · click for details", legend: ["≤150 µm factory", "151–220 repaint", ">220 filler", "unconfirmed"], webgl: "3D is not available in this browser — showing the panel diagram." },
};

function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function DamageMap3D(props: DamageMap3DProps) {
  const { bodyType, doors, readings, findings, selected, onSelect, lang = "ru", className } = props;
  const t = T[lang];
  const hostRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [gaugeOn, setGaugeOn] = useState(true);
  const [exploded, setExploded] = useState(false);

  const visuals = useMemo(() => allPanelVisuals(readings, findings), [readings, findings]);
  // mutable state shared with the render loop
  const live = useRef({
    model: null as CarModel | null,
    visuals: visuals,
    selected: selected,
    gaugeOn: true,
    explodeTarget: 0,
    onSelect,
    fly: null as null | ((p: PanelId | null) => void),
  });
  live.current.visuals = visuals;
  live.current.selected = selected;
  live.current.gaugeOn = gaugeOn;
  live.current.explodeTarget = exploded ? 1 : 0;
  live.current.onSelect = onSelect;

  useEffect(() => {
    const noFlag = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("no3d");
    setWebgl(!noFlag && hasWebGL2());
  }, []);

  useEffect(() => {
    if (!webgl || !hostRef.current || !tagsRef.current) return;
    const host = hostRef.current;
    const tagsEl = tagsRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const L = live.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07080a");
    scene.fog = new THREE.Fog("#07080a", 10, 24);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.45;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.45;
    controls.addEventListener("start", () => (controls.autoRotate = false));

    const key = new THREE.SpotLight("#ffd9a8", 110, 22, Math.PI / 5, 0.6, 1.5);
    key.position.set(4.5, 6, 4);
    const rim = new THREE.SpotLight("#9fc2ff", 80, 22, Math.PI / 5, 0.7, 1.5);
    rim.position.set(-5, 4.5, -4.5);
    const hemi = new THREE.HemisphereLight("#c3cbd8", "#050608", 0.35);
    scene.add(key, rim, hemi);

    const floor = new Reflector(new THREE.CircleGeometry(14, 64), { textureWidth: 1024, textureHeight: 1024, color: 0x8a8f99, clipBias: 0.003 });
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const veilMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { c: { value: new THREE.Color("#07080a") } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform vec3 c;varying vec2 vUv;void main(){float d=distance(vUv,vec2(.5))*2.;gl_FragColor=vec4(c,mix(.7,1.,smoothstep(.12,.75,d)));}",
    });
    const veil = new THREE.Mesh(new THREE.CircleGeometry(14, 64), veilMat);
    veil.rotation.x = -Math.PI / 2;
    veil.position.y = 0.002;
    scene.add(veil);
    const arcGeo = new THREE.TorusGeometry(7.5, 0.012, 8, 200, Math.PI * 0.9);
    const arcMat = new THREE.MeshBasicMaterial({ color: "#e2b877" });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.set(0, -4.2, -6.5);
    arc.rotation.z = Math.PI * 0.05;
    scene.add(arc);

    const model = buildCar(bodyType, { doors });
    scene.add(model.root);
    L.model = model;
    const pickables: THREE.Object3D[] = [];
    model.panels.forEach((part) => pickables.push(part.object.children[0]));

    /* tags */
    const tags: { el: HTMLButtonElement; panel: PanelId }[] = [];
    const rebuildTags = () => {
      tagsEl.innerHTML = "";
      tags.length = 0;
      for (const vis of L.visuals) {
        if (!vis.tag || !model.panels.has(vis.panel)) continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dm3d-tag";
        b.style.color = vis.color;
        b.setAttribute("aria-label", `${panelLabel(vis.panel, lang)}: ${vis.tag}`);
        b.innerHTML = `<span class="dm3d-tag-b"></span><span class="dm3d-tag-s"></span><span class="dm3d-tag-d"></span>`;
        (b.firstChild as HTMLElement).textContent = vis.tag;
        b.onclick = () => L.onSelect(vis.panel);
        tagsEl.appendChild(b);
        tags.push({ el: b, panel: vis.panel });
      }
    };
    rebuildTags();
    let lastVisuals = L.visuals;

    /* camera moves */
    // camera flights orbit around the target (spherical lerp) so they never pass through the car
    let fly: null | { t: number; fromS: THREE.Spherical; toS: THREE.Spherical; fromT: THREE.Vector3; toT: THREE.Vector3 } = null;
    let instant = true;
    const flyTo = (toP: THREE.Vector3, toT: THREE.Vector3) => {
      const fromS = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const toS = new THREE.Spherical().setFromVector3(toP.clone().sub(toT));
      let d = toS.theta - fromS.theta;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      toS.theta = fromS.theta + d;
      fly = { t: instant ? 1 : 0, fromS, toS, fromT: controls.target.clone(), toT };
      instant = false;
    };
    const sph = new THREE.Spherical();
    const homeP = new THREE.Vector3(6.4, 2.5, 5.4);
    const homeT = new THREE.Vector3(0, 0.6, 0);
    camera.position.copy(homeP);
    controls.target.copy(homeT);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __dm3d?: unknown }).__dm3d = { camera, controls, model, renderer };
    L.fly = (id) => {
      if (!id) {
        instant = false;
        return flyTo(homeP.clone(), homeT.clone());
      }
      const part = model.panels.get(id);
      if (!part) return;
      controls.autoRotate = false;
      const c = part.center.clone().add(part.explode.clone().multiplyScalar(explodeT));
      const dir = part.normal.clone();
      dir.y = Math.max(dir.y, 0) + 0.35;
      dir.normalize();
      const tgt = new THREE.Vector3(c.x * 0.35, 0.6 + Math.max(0, c.y - 0.8) * 0.5, c.z * 0.45);
      const to = tgt.clone().add(dir.multiplyScalar(7));
      to.y = Math.max(to.y, 1.4);
      flyTo(to, tgt);
    };

    /* picking */
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) L.onSelect(hit.object.userData.partId as PanelId);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    /* resize */
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(1, h);
      camera.fov = w < 600 ? 42 : 32;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    /* paint */
    const base = new THREE.Color(BASE_PAINT);
    const tmpC = new THREE.Color();
    const applyPaint = (time: number) => {
      const { visuals: vis, selected: sel, gaugeOn: on } = L;
      for (const v of vis) {
        const part = model.panels.get(v.panel);
        if (!part) continue;
        const mesh = part.object.children[0] as THREE.Mesh;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        tmpC.set(v.color);
        mat.color.copy(base).lerp(tmpC, on ? v.strength : 0);
        const isSel = sel === v.panel;
        const pulse = isSel ? 0.22 + 0.12 * Math.sin(time * 4) : on && v.findings.length ? 0.06 : 0;
        mat.emissive.copy(tmpC).multiplyScalar(reduce && isSel ? 0.25 : pulse);
        if (part.seams) {
          const sm = part.seams.material as THREE.LineBasicMaterial;
          sm.color.set(isSel ? v.color : "#030405");
          sm.opacity = isSel ? 1 : 0.9;
        }
      }
    };

    /* loop */
    let explodeT = 0;
    let lastSel: PanelId | null = null;
    let lastExplode = 0;
    const tmpV = new THREE.Vector3(), camDir = new THREE.Vector3();
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const clock = new THREE.Clock();
    let time = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      time += dt;
      const target = L.explodeTarget;
      explodeT += (target - explodeT) * Math.min(1, dt * (reduce ? 60 : 3.4));
      for (const part of model.parts) part.object.position.copy(part.explode).multiplyScalar(explodeT);
      if (target !== lastExplode) {
        lastExplode = target;
        if (!L.selected) flyTo(target ? new THREE.Vector3(8.4, 4.6, 7.2) : homeP.clone(), target ? new THREE.Vector3(0, 0.9, 0) : homeT.clone());
      }
      if (L.selected !== lastSel) {
        lastSel = L.selected;
        L.fly?.(lastSel);
      }
      if (L.visuals !== lastVisuals) {
        lastVisuals = L.visuals;
        rebuildTags();
      }
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / (reduce ? 0.01 : 1.1));
        const k = ease(fly.t);
        controls.target.lerpVectors(fly.fromT, fly.toT, k);
        sph.set(
          fly.fromS.radius + (fly.toS.radius - fly.fromS.radius) * k,
          fly.fromS.phi + (fly.toS.phi - fly.fromS.phi) * k,
          fly.fromS.theta + (fly.toS.theta - fly.fromS.theta) * k,
        );
        camera.position.setFromSpherical(sph).add(controls.target);
        if (fly.t >= 1) fly = null;
      }
      instant = false;
      controls.update();
      applyPaint(time);
      renderer.render(scene, camera);
      // tags
      const w = host.clientWidth, h = host.clientHeight;
      for (const tg of tags) {
        const part = model.panels.get(tg.panel)!;
        tmpV.copy(part.center).add(part.object.position);
        camDir.copy(camera.position).sub(tmpV).normalize();
        const facing = camDir.dot(part.normal) > 0.05 || explodeT > 0.5;
        const pr = tmpV.clone().project(camera);
        tg.el.hidden = !facing || pr.z > 1;
        tg.el.style.left = `${(pr.x * 0.5 + 0.5) * w}px`;
        tg.el.style.top = `${(-pr.y * 0.5 + 0.5) * h}px`;
      }
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      model.dispose();
      floor.geometry.dispose();
      floor.dispose();
      veil.geometry.dispose();
      veilMat.dispose();
      arcGeo.dispose();
      arcMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      tagsEl.innerHTML = "";
      L.model = null;
      L.fly = null;
    };
  }, [webgl, bodyType, doors, lang]);

  if (webgl === false) return <PanelFallback visuals={visuals} selected={selected} onSelect={onSelect} lang={lang} note={t.webgl} className={className} />;

  return (
    <div className={`dm3d ${className ?? ""}`} ref={hostRef} aria-label={lang === "ru" ? "3D-карта кузова" : "3D body map"}>
      <style>{DM3D_CSS}</style>
      <div ref={tagsRef} className="dm3d-tags" />
      <div className="dm3d-hint">{t.hint}</div>
      <div className="dm3d-legend">
        {[COLORS.factory, COLORS.repaint, COLORS.putty, COLORS.unconfirmed].map((c, i) => (
          <span key={c}>
            <i style={{ background: c }} />
            {t.legend[i]}
          </span>
        ))}
      </div>
      <div className="dm3d-ctrls">
        <button type="button" className="dm3d-ctrl" aria-pressed={gaugeOn} onClick={() => setGaugeOn((v) => !v)}>
          {t.gauge}
        </button>
        <button type="button" className="dm3d-ctrl" aria-pressed={exploded} onClick={() => setExploded((v) => !v)}>
          {exploded ? t.assemble : t.explode}
        </button>
        <button
          type="button"
          className="dm3d-ctrl"
          onClick={() => {
            setExploded(false);
            onSelect(null);
            live.current.fly?.(null);
          }}
        >
          {t.reset}
        </button>
      </div>
      {webgl === null && <div className="dm3d-loading">…</div>}
    </div>
  );
}

function PanelFallback({ visuals, selected, onSelect, lang, note, className }: { visuals: PanelVisual[]; selected: PanelId | null; onSelect: (id: PanelId | null) => void; lang: "en" | "ru"; note: string; className?: string }) {
  return (
    <div className={`dm3d dm3d-fallback ${className ?? ""}`}>
      <style>{DM3D_CSS}</style>
      <p className="dm3d-note">{note}</p>
      <div className="dm3d-grid">
        {visuals.map((v) => (
          <button key={v.panel} type="button" aria-pressed={selected === v.panel} onClick={() => onSelect(v.panel)} style={{ borderColor: v.color }}>
            <span style={{ background: v.color }} />
            {panelLabel(v.panel, lang)}
            {v.microns !== undefined ? ` · ${v.microns}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

const DM3D_CSS = `
.dm3d{position:relative;overflow:hidden;border-radius:14px;background:#07080a;border:1px solid #242a33;height:min(78vh,760px);min-height:420px}
@media (max-width:980px){.dm3d{height:68vh;min-height:380px}}
.dm3d-tags{position:absolute;inset:0;pointer-events:none}
.dm3d-tag{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;border:0;background:none;padding:0}
.dm3d-tag[hidden]{display:none}
.dm3d-tag-b{font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;padding:3px 7px;border-radius:6px;background:rgba(10,12,15,.88);border:1px solid currentColor;white-space:nowrap}
.dm3d-tag-s{width:1px;height:16px;background:currentColor;opacity:.8}
.dm3d-tag-d{width:7px;height:7px;border-radius:50%;background:currentColor}
.dm3d-hint{position:absolute;right:16px;top:16px;font:11px ui-monospace,Menlo,monospace;color:#5d6672}
.dm3d-legend{position:absolute;left:16px;bottom:16px;display:flex;flex-direction:column;gap:4px;font:11px ui-monospace,Menlo,monospace;color:#8b94a1;background:rgba(7,8,10,.6);padding:8px 10px;border-radius:8px}
.dm3d-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.dm3d-ctrls{position:absolute;right:14px;bottom:14px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dm3d-ctrl{background:rgba(17,20,26,.82);backdrop-filter:blur(6px);border:1px solid #242a33;border-radius:8px;padding:7px 11px;font-size:12px;color:#e8ebee;cursor:pointer}
.dm3d-ctrl[aria-pressed="true"]{border-color:#c9a46a;color:#c9a46a}
.dm3d-ctrl:focus-visible,.dm3d-tag:focus-visible{outline:2px solid #c9a46a;outline-offset:2px}
.dm3d-loading{position:absolute;inset:0;display:grid;place-items:center;color:#5d6672}
@media (max-width:600px){.dm3d-hint{display:none}.dm3d-legend{bottom:62px;right:14px;flex-direction:row;flex-wrap:wrap;gap:4px 10px}.dm3d-ctrls{left:14px;justify-content:flex-start}}
.dm3d-fallback{height:auto;min-height:0;padding:16px}
.dm3d-note{color:#8b94a1;font-size:13px;margin:0 0 12px}
.dm3d-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
.dm3d-grid button{display:flex;align-items:center;gap:8px;text-align:left;background:#11141a;border:1px solid;border-radius:8px;padding:8px 10px;color:#e8ebee;font-size:12px;cursor:pointer}
.dm3d-grid button span{width:9px;height:9px;border-radius:2px;flex:none}
`;
