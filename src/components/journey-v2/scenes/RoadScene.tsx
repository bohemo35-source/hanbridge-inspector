// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 5: top-down long road, terrain changes, route line draws ahead, ends as a simple map
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (TZ-13: Muse Image nadir aerial plates with crossfades, car top-down on the photo road, glowing dark route map)
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { vibrate } from "../useCar";
import { face, lerp, seg } from "./helpers";
import { blobShadowTexture } from "./PlateScene";

const CITIES: Array<{ name: string; x: number; z: number }> = [
  { name: "Vladivostok", x: 52, z: 66 }, { name: "Novosibirsk", x: 8, z: -6 },
  { name: "Almaty", x: -34, z: 30 }, { name: "Tashkent", x: -58, z: 42 }, { name: "Moscow ~9 000 km · 12–14 days", x: -52, z: -58 },
];
/**
 * Nadir aerial plates (Muse Image, scripts/journey-v2/generate-aerials.mjs). Road centre line measured on each image
 * (normalised: top edge point x, bottom edge point x) and its perpendicular width in source pixels.
 */
const AERIALS: Array<{ src: string; w: number; h: number; top: number; bottom: number; roadPx: number }> = [
  { src: "/journey-v2/aerial-coast.jpg", w: 1920, h: 1280, top: 0.927, bottom: 0.069, roadPx: 103 },
  { src: "/journey-v2/aerial-forest.jpg", w: 1920, h: 1280, top: 0.879, bottom: 0.156, roadPx: 91 },
  { src: "/journey-v2/aerial-steppe.jpg", w: 1920, h: 1280, top: 0.857, bottom: 0.186, roadPx: 60 },
  { src: "/journey-v2/aerial-suburb.jpg", w: 1600, h: 1600, top: 0.944, bottom: 0.068, roadPx: 162 },
];
const ROAD_M = 5.5; // two-lane road width in metres: sets the car's scale on each photo
const FADE = 0.2; // share of a zone used for the crossfade into the next photo
const DRIVE_FOV = 30, MAP_FOV = 46;

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 160;
  const g = c.getContext("2d")!;
  g.font = "600 56px system-ui"; g.textAlign = "center";
  g.shadowColor = "rgba(255,196,90,0.85)"; g.shadowBlur = 22; g.fillStyle = "#fff4dc"; g.fillText(text, 512, 98);
  g.shadowBlur = 0; g.fillText(text, 512, 98);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.set(28, 4.4, 1);
  return s;
}
function mapTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(512, 512, 60, 512, 512, 720);
  r.addColorStop(0, "#152231"); r.addColorStop(1, "#05080d");
  g.fillStyle = r; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = "rgba(120,170,220,0.08)"; g.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
  // faint landmass speckle so the map is not an empty void
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(150,190,230,${Math.random() * 0.05})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const buildRoad: SceneBuilder = ({ scene, camera, car, tex, mobile, setHdri, viewport }) => {
  scene.background = new THREE.Color(0x05080d);
  setHdri("/hdri/dusseldorf_bridge_1k.hdr");
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xdfe8f5, 0x3a3428, 0.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2); sun.position.set(-18, 40, -10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -8; sun.shadow.camera.right = sun.shadow.camera.top = 8;
  scene.add(sun, sun.target);
  scene.add(camera);

  // photo stack, locked to the camera: each plane shows a moving window of its aerial along the road
  const plates = AERIALS.map((a, i) => {
    const t = tex(a.src); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    m.renderOrder = -20 + i; camera.add(m);
    const dir = new THREE.Vector2((a.top - a.bottom) * a.w, -a.h); // image px, bottom -> top (y down)
    return { a, m, t, dir: dir.normalize() };
  });
  // shadow catcher + contact blob + gold route trail on the road behind the car
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.45, depthWrite: false }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.01; catcher.receiveShadow = true; catcher.renderOrder = 1; scene.add(catcher);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.9), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 2; scene.add(blob);
  const trailGeo = new THREE.PlaneGeometry(1, 0.32); trailGeo.translate(-0.5, 0, 0); // grows backwards from the car
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0xffc24b, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.rotation.x = -Math.PI / 2; trail.position.y = 0.03; trail.renderOrder = 3; scene.add(trail);
  if (car) car.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });

  // final map: dark plate, glowing route tubes (Vladivostok -> Novosibirsk -> Moscow, branch to Almaty -> Tashkent), city labels
  const mapGroup = new THREE.Group(); mapGroup.visible = false; scene.add(mapGroup);
  const mapMat = new THREE.MeshBasicMaterial({ map: mapTexture(), transparent: true, opacity: 0 });
  const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mapMat); mapPlane.rotation.x = -Math.PI / 2; mapPlane.position.y = -0.3; mapGroup.add(mapPlane);
  const P = (name: string) => { const c = CITIES.find((x) => x.name.startsWith(name))!; return new THREE.Vector3(c.x, 0.4, c.z); };
  const arc = (a: THREE.Vector3, b: THREE.Vector3) => { const m = a.clone().lerp(b, 0.5); const n = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(a.distanceTo(b) * 0.08); return m.add(n); };
  const legs = [["Vladivostok", "Novosibirsk"], ["Novosibirsk", "Moscow"], ["Novosibirsk", "Almaty"], ["Almaty", "Tashkent"]].map(([a, b]) => new THREE.QuadraticBezierCurve3(P(a), arc(P(a), P(b)), P(b)));
  const routes = legs.map((curve) => {
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.42, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }));
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 1.3, 8), new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    mapGroup.add(halo, core);
    return [core, halo];
  });
  const dc = document.createElement("canvas"); dc.width = dc.height = 64;
  const dg = dc.getContext("2d")!; const rg = dg.createRadialGradient(32, 32, 1, 32, 32, 31);
  rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.25, "rgba(255,255,255,0.6)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  dg.fillStyle = rg; dg.fillRect(0, 0, 64, 64);
  const dotTex = new THREE.CanvasTexture(dc);
  // label anchors beside the dots, away from the route lines
  const LABEL_OFF: Record<string, [number, number]> = { Vladivostok: [-17, 1], Novosibirsk: [19, 1], Almaty: [15, 3], Tashkent: [-8, 6], Moscow: [31, -1] };
  const dots = CITIES.map((c) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(7); s.position.set(c.x, 0.8, c.z); mapGroup.add(s); return s; });
  const labels = CITIES.map((c) => { const s = labelSprite(c.name); const off = LABEL_OFF[c.name.split(" ")[0]] ?? [0, 6]; s.position.set(c.x + off[0], 2, c.z + off[1]); mapGroup.add(s); return s; });

  const heading = new THREE.Vector2();
  return {
    triangles: 0,
    update: (p, t) => {
      const drive = seg(p, 0, 0.78), map = seg(p, 0.8, 0.96);
      const { w: W, h: H } = viewport();
      const aspect = W / H;
      const zones = drive * AERIALS.length;
      let hWorld = 0, wsum = 0;
      heading.set(0, 0);
      plates.forEach((pl, i) => {
        const q = zones - i; // zone-local progress; crossfade in over [-FADE, 0]
        const a = i === 0 ? 1 : THREE.MathUtils.smoothstep(q, -FADE, 0);
        const alive = q > -FADE && q < 1 + FADE;
        pl.m.visible = alive;
        if (!alive) return;
        // window: largest viewport-aspect rect inside the image, zoomed so the road reads ~11% of screen width
        const coverW = Math.min(pl.a.w, pl.a.h * aspect);
        const winW = THREE.MathUtils.clamp(pl.a.roadPx * 9, coverW * (mobile ? 0.45 : 0.35), coverW * 0.8);
        const winH = winW / aspect;
        const along = lerp(0.24, 0.76, THREE.MathUtils.clamp((q + FADE) / (1 + 2 * FADE), 0, 1));
        const cx = THREE.MathUtils.clamp(lerp(pl.a.bottom, pl.a.top, along) * pl.a.w, winW / 2, pl.a.w - winW / 2);
        const cy = THREE.MathUtils.clamp((1 - along) * pl.a.h, winH / 2, pl.a.h - winH / 2);
        pl.t.repeat.set(winW / pl.a.w, winH / pl.a.h);
        pl.t.offset.set((cx - winW / 2) / pl.a.w, 1 - (cy + winH / 2) / pl.a.h);
        // world width of the view so the photo road is ROAD_M wide
        const viewW = (ROAD_M * winW) / pl.a.roadPx;
        const k = i === 0 ? 1 : a; // blend weights follow the crossfade
        hWorld = hWorld * (1 - k) + viewW * k; wsum = 1;
        heading.lerp(pl.dir, k);
        (pl.m.material as THREE.MeshBasicMaterial).opacity = a * (1 - map);
      });
      // camera straight down, height so the visible width equals hWorld metres at the ground
      const viewW = hWorld || 60;
      const driveH = viewW / aspect / (2 * Math.tan(THREE.MathUtils.degToRad(DRIVE_FOV / 2)));
      const mapH = Math.max(172, 84 / (Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2)) * aspect));
      const inMap = map > 0;
      camera.fov = inMap ? MAP_FOV : DRIVE_FOV;
      camera.up.set(0, 0, -1);
      if (inMap) { camera.position.set(-3, mapH, 9.001); camera.lookAt(-3, 0, 9); } else { camera.position.set(0, driveH, 0.001); camera.lookAt(0, 0, 0); }
      camera.updateProjectionMatrix();
      // plates fill the frustum just beyond the far side of the ground
      const d = camera.position.y + 30, fh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      plates.forEach((pl) => { pl.m.position.set(0, 0, -d); pl.m.scale.set(fh * aspect, fh, 1); });
      // car: centred on the photo road (window centre), heading = blended road direction (screen up = world -z)
      if (car) {
        car.visible = map < 0.15 && wsum > 0;
        const dx = heading.x, dz = heading.y;
        face(car, dx, dz);
        const wob = Math.sin(t * 0.7) * 0.25; // slight lane drift
        car.position.set(-dz * wob * 0.3, 0.02, dx * wob * 0.3);
        vibrate(car, drive < 1 ? 1 : 0, t);
        blob.position.set(car.position.x + 0.35, 0.02, car.position.z + 0.25); blob.rotation.z = car.rotation.y; blob.visible = car.visible;
        catcher.position.set(car.position.x, 0.01, car.position.z); catcher.visible = car.visible;
        sun.target.position.copy(car.position);
        trail.visible = car.visible;
        trail.position.set(car.position.x - dx * 2.3, 0.03, car.position.z - dz * 2.3);
        trail.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx));
        trail.scale.set(Math.min(viewW, 4 + drive * viewW * 2), 1, 1);
      }
      // map reveal: plate fades out above, routes draw in
      mapGroup.visible = inMap;
      mapMat.opacity = map;
      const draw = seg(p, 0.84, 1);
      routes.forEach(([core, halo], i) => {
        const k = THREE.MathUtils.clamp(draw * legs.length - i * 0.6, 0, 1);
        const n = Math.floor((core.geometry.index?.count ?? 0) * k / 6) * 6;
        core.geometry.setDrawRange(0, n); halo.geometry.setDrawRange(0, Math.floor((halo.geometry.index?.count ?? 0) * k / 6) * 6);
        (core.material as THREE.MeshBasicMaterial).opacity = map;
        (halo.material as THREE.MeshBasicMaterial).opacity = map * 0.3;
      });
      dots.forEach((s) => { s.material.opacity = map * 0.9; });
      labels.forEach((s) => { s.material.opacity = seg(p, 0.88, 1); s.scale.set(44 * mapH / 172, 6.9 * mapH / 172, 1); });
      dots.forEach((s) => { s.scale.setScalar(8 * Math.sqrt(mapH / 172)); });
    },
  };
};
