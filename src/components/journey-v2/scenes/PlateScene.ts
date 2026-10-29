// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Plate compositing: Muse Image background in camera space + real 3D car on a shadow-catcher ground, CatmullRom path per plate
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import type { PlateConfig } from "../blocks";
import { setHeadlights, vibrate } from "../useCar";
import { face, seg } from "./helpers";

export function blobShadowTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(0.6, "rgba(0,0,0,0.28)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

export function makePlateScene(cfg: PlateConfig, debug: boolean): SceneBuilder {
  return ({ scene, camera, car, tex, envFromTexture }) => {
    camera.fov = cfg.fov; camera.updateProjectionMatrix();
    const plateTex = tex(cfg.image);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    plateTex.mapping = THREE.EquirectangularReflectionMapping;
    envFromTexture(plateTex);
    // background plane locked to camera (cover, no stretch), parallax push-in in update()
    scene.add(camera);
    const dist = 40;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2)) * dist;
    const w = h * camera.aspect;
    const imgAspect = 16 / 9;
    const cover = Math.max(w / h, imgAspect) / Math.min(w / h, imgAspect);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w * cover * 1.12, h * cover * 1.12), new THREE.MeshBasicMaterial({ map: plateTex, depthWrite: false, fog: false }));
    bg.position.set(0, 0, -dist); bg.renderOrder = -10;
    camera.add(bg);
    // lights matched to the plate
    scene.add(new THREE.HemisphereLight(cfg.tint, 0x0a0c10, cfg.night ? 0.55 : 0.9));
    const key = new THREE.DirectionalLight(cfg.lightColor, cfg.night ? 1.6 : 2.4);
    key.position.set(...cfg.lightPos); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -25; key.shadow.camera.right = 25; key.shadow.camera.top = 25; key.shadow.camera.bottom = -25; key.shadow.bias = -0.0004;
    scene.add(key);
    // invisible shadow-catcher ground y=0 + contact blob
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: cfg.shadowOpacity }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; scene.add(blob);
    if (car) car.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    // tail-light sprites for handover blink (rear = -x for length-axis cars)
    const tails: THREE.Sprite[] = [];
    if (cfg.end === "stop" && car) {
      for (const off of [-0.62, 0.62]) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2a22, transparent: true, opacity: 0.95, depthWrite: false }));
        s.scale.setScalar(0.5); s.position.set(-2.25, 0.68, off); s.visible = false; car.add(s); tails.push(s);
      }
    }
    const curve = new THREE.CatmullRomCurve3(cfg.path.map((p) => new THREE.Vector3(...p)));
    if (debug) {
      scene.add(new THREE.GridHelper(60, 60, 0xff4444, 0x446644));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), new THREE.LineBasicMaterial({ color: 0xffcc00 }));
      line.position.y = 0.05; scene.add(line);
      for (const p of cfg.path) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 })); s.position.set(p[0], p[1] + 0.1, p[2]); scene.add(s); }
    }
    const carLight = new THREE.PointLight(0xffd9a0, cfg.night ? 50 : 0, 20); scene.add(carLight);
    if (car) setHeadlights(car, cfg.headlights);
    const baseCam = new THREE.Vector3(...cfg.cameraPos);
    return {
      triangles: 0,
      update: (p, t) => {
        // plate parallax: +-2% shift, 3-5% push-in
        bg.position.x = (p - 0.5) * w * 0.04;
        bg.position.y = (0.5 - p) * h * 0.02;
        const push = 1 + p * 0.04; bg.scale.setScalar(push);
        camera.position.copy(baseCam); camera.position.x += (p - 0.5) * 0.4;
        camera.lookAt(...cfg.lookAt);
        if (!car) return;
        const pos = curve.getPoint(Math.min(1, p));
        const tan = curve.getTangent(Math.min(0.999, p));
        car.position.copy(pos);
        if (tan.lengthSq() > 0.001) face(car, tan.x, tan.z);
        const moving = p > 0.02 && p < 0.97 ? 1 : 0;
        vibrate(car, moving, t);
        car.position.y = pos.y + Math.abs(car.position.y);
        blob.position.set(pos.x, 0.02, pos.z); blob.rotation.z = -car.rotation.y;
        const distScale = THREE.MathUtils.clamp(1 - seg(p, 0, 1) * 0.1, 0.85, 1);
        blob.scale.setScalar(distScale);
        carLight.position.set(pos.x, 1.2, pos.z);
        if (cfg.end === "hold") { // into the ro-ro hold: shrink + darken + vanish (SAM mask exists; doorway occlusion approximated)
          const into = seg(p, 0.78, 1);
          car.scale.setScalar(Math.max(0.05, 1 - into * 0.9));
          car.visible = into < 0.97;
          blob.material.opacity = 1 - into;
        } else if (cfg.end === "stop") {
          setHeadlights(car, p < 0.82);
          const blink = p > 0.88 && p < 0.94;
          tails.forEach((s) => { s.visible = blink; });
        } else if (cfg.headlights) setHeadlights(car, true);
      },
    };
  };
}
