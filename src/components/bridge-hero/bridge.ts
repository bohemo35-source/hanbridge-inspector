// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Hero bridge scene (plain three.js): procedural cable-stayed bridge from 88 shards in 2 InstancedMesh draw calls; idle sway and travelling sodium light; click to take it apart into 6 groups (arc + spin, staggered by index); labels projected each frame; bloom on desktop only
// @created: 2026-11-02
// Geometry generator buildBridge(): written by Meta Muse Wonder (muse-wonder-1.0, raw answer in docs/bridge/wonder-bridge.json, request in scripts/bridge/wonder-bridge.mjs; Wonder asked for 84 shards and 6 pylon blocks) and then changed by hand: 8 pylon blocks per pylon (BLOCK = 0.36, block length 0.96 x BLOCK, so 0.0144 gaps; the lowest block sits on the deck, not 0.18 above it), 88 shards in total, cable tops at y = TOP - 0.04 = 2.84, cable anchors on the deck top (y = 0) and spread across the deck width (z = +-0.07). Deck, glow strips, cable offsets and the 6 group rules are Wonder's.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const SODIUM = 0xeea65a;
const INK = 0x060708;
const DEG = Math.PI / 180;
const FOV = 28;
const LOOK_Y = 1.2;
const HALF_W = 3.5; // world half-width the camera must keep in view
const HALF_H = 2.6;

type Vec3 = [number, number, number];
export type Shard = { p: Vec3; a: Vec3; L: number; t: number; glow: 0 | 1; g: number };
export type Projection = { x: number; y: number; visible: boolean };
export type BridgeOptions = {
  mobile: boolean;
  onGroupHover?(g: number | null): void;
  onGroupClick?(g: number): void;
  /** called when the bridge is taken apart / put back by a click on the canvas */
  onExplodedChange?(on: boolean): void;
  /** every frame, after render: the caller positions its HTML labels with project() */
  onFrame?(project: (g: number) => Projection | null): void;
};
export type BridgeHandle = { setExploded(on: boolean): void; project(g: number): Projection | null; dispose(): void };

/** Muse Wonder's generator (see header), with the fixes listed there */
export function buildBridge(): { shards: Shard[] } {
  const shards: Shard[] = [];
  const deck: Shard[] = [];
  for (let i = 0; i < 24; i++) {
    const x = -2.99 + i * 0.26;
    deck.push({ p: [x, -0.07, 0], a: [1, 0, 0], L: 0.26, t: 0.14, glow: 0, g: x < 0 ? 2 : 3 });
  }
  shards.push(...deck);
  for (const s of deck) shards.push({ p: [s.p[0], s.p[1] + 0.075, s.p[2]], a: [1, 0, 0], L: 0.24, t: 0.02, glow: 1, g: s.g });
  const PYLON_X = [-1.6, 1.6];
  const PYLON_G = [0, 5];
  const BLOCK = 0.36;
  const TOP = BLOCK * 8;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 8; i++) shards.push({ p: [PYLON_X[k], BLOCK * i + (BLOCK * 0.96) / 2, 0], a: [0, 1, 0], L: BLOCK * 0.96, t: 0.2, glow: 0, g: PYLON_G[k] }); // lowest block bottom = deck top (y = 0)
  }
  const OFFSETS = [-1.35, -1.1, -0.85, -0.6, -0.35, -0.1, 0.1, 0.35, 0.6, 0.85, 1.1, 1.35];
  const CABLE_G = [1, 4];
  for (let k = 0; k < 2; k++) {
    const xp = PYLON_X[k];
    for (let i = 0; i < OFFSETS.length; i++) {
      const xa = xp + OFFSETS[i];
      const za = i % 2 === 0 ? 0.07 : -0.07;
      const from: Vec3 = [xp, TOP - 0.04, 0];
      const to: Vec3 = [xa, 0, za];
      const d: Vec3 = [from[0] - to[0], from[1] - to[1], from[2] - to[2]];
      const L = Math.hypot(d[0], d[1], d[2]);
      shards.push({ p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], a: [d[0] / L, d[1] / L, d[2] / L], L, t: 0.03, glow: 0, g: CABLE_G[k] });
    }
  }
  return { shards };
}

/** seeded PRNG: the explosion is the same on every visit */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** six cluster centres on an ellipse around the bridge, counter-clockwise from the left: labels follow them */
function clusterCentres(): THREE.Vector3[] {
  const rx = 2.6;
  const ry = 1.9;
  return [0, 1, 2, 3, 4, 5].map((g) => {
    const a = Math.PI + (Math.PI * 2 * g) / 6;
    return new THREE.Vector3(rx * Math.cos(a), 0.9 + ry * Math.sin(a), g % 2 ? 0.5 : -0.5);
  });
}

export function createBridge(host: HTMLElement, opts: BridgeOptions): BridgeHandle {
  const { mobile } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(INK, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  canvas.style.cssText = "display:block;width:100%;height:100%;outline:none";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, 0.022);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xcfd8e0, 0x06070a, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.PointLight(SODIUM, 8, 24, 2);
  rim.position.set(-4, 2.5, -5);
  scene.add(rim);

  // minimal floor: a dotted horizon grid far below the bridge, and a few drifting motes
  const gridPts: number[] = [];
  for (let x = -9; x <= 9.001; x += 0.5) for (let z = -8; z <= 3.001; z += 0.5) gridPts.push(x, -1.9, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
  const gridMat = new THREE.PointsMaterial({ color: 0x8d949b, size: 0.03, transparent: true, opacity: 0.3, depthWrite: false });
  scene.add(new THREE.Points(gridGeo, gridMat));
  const moteGeo = new THREE.BufferGeometry();
  const motes: number[] = [];
  const rnd = mulberry32(11);
  for (let i = 0; i < 120; i++) motes.push((rnd() * 2 - 1) * 7, (rnd() * 2 - 1) * 1 + 1.5, (rnd() * 2 - 1) * 4);
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(motes, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xefe9df, size: 0.022, transparent: true, opacity: 0.35, depthWrite: false });
  const motePts = new THREE.Points(moteGeo, moteMat);
  scene.add(motePts);

  // 88 shards: 64 graphite bodies (glass) and 24 sodium edge strips (glow), one InstancedMesh each
  const { shards } = buildBridge();
  const glassShards = shards.filter((s) => !s.glow);
  const glowShards = shards.filter((s) => s.glow);
  const glassGroup = glassShards.map((s) => s.g);
  const glowGroup = glowShards.map((s) => s.g);
  const clusterCount = [0, 0, 0, 0, 0, 0];
  for (const s of shards) clusterCount[s.g]++;
  const centres = clusterCentres();

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b3036, roughness: 0.3, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.2,
    transmission: mobile ? 0 : 0.3, thickness: 0.6, ior: 1.45,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SODIUM).multiplyScalar(2.6), toneMapped: false, fog: false });
  const glass = new THREE.InstancedMesh(geo, glassMat, glassShards.length);
  const glow = new THREE.InstancedMesh(geo, glowMat, glowShards.length);
  for (const m of [glass, glow]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60); // instances leave the bridge when apart: raycast must still reach them
  }
  const root = new THREE.Group();
  root.add(glass, glow);
  scene.add(root);

  type Item = { mesh: THREE.InstancedMesh; idx: number; g: number; delay: number; hp: THREE.Vector3; hq: THREE.Quaternion; tp: THREE.Vector3; tq: THREE.Quaternion; s: THREE.Vector3 };
  const items: Item[] = [];
  const N = shards.length;
  let gi = 0;
  let li = 0;
  const offsetRnd = mulberry32(7);
  shards.forEach((s, i) => {
    const mesh = s.glow ? glow : glass;
    const idx = s.glow ? li++ : gi++;
    const hq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(...s.a).normalize());
    const radius = 0.3 + 0.06 * Math.sqrt(clusterCount[s.g]);
    const dir = new THREE.Vector3(offsetRnd() * 2 - 1, offsetRnd() * 2 - 1, offsetRnd() * 2 - 1).normalize();
    const tp = centres[s.g].clone().add(dir.multiplyScalar(radius * Math.cbrt(offsetRnd())));
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(offsetRnd() * Math.PI * 2, offsetRnd() * Math.PI * 2, offsetRnd() * Math.PI * 2));
    items.push({
      mesh, idx, g: s.g, delay: (0.32 * i) / N,
      hp: new THREE.Vector3(...s.p), hq, tp, tq, s: new THREE.Vector3(s.L, s.t, s.t),
    });
  });

  // post: bloom on desktop only (lights the sodium edges)
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let outputPass: OutputPass | null = null;
  const w0 = Math.max(1, host.clientWidth), h0 = Math.max(1, host.clientHeight);
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.6, 0.55, 0.62);
    composer.addPass(bloom);
    outputPass = new OutputPass();
    composer.addPass(outputPass);
  }

  let W = w0, H = h0;
  const fit = () => {
    const tanV = Math.tan((FOV * DEG) / 2);
    const d = Math.max(HALF_W / (tanV * camera.aspect), HALF_H / tanV);
    camera.position.set(0, LOOK_Y, d);
    camera.lookAt(0, LOOK_Y, 0);
  };
  const onResize = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    composer?.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    fit();
  };
  onResize();

  // ── state ──
  let exploded = false;
  let prog = 0; // 0 = assembled, 1 = apart (moves linearly, every shard eases from its own delay)
  let time = 0;
  let hoverG: number | null = null;
  let reported: number | null = null;
  let disposed = false;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const pulseCol = new THREE.Color();
  const ray = new THREE.Raycaster();

  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const layout = () => {
    for (const it of items) {
      const e = easeInOut(clamp((prog - it.delay) / 0.6));
      p.lerpVectors(it.hp, it.tp, e);
      p.y += Math.sin(e * Math.PI) * 0.7; // arc
      q.slerpQuaternions(it.hq, it.tq, e);
      sc.copy(it.s);
      m4.compose(p, q, sc);
      it.mesh.setMatrixAt(it.idx, m4);
    }
    glass.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
  };

  const applyHover = () => {
    for (const it of items) if (it.mesh === glass) glass.setColorAt(it.idx, pulseCol.setScalar(it.g === hoverG ? 2.4 : 1));
    if (glass.instanceColor) glass.instanceColor.needsUpdate = true;
  };
  // a sodium light runs along the deck; the group under the cursor glows
  const glowColors = () => {
    const pulseX = -3.1 + 6.2 * ((time * 0.07) % 1);
    for (let i = 0; i < glowShards.length; i++) {
      const x = glowShards[i].p[0];
      const pulse = Math.exp(-((x - pulseX) * (x - pulseX)) / 0.25);
      const b = (0.25 + 0.85 * pulse) * (hoverG !== null && glowGroup[i] === hoverG ? 1.5 : 1);
      glow.setColorAt(i, pulseCol.setScalar(b));
    }
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
  };

  const project = (g: number): Projection | null => {
    const c = centres[g];
    if (!c) return null;
    const v = new THREE.Vector3(c.x, c.y + 0.55, c.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 };
  };

  const loop = (now: number) => {
    raf = 0;
    if (disposed || !visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    prog = clamp(prog + (exploded ? 1 : -1) * dt * 0.85);
    root.rotation.y = Math.sin(time * 0.13) * 0.42 * (1 - prog); // slow sway; still once apart so the groups stay put
    motePts.rotation.y = time * 0.012;
    layout();
    glowColors();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    opts.onFrame?.(project);
    raf = requestAnimationFrame(loop);
  };

  const pick = (clientX: number, clientY: number): number | null => {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([glass, glow], false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return hit.object === glass ? glassGroup[hit.instanceId] : glowGroup[hit.instanceId];
  };

  const setHover = (g: number | null) => {
    if (g === hoverG) return;
    hoverG = g;
    applyHover();
  };
  const onMove = (e: PointerEvent) => {
    const g = pick(e.clientX, e.clientY);
    canvas.style.cursor = g === null ? "default" : "pointer";
    setHover(g);
    const report = exploded ? g : null;
    if (report !== reported) { reported = report; opts.onGroupHover?.(report); }
  };
  const onLeave = () => {
    canvas.style.cursor = "default";
    setHover(null);
    if (reported !== null) { reported = null; opts.onGroupHover?.(null); }
  };
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return; // a drag, not a click
    if (!exploded) { api.setExploded(true); return; }
    const g = pick(e.clientX, e.clientY);
    if (g === null) { api.setExploded(false); return; } // click on empty space: put it back together
    opts.onGroupClick?.(g); // click on a part: go to the group's section
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  const ro = new ResizeObserver(() => onResize());
  ro.observe(host);
  const io = new IntersectionObserver((es) => {
    visible = es[0]?.isIntersecting ?? true;
    if (visible && !raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: "200px" });
  io.observe(host);
  raf = requestAnimationFrame(loop);

  const api: BridgeHandle = {
    setExploded(on: boolean) {
      if (on === exploded) return;
      exploded = on;
      if (!on) { setHover(null); }
      reported = null;
      opts.onExplodedChange?.(on);
    },
    project,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      geo.dispose();
      glassMat.dispose();
      glowMat.dispose();
      gridGeo.dispose(); gridMat.dispose();
      moteGeo.dispose(); moteMat.dispose();
      glass.dispose(); glow.dispose();
      bloom?.dispose();
      outputPass?.dispose();
      composer?.dispose();
      room.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  return api;
}
