// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Plate compositing: Muse Image background in camera space + real 3D car on a shadow-catcher ground, CatmullRom path per plate
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (true cover crop via view offset + mobile lane focus, HDRI env, wet mirror, headlight pools/cones, AO, rain, ramp pitch)
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import type { PlateConfig } from "../blocks";
import { setHeadlights } from "../useCar";
import { face, seg } from "./helpers";

/** Plates are 1920x1280 (Muse Image). */
const PLATE_ASPECT = 1.5;

export function blobShadowTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(0.6, "rgba(0,0,0,0.28)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  return new THREE.CanvasTexture(c);
}
/** Ambient occlusion under the body: soft rounded rectangle, darkest in the middle. */
function aoTexture(): THREE.Texture {
  return canvasTex(256, 128, (g) => {
    g.filter = "blur(10px)";
    g.fillStyle = "rgba(0,0,0,0.9)";
    g.beginPath(); g.roundRect(34, 30, 188, 68, 30); g.fill();
  });
}
/** Wheel contact: small dark radial spot. */
function dotTexture(): THREE.Texture {
  return canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, "rgba(0,0,0,0.95)"); r.addColorStop(0.5, "rgba(0,0,0,0.5)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
}
/** Headlight pool on the road: along +u (forward), bright near the car, fading out, soft sides. */
function beamTexture(): THREE.Texture {
  return canvasTex(256, 128, (g) => {
    const img = g.createImageData(256, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
      const u = x / 255, v = (y - 63.5) / 63.5;
      const spread = 0.35 + u * 0.65; // beam widens forward
      const side = Math.max(0, 1 - Math.pow(Math.abs(v) / spread, 2.2));
      const along = Math.pow(u < 0.12 ? u / 0.12 : 1, 1.5) * Math.pow(1 - u, 1.3);
      const a = Math.min(1, side * along * 1.6);
      const i = (y * 256 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
  });
}
/** Generic soft glow (radial) for brake light spill. */
function glowTexture(): THREE.Texture {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}
/** Long soft cast shadow: dense at the car, fading along +u. */
function longShadowTexture(): THREE.Texture {
  return canvasTex(256, 64, (g) => {
    const lin = g.createLinearGradient(0, 0, 256, 0);
    lin.addColorStop(0, "rgba(0,0,0,0.8)"); lin.addColorStop(0.45, "rgba(0,0,0,0.35)"); lin.addColorStop(1, "rgba(0,0,0,0)");
    g.filter = "blur(6px)"; g.fillStyle = lin; g.beginPath(); g.roundRect(6, 12, 244, 40, 18); g.fill();
  });
}
/** Volumetric headlight cone: brightest at the lamp, faded at the silhouette edge (fresnel-ish). */
function coneMaterial(color: number, intensity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity } },
    vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float along = pow(vUv.y, 1.6) * (1.0 - smoothstep(0.8, 1.0, vUv.y)); gl_FragColor = vec4(uColor * uI * edge * along, 1.0); }",
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
/** Mirror materials: darker, blurrier-looking, alpha fades with depth below the ground plane. */
function mirrorMaterial(src: THREE.Material, opacity: number): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial;
  m.transparent = true; m.depthWrite = false; m.opacity = opacity;
  if ("roughness" in m) { m.roughness = Math.min(1, (m.roughness ?? 0.5) + 0.25); }
  if (m.color) m.color.multiplyScalar(0.75);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWY;")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= clamp(1.0 + vWY / 1.1, 0.0, 1.0);");
  };
  m.customProgramCacheKey = () => "plate-mirror";
  return m;
}

/** ?envrot=&envint=&exp= override the plate config for tuning rounds (screenshots without code edits). */
function debugNum(name: string): number | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(name);
  return v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
}

export function makePlateScene(cfg: PlateConfig, debug: boolean): SceneBuilder {
  return ({ scene, camera, car, tex, setHdri, envFromTexture, mobile, renderer, viewport }) => {
    camera.fov = cfg.fov; camera.updateProjectionMatrix();
    const plateTex = tex(cfg.image);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    // reflections/lighting: CC0 HDRI matched to the plate (fallback: the plate itself through PMREM)
    if (cfg.hdri) setHdri(cfg.hdri);
    else { plateTex.mapping = THREE.EquirectangularReflectionMapping; envFromTexture(plateTex); }
    scene.environmentRotation.set(0, debugNum("envrot") ?? cfg.envRot ?? 0, 0);
    scene.environmentIntensity = debugNum("envint") ?? cfg.envInt ?? 1;
    const exp = debugNum("exp"); if (exp !== null) renderer.toneMappingExposure = exp;

    // Background: exactly the plate aspect at a fixed distance in camera space. The camera renders a sub-window of
    // this "full frame" (setViewOffset), so the photo is never stretched and the 3D ground stays registered to it.
    scene.add(camera);
    const dist = 40;
    const frameH = 2 * Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2)) * dist;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(frameH * PLATE_ASPECT, frameH), new THREE.MeshBasicMaterial({ map: plateTex, depthWrite: false, fog: false }));
    bg.position.set(0, 0, -dist); bg.renderOrder = -10;
    camera.add(bg);

    // lights matched to the plate; HDRI does the ambient + reflections, so the fill stays low
    const soft = (c: number) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.55);
    scene.add(new THREE.HemisphereLight(soft(cfg.tint), 0x0a0c10, cfg.hdri ? 0.18 : cfg.night ? 0.5 : 0.55));
    const key = new THREE.DirectionalLight(soft(cfg.lightColor), debugNum("key") ?? (cfg.night ? 1.2 : 1.6));
    key.position.set(...cfg.lightPos); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; key.shadow.bias = -0.0004; key.shadow.radius = 6;
    scene.add(key);
    // optional rim (tuning only, ?rim=): a back light mirrors off the glossy glass into a bloom blob, the HDRI separates the silhouette instead
    const rimI = debugNum("rim") ?? 0;
    if (rimI > 0) { const rim = new THREE.DirectionalLight(soft(cfg.lightColor), rimI); rim.position.set(cfg.lightPos[0] > 0 ? -10 : 10, 3, -12); scene.add(rim); }

    // invisible shadow-catcher ground y=0 (no depth write: the wet-road mirror below it must stay visible)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: cfg.shadowOpacity, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.renderOrder = 2; scene.add(ground);

    // ground FX that follow the car position + yaw but stay flat on the (local) ground: AO, wheel dots, light pools
    const fx = new THREE.Group(); scene.add(fx);
    const decal = (map: THREE.Texture, w: number, d: number, x: number, z: number, color: number, opacity: number, additive: boolean, order: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015 + order * 0.002, z); m.renderOrder = order; fx.add(m); return m;
    };
    const blob = decal(blobShadowTexture(), 6.4, 3.4, 0, 0, 0xffffff, 0.9, false, 3);
    const ao = decal(aoTexture(), 5.0, 2.5, 0, 0, 0xffffff, 0.95, false, 4);
    const dotTex = dotTexture();
    const dots = [[1.38, 0.8], [1.38, -0.8], [-1.38, 0.8], [-1.38, -0.8]].map(([x, z]) => decal(dotTex, 0.9, 0.7, x, z, 0xffffff, 0.9, false, 5));
    // headlight pools (forward = +x in car space) and brake spill (behind)
    const beamTex = beamTexture(), glowTex = glowTexture();
    const night = cfg.night;
    const pools = [-0.55, 0.55].map((z) => decal(beamTex, 9, 3.6, 2.2 + 4.3, z * 1.6, 0xffe2b8, night ? 0.5 : 0.18, true, 6));
    const brake = decal(glowTex, 2.6, 3.0, -2.8, 0, 0xff2414, night ? 0.4 : 0, true, 6);
    // long soft shadow along the key light direction (world-space orientation, fixed) — main cue on mobile (no shadow map)
    const lightDir = new THREE.Vector2(-cfg.lightPos[0], -cfg.lightPos[2]).normalize();
    const longShadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: longShadowTexture(), transparent: true, opacity: mobile ? 0.45 : 0.22, depthWrite: false }));
    longShadow.rotation.x = -Math.PI / 2; longShadow.rotation.z = Math.atan2(-lightDir.y, lightDir.x); longShadow.renderOrder = 3; scene.add(longShadow);

    // volumetric headlight cones (additive), parented to the car so they pitch/yaw with it
    const cones: THREE.Mesh[] = [];
    if (car && cfg.headlights) {
      for (const z of [-0.62, 0.62]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 7, 24, 1, true), coneMaterial(0xffe9c4, night ? 0.11 : 0.04));
        cone.rotation.z = Math.PI / 2; cone.position.set(2.2 + 3.5, 0.55, z);
        cone.renderOrder = 7; car.add(cone); cones.push(cone);
      }
    }
    if (car) car.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !cones.includes(m)) m.castShadow = true; });

    // wet asphalt: mirrored car under the ground plane, fading with depth (desktop; mobile keeps pools + AO only)
    let mirror: THREE.Object3D | null = null;
    const wet = cfg.wet ?? 0;
    if (car && wet > 0 && !mobile) {
      mirror = car.clone(true);
      mirror.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          if (cones.some((c) => m.geometry === c.geometry)) { m.visible = false; return; }
          m.castShadow = false; m.renderOrder = 1;
          m.material = Array.isArray(m.material) ? m.material.map((x) => mirrorMaterial(x, wet)) : mirrorMaterial(m.material, wet);
        } else if ((o as THREE.Sprite).isSprite) o.visible = false; // lamp sprites under the floor read as stray glows at the bumper
      });
      mirror.matrixAutoUpdate = false;
      scene.add(mirror);
    }
    const reflectY = new THREE.Matrix4().makeScale(1, -1, 1);

    // rain (Seoul): thin streaks in a box in front of the camera, updated on the CPU (few hundred segments)
    let rain: THREE.LineSegments | null = null;
    const RAIN = mobile ? 160 : 380;
    const rainPos = new Float32Array(RAIN * 6);
    const rainSeed = new Float32Array(RAIN * 3);
    if (cfg.rain) {
      for (let i = 0; i < RAIN; i++) { rainSeed[i * 3] = (Math.random() - 0.5) * 26; rainSeed[i * 3 + 1] = Math.random(); rainSeed[i * 3 + 2] = -2 - Math.random() * 26; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
      rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbcd2ff, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending }));
      rain.frustumCulled = false; rain.renderOrder = 8; scene.add(rain);
    }

    // tail-light sprites for handover blink (rear = -x for length-axis cars)
    const tails: THREE.Sprite[] = [];
    if (cfg.end === "stop" && car) {
      for (const off of [-0.62, 0.62]) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2a22, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.scale.setScalar(0.55); s.position.set(-2.25, 0.78, off); s.visible = false; car.add(s); tails.push(s);
      }
    }
    const curve = new THREE.CatmullRomCurve3(cfg.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    if (debug) {
      scene.add(new THREE.GridHelper(60, 60, 0xff4444, 0x446644));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), new THREE.LineBasicMaterial({ color: 0xffcc00 }));
      line.position.y = 0.05; scene.add(line);
      for (const p of cfg.path) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 })); s.position.set(p[0], p[1] + 0.1, p[2]); scene.add(s); }
    }
        if (car) setHeadlights(car, cfg.headlights);
    camera.position.set(...cfg.cameraPos);
    camera.lookAt(...cfg.lookAt);
    const tmp = new THREE.Vector3();
    const fxOff = debugNum("fxoff") ?? 0; // tuning: 1 cones, 2 pools, 4 lamp sprites
    let focus = -1; // smoothed crop centre (0..1 of the full frame width)
    const frame = (p: number, carPos: THREE.Vector3 | null) => {
      const { w: W, h: H } = viewport();
      const a = W / H;
      // full frame at plate aspect that covers the viewport
      const fullW = a < PLATE_ASPECT ? H * PLATE_ASPECT : W, fullH = a < PLATE_ASPECT ? H : W / PLATE_ASPECT;
      const z = 1.02 + p * 0.04; // slow push-in (photo and 3D scale together, so the car stays planted)
      const vw = W / z, vh = H / z;
      let fx0 = 0.5;
      if (carPos && a < 1.2) { // narrow screens: keep the lane/car in frame, follow it softly
        camera.clearViewOffset(); camera.aspect = PLATE_ASPECT; camera.updateProjectionMatrix();
        tmp.copy(carPos).project(camera);
        const carU = (tmp.x + 1) / 2;
        fx0 = THREE.MathUtils.lerp(cfg.focusX ?? 0.5, carU, 0.65);
      }
      focus = focus < 0 ? fx0 : focus + (fx0 - focus) * 0.08;
      const cx = THREE.MathUtils.clamp(focus * fullW + (p - 0.5) * fullW * 0.012, vw / 2, fullW - vw / 2);
      const cy = THREE.MathUtils.clamp(fullH / 2 + (0.5 - p) * fullH * 0.01, vh / 2, fullH - vh / 2);
      camera.aspect = PLATE_ASPECT;
      camera.setViewOffset(fullW, fullH, cx - vw / 2, cy - vh / 2, vw, vh);
    };
    return {
      triangles: 0,
      update: (p, t) => {
        if (!car) { frame(p, null); return; }
        const pos = curve.getPoint(Math.min(1, p));
        const tan = curve.getTangent(Math.min(0.999, p));
        car.position.copy(pos);
        if (tan.lengthSq() > 0.001) face(car, tan.x, tan.z);
        const pitch = Math.atan2(tan.y, Math.hypot(tan.x, tan.z));
        const moving = p > 0.02 && p < 0.97 ? 1 : 0;
        car.rotation.z = pitch + Math.sin(t * 23) * 0.0012 * moving; // ramp pitch + soft body vibration
        car.position.y = pos.y + Math.abs(Math.sin(t * 31)) * 0.0015 * moving;
        frame(p, pos);
        // ground FX: on the local ground (follows ramps), car yaw + pitch
        fx.position.set(pos.x, pos.y, pos.z);
        fx.rotation.set(0, car.rotation.y, pitch, "XYZ");
        longShadow.position.set(pos.x + lightDir.x * 3.2, pos.y + 0.012, pos.z + lightDir.y * 3.2);
        if (rain) {
          for (let i = 0; i < RAIN; i++) {
            const x = rainSeed[i * 3], z = rainSeed[i * 3 + 2];
            const y = 9 - ((rainSeed[i * 3 + 1] + t * 0.9) % 1) * 10;
            tmp.set(x, y, z).applyMatrix4(camera.matrixWorld);
            rainPos.set([tmp.x, tmp.y, tmp.z, tmp.x - 0.015, tmp.y - 0.34, tmp.z + 0.015], i * 6);
          }
          rain.geometry.attributes.position.needsUpdate = true;
        }
        let lightsOn = cfg.headlights;
        let shrink = 1;
        if (cfg.end === "hold") { // into the ro-ro hold: shrink + darken + vanish (SAM mask exists; doorway occlusion approximated)
          const into = seg(p, 0.78, 1);
          shrink = Math.max(0.05, 1 - into * 0.9);
          car.scale.setScalar(shrink);
          car.visible = into < 0.97;
        } else if (cfg.end === "stop") {
          lightsOn = p < 0.82;
          setHeadlights(car, lightsOn);
          const blink = p > 0.88 && p < 0.94;
          tails.forEach((s) => { s.visible = blink; });
          brake.material.opacity = blink ? 0.55 : 0;
        } else if (cfg.headlights) setHeadlights(car, true);
        // seen from behind, the front lamp sprites would glow through the roof line: keep only pools + cones then
        const facingCam = Math.cos(car.rotation.y) * (camera.position.x - pos.x) - Math.sin(car.rotation.y) * (camera.position.z - pos.z) > 0;
        if (!facingCam) (car.userData.glows as THREE.Sprite[] | undefined)?.forEach((g) => { g.visible = false; });
        cones.forEach((c) => { (c.material as THREE.ShaderMaterial).uniforms.uI.value = (night ? 0.11 : 0.04) * (facingCam ? 1 : 0.12); });
        const off = fxOff;
        if (off & 4) (car.userData.glows as THREE.Sprite[] | undefined)?.forEach((g) => { g.visible = false; });
        fx.scale.setScalar(shrink); fx.visible = car.visible;
        longShadow.visible = car.visible; longShadow.scale.setScalar(shrink);
        blob.material.opacity = 0.9 * shrink; ao.material.opacity = 0.95 * shrink; dots.forEach((d) => { d.material.opacity = 0.9 * shrink; });
        pools.forEach((m) => { m.visible = lightsOn && !(off & 2); m.material.opacity = (night ? 0.5 : 0.18) * (facingCam ? 1 : 0.4); });
        cones.forEach((c) => { c.visible = lightsOn && !(off & 1); });
        if (mirror) {
          car.updateMatrix();
          mirror.matrix.multiplyMatrices(reflectY, car.matrix);
          mirror.matrixWorldNeedsUpdate = true;
          mirror.visible = car.visible && pos.y < 0.2;
        }
      },
    };
  };
}
