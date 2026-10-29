// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 scene 3: Busan port at night, instanced containers, cranes, ro-ro ramp loading
// @created: 2026-10-29
"use client";
import * as THREE from "three";
import type { SceneBuilder } from "../sceneKit";
import { setHeadlights, vibrate } from "../useCar";
import { M, box, face, points, lerp, seg } from "./helpers";

export const buildPort: SceneBuilder = ({ scene, camera, car, tex, setEnv, mobile }) => {
  setEnv("/journey-v2/env-port-night.jpg", 0x2c3540);
  scene.fog = new THREE.Fog(0x080b10, 35, 170);
  scene.add(new THREE.AmbientLight(0x2c3a4c, 1.2));
  const key = new THREE.DirectionalLight(0xaac4e8, 1.2); key.position.set(20, 30, 10); scene.add(key);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 180), new THREE.MeshStandardMaterial({ map: tex("/journey-v2/tex-asphalt-wet.jpg", [10, 10]), roughness: 0.35, metalness: 0.2, color: 0x9aa2ac }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // instanced containers
  const contGeo = new THREE.BoxGeometry(6, 2.6, 2.4);
  const contMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 });
  const containers = new THREE.InstancedMesh(contGeo, contMat, mobile ? 60 : 140);
  const colors = [0x7a3b2e, 0x2e4f7a, 0x3d6b4f, 0x6b5a2e, 0x555f6b, 0x74355a];
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  let idx = 0;
  for (let row = 0; row < 7 && idx < containers.count; row++) for (let stack = 0; stack < 3 && idx < containers.count; stack++) for (let i = 0; i < 7 && idx < containers.count; i++) {
    dummy.position.set(-42 + row * 4, 1.3 + stack * 2.7, -48 + i * 8);
    dummy.rotation.y = Math.PI / 2; dummy.updateMatrix();
    containers.setMatrixAt(idx, dummy.matrix); containers.setColorAt(idx, col.setHex(colors[idx % colors.length])); idx++;
  }
  containers.count = idx; scene.add(containers);
  // cranes
  const craneMat = M(0x8a4a20, 0.55, 0.5);
  for (const cx of [-25, 15]) {
    const g = new THREE.Group();
    g.add(box(1, 22, 1, craneMat, -6, 11, 0), box(1, 22, 1, craneMat, 6, 11, 0), box(16, 1.2, 1.2, craneMat, 0, 22, 0), box(1, 1, 18, craneMat, 0, 20, 6));
    g.position.set(cx, 0, -38); scene.add(g);
  }
  // ro-ro ship + stern ramp (pivot at ship end)
  const ship = new THREE.Group();
  const hull = box(16, 7, 52, M(0x35485c, 0.45, 0.6), 0, 3.5, 0); ship.add(hull);
  ship.add(box(14, 6, 40, M(0xd8dde2, 0.5, 0.3), 0, 10, 2));
  const rampPivot = new THREE.Group(); rampPivot.position.set(0, 3.2, 26);
  const ramp = box(7, 0.35, 12, M(0x46566a, 0.5, 0.6), 0, 0, 6); rampPivot.add(ramp); ship.add(rampPivot);
  ship.position.set(26, 0, -40); ship.rotation.y = Math.PI; scene.add(ship);
  const portLights = points(300, [160, 8, 140], 2, 0xffc37a, 0.5); scene.add(portLights);
  if (car) setHeadlights(car, true);
  return {
    triangles: 0,
    update: (p, t) => {
      const drive = seg(p, 0, 0.55), up = seg(p, 0.55, 0.8), close = seg(p, 0.8, 1);
      if (car) {
        if (up < 1) { face(car, 0.6, -1); car.position.set(lerp(-8, 20, drive), 0, lerp(25, -18, drive)); vibrate(car, drive < 1 ? 1 : 0, t); }
        else { face(car, 0, 1); car.position.set(28, lerp(0.2, 4.2, seg(p, 0.55, 0.8)), lerp(-28, -42, seg(p, 0.55, 0.8))); car.rotation.x = -0.18 * (1 - seg(p, 0.55, 0.8)); vibrate(car, close < 1 ? 0.6 : 0, t); }
      }
      rampPivot.rotation.x = lerp(0.32, -0.02, seg(p, 0.05, 0.3)) + close * -1.25;
      camera.position.set(lerp(-8, 12, p), lerp(3.4, 5.5, p), lerp(22, -2, p));
      camera.lookAt(lerp(2, 25, p), 2.5, lerp(2, -32, p));
    },
  };
};
