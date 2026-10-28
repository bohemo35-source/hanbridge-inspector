// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Code-built low-poly journey scenery: road, cable bridge, port, ro-ro ship, shader sea, hills, lights
// @created: 2026-10-28
import * as THREE from "three";
import { ROUTE_POINTS, type StageId } from "./route";

export interface Scenery {
  group: THREE.Group;
  zones: Map<StageId, THREE.Group>;
  ship: THREE.Group;
  shipDeckY: number;
  water: THREE.Mesh;
  waterMaterial: THREE.ShaderMaterial;
  tris: number;
  dispose: () => void;
}

export function countTris(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const per = g.index ? g.index.count / 3 : (g.getAttribute("position")?.count ?? 0) / 3;
    const inst = m as THREE.InstancedMesh;
    n += per * (inst.isInstancedMesh ? inst.count : 1);
  });
  return Math.round(n);
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, rough = 0.7): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.15 }),
  );
  m.position.set(x, y, z);
  return m;
}

/** Deterministic value noise for hills. */
function noise(x: number, z: number): number {
  return Math.sin(x * 0.11 + z * 0.07) * 3.2 + Math.sin(x * 0.31 - z * 0.19) * 1.4 + Math.cos((x + z) * 0.05) * 2.1;
}

export function buildRoad(): THREE.Group {
  const g = new THREE.Group();
  g.name = "road";
  // Ribbon following the zone centres (flat, segmented)
  const pts = ROUTE_POINTS.map(([x, , z]) => new THREE.Vector3(x, 0.02, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
  const segs = 120;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const p = curve.getPoint(i / segs);
    const t = curve.getTangent(i / segs);
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(4.2);
    pos.push(p.x - side.x, 0.02, p.z - side.z, p.x + side.x, 0.02, p.z + side.z);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#1a1d24", roughness: 0.95 })));
  // Lane markings (instanced)
  const mark = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.18, 0.02, 2.2),
    new THREE.MeshStandardMaterial({ color: "#d8c26a", emissive: "#6b5a1e", emissiveIntensity: 0.4 }),
    60,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 60; i++) {
    const p = curve.getPoint((i + 0.5) / 60);
    const t = curve.getTangent((i + 0.5) / 60);
    dummy.position.set(p.x, 0.05, p.z);
    dummy.rotation.y = Math.atan2(t.x, t.z);
    dummy.updateMatrix();
    mark.setMatrixAt(i, dummy.matrix);
  }
  g.add(mark);
  return g;
}

export function buildBridge(at: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.name = "bridge";
  g.add(box(9, 0.5, 46, "#232833", 0, 1.2, 0));
  for (const z of [-14, 14]) {
    g.add(box(0.8, 17, 0.8, "#8a93a5", -3.4, 9, z, 0.4));
    g.add(box(0.8, 17, 0.8, "#8a93a5", 3.4, 9, z, 0.4));
    g.add(box(7.6, 0.7, 0.7, "#8a93a5", 0, 16.5, z, 0.4));
  }
  const cablePts: number[] = [];
  for (const z of [-14, 14])
    for (const s of [-1, 1])
      for (let i = 1; i <= 5; i++) {
        cablePts.push(s * 3.4, 16.2, z, s * 3.4, 1.6, z + (i / 5) * 16 * (z < 0 ? -1 : 1));
        cablePts.push(s * 3.4, 16.2, z, s * 3.4, 1.6, z - (i / 5) * 16 * (z < 0 ? -1 : 1));
      }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute("position", new THREE.Float32BufferAttribute(cablePts, 3));
  g.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: "#c8d4ea", transparent: true, opacity: 0.8 })));
  g.position.copy(at).add(new THREE.Vector3(0, 0, -6));
  return g;
}

export function buildPort(at: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.name = "port";
  const colors = ["#b8543f", "#3f6fb8", "#3fa66a", "#c9a227", "#7a4fa3"];
  const cont = new THREE.InstancedMesh(
    new THREE.BoxGeometry(6, 2.6, 2.4),
    new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
    48,
  );
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < 48; i++) {
    dummy.position.set(-22 + (i % 8) * 6.4, 1.3 + Math.floor(i / 16) * 2.7, -10 + Math.floor((i % 16) / 8) * 7);
    dummy.rotation.y = (i % 3) * 0.04;
    dummy.updateMatrix();
    cont.setMatrixAt(i, dummy.matrix);
    cont.setColorAt(i, col.set(colors[i % colors.length]));
  }
  g.add(cont);
  for (const x of [-14, 10]) {
    const crane = new THREE.Group();
    crane.add(box(0.7, 18, 0.7, "#d8d2c4", -4, 9, 0, 0.4), box(0.7, 18, 0.7, "#d8d2c4", 4, 9, 0, 0.4));
    crane.add(box(16, 0.7, 0.7, "#d8d2c4", 0, 17.6, 0, 0.4));
    crane.add(box(0.3, 7, 0.3, "#d8d2c4", 4, 13.5, 0, 0.4));
    crane.position.set(x, 0, -4);
    g.add(crane);
  }
  g.position.copy(at).add(new THREE.Vector3(4, 0, 4));
  return g;
}

export function buildShip(): THREE.Group {
  const g = new THREE.Group();
  g.name = "ship";
  const hull = box(11, 3.4, 42, "#26303e", 0, 1.4, 0, 0.5);
  const deck = box(10.4, 0.4, 40, "#39434f", 0, 3.3, 0, 0.6);
  const castle = box(8, 6, 6, "#cfd6de", 0, 6.4, -16, 0.5);
  const funnelGeo = new THREE.CylinderGeometry(1.1, 1.3, 3.4, 12);
  const funnel = new THREE.Mesh(funnelGeo, new THREE.MeshStandardMaterial({ color: "#b8543f", roughness: 0.5 }));
  funnel.position.set(0, 11, -17);
  const ramp = box(8, 0.3, 7, "#4a545f", 0, 2.2, 22.5, 0.6);
  ramp.rotation.x = 0.28;
  g.add(hull, deck, castle, funnel, ramp);
  return g;
}

export function buildWater(size = 700): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const geo = new THREE.PlaneGeometry(size, size, 48, 48);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#0d2b3d") }, uShallow: { value: new THREE.Color("#2f7f9e") } },
    vertexShader: `uniform float uTime; varying float vH; varying vec3 vPos;
      void main(){ vec3 p=position; float h=sin(p.x*0.08+uTime*1.2)*0.45+cos(p.y*0.06+uTime*0.9)*0.55; p.z+=h; vH=h; vPos=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uShallow; varying float vH; varying vec3 vPos;
      void main(){ float f=clamp(0.5+vH*0.55,0.0,1.0); vec3 c=mix(uColor,uShallow,f); gl_FragColor=vec4(c,0.92); }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.6;
  mesh.name = "water";
  return { mesh, material };
}

export function buildHills(at: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(190, 130, 36, 24);
  const posAttr = geo.getAttribute("position");
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    posAttr.setZ(i, Math.max(0, noise(x, y)) * (0.4 + Math.abs(x) / 120));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#2b3a33", roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  g.add(m);
  g.position.copy(at).add(new THREE.Vector3(-28, 0, -10));
  return g;
}

export function buildCityLights(at: THREE.Vector3, count = 260): THREE.Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = at.x - 55 + ((i * 37) % 110);
    pos[i * 3 + 1] = 1 + ((i * 13) % 14);
    pos[i * 3 + 2] = at.z - 40 + ((i * 53) % 80);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#ffd9a0", size: 0.55, sizeAttenuation: true }));
  pts.name = "city-lights";
  return pts;
}

function zoneGroup(id: StageId): THREE.Group {
  const g = new THREE.Group();
  g.name = `zone:${id}`;
  return g;
}

export function buildScenery(): Scenery {
  const group = new THREE.Group();
  group.name = "journey-scenery";
  const zones = new Map<StageId, THREE.Group>();
  const P = ROUTE_POINTS;
  const disposables: { dispose: () => void }[] = [];
  const add = (id: StageId, obj: THREE.Object3D) => {
    let z = zones.get(id);
    if (!z) {
      z = zoneGroup(id);
      zones.set(id, z);
      group.add(z);
    }
    z.add(obj);
  };

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshStandardMaterial({ color: "#12161d", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(90, -0.08, -175);
  group.add(ground);

  const { mesh: water, material: waterMaterial } = buildWater();
  water.position.set(70, -0.55, -175);
  group.add(water);

  group.add(buildRoad());

  const insp = new THREE.Group();
  insp.add(box(11, 0.18, 13, "#22262f", 0, 0.09, 0));
  const softbox = box(7, 0.25, 0.4, "#e8ecf4", 0, 4.6, 0, 0.3);
  softbox.material = new THREE.MeshStandardMaterial({ color: "#e8ecf4", emissive: "#ffffff", emissiveIntensity: 1.6 });
  insp.add(softbox);
  insp.add(box(0.25, 4.6, 0.25, "#555c68", -3.2, 2.3, 0), box(0.25, 4.6, 0.25, "#555c68", 3.2, 2.3, 0));
  insp.position.set(P[0][0], 0, P[0][2]);
  add("inspection", insp);

  const bridge = buildBridge(new THREE.Vector3(P[1][0], 0, P[1][2]));
  bridge.position.set(0, 0, 0); // built in local coords around its centre
  bridge.position.set(P[1][0], 0, P[1][2]);
  add("korea_road", bridge);

  const port = buildPort(new THREE.Vector3(0, 0, 0));
  port.position.set(P[2][0], 0, P[2][2]);
  add("port_busan", port);

  const ship = buildShip();
  ship.position.set(P[3][0], 0, P[3][2]);
  ship.rotation.y = 0.5;
  add("sea", ship);

  const vl = new THREE.Group();
  vl.add(buildHills(new THREE.Vector3(0, 0, 0)));
  vl.position.set(P[4][0], 0, P[4][2]);
  add("vladivostok", vl);
  group.add(buildCityLights(new THREE.Vector3(P[4][0], 0, P[4][2])));

  const gate = new THREE.Group();
  gate.add(box(0.7, 6.5, 0.7, "#c8ccd4", -5, 3.25, 0, 0.4), box(0.7, 6.5, 0.7, "#c8ccd4", 5, 3.25, 0, 0.4), box(11, 0.8, 0.8, "#c8ccd4", 0, 6.4, 0, 0.4));
  gate.position.set(P[5][0], 0, P[5][2]);
  add("customs", gate);

  const del = new THREE.Group();
  del.add(box(30, 0.15, 0.8, "#2c6e4f", -18, 0.1, -8), box(30, 0.15, 0.8, "#2c6e4f", 18, 0.1, -8));
  del.position.set(P[6][0], 0, P[6][2] + 18);
  add("delivery", del);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) disposables.push(m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material]));
  });

  return {
    group,
    zones,
    ship,
    shipDeckY: 3.55,
    water,
    waterMaterial,
    tris: countTris(group),
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
