// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 block chain: order, scroll heights (vh), pure progress mapping
// @created: 2026-10-29
import type { StageId } from "@/components/journey-3d/route";

export type BlockKind = "scene3d" | "bridge" | "garage" | "reviews" | "finale";
/** Plate compositing config (TZ-12): photo background + 3D car. Camera/path tuned per plate by screenshots (?debug=plate). */
export interface PlateConfig {
  image: string;
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  path: Array<[number, number, number]>;
  night: boolean;
  headlights: boolean;
  tint: number;
  lightColor: number;
  lightPos: [number, number, number];
  shadowOpacity: number;
  end: "none" | "hold" | "stop";
}
export interface BlockDef {
  id: string;
  kind: BlockKind;
  /** desktop height in vh of scroll; mobile multiplies scene/bridge heights */
  vh: number;
  stage: StageId | null;
  scene?: "seoul" | "port" | "vladivostok" | "road" | "finale";
  plate?: PlateConfig;
  bridgeImage?: string;
  bridgeStage?: StageId;
}

export const PLATES: Record<string, PlateConfig> = {
  seoul: { image: "/journey-v2/plate-seoul-bridge.jpg", cameraPos: [0, 1.55, 10], lookAt: [1.2, 1.1, -12], fov: 38, path: [[4.4, 0, 7], [4.0, 0, 1], [4.4, 0, -6], [5.2, 0, -14], [6.0, 0, -22]], night: true, headlights: true, tint: 0x8fb4e8, lightColor: 0xaac8ff, lightPos: [-8, 14, 4], shadowOpacity: 0.42, end: "none" },
  port: { image: "/journey-v2/plate-port-ramp.jpg", cameraPos: [0, 1.65, 11], lookAt: [1.6, 1.4, -12], fov: 38, path: [[0.6, 0, 7], [2.2, 0, 1], [3.8, 0, -5], [7.0, 0.35, -11], [10.0, 0.9, -17]], night: true, headlights: true, tint: 0xffc98a, lightColor: 0xffb066, lightPos: [-10, 16, 2], shadowOpacity: 0.48, end: "hold" },
  vladivostok: { image: "/journey-v2/plate-vladivostok-quay.jpg", cameraPos: [0, 1.6, 11], lookAt: [0.4, 1.2, -12], fov: 38, path: [[4.6, 0.9, -18], [3.6, 0.35, -10], [2.2, 0, -3], [0.8, 0, 3], [-0.2, 0, 7.5]], night: false, headlights: true, tint: 0xffd9a8, lightColor: 0xffc98a, lightPos: [-12, 10, -6], shadowOpacity: 0.38, end: "none" },
  finale: { image: "/journey-v2/plate-handover.jpg", cameraPos: [0, 1.55, 11], lookAt: [0, 1.1, -10], fov: 37, path: [[-0.6, 0, -14], [-0.3, 0, -7], [0, 0, -1], [0.1, 0, 3.5]], night: false, headlights: true, tint: 0xffe0b0, lightColor: 0xffbe78, lightPos: [-10, 8, 6], shadowOpacity: 0.4, end: "stop" },
};

export const BLOCKS: BlockDef[] = [
  { id: "seoul", kind: "scene3d", vh: 650, stage: null, scene: "seoul", plate: PLATES.seoul },
  { id: "bridge-sourcing", kind: "bridge", vh: 350, stage: "inspection", bridgeImage: "/journey-v2/bridge-sourcing.jpg", bridgeStage: "inspection" },
  { id: "garage", kind: "garage", vh: 500, stage: "inspection" },
  { id: "bridge-documents", kind: "bridge", vh: 400, stage: "korea_road", bridgeImage: "/journey-v2/bridge-documents.jpg", bridgeStage: "korea_road" },
  { id: "port", kind: "scene3d", vh: 600, stage: "port_busan", scene: "port", plate: PLATES.port },
  { id: "bridge-sea", kind: "bridge", vh: 750, stage: "sea", bridgeImage: "/journey-v2/bridge-sea.jpg", bridgeStage: "sea" },
  { id: "vladivostok", kind: "scene3d", vh: 500, stage: "vladivostok", scene: "vladivostok", plate: PLATES.vladivostok },
  { id: "bridge-customs", kind: "bridge", vh: 350, stage: "customs", bridgeImage: "/journey-v2/bridge-customs.jpg", bridgeStage: "customs" },
  { id: "road", kind: "scene3d", vh: 700, stage: "delivery", scene: "road" },
  { id: "handover", kind: "scene3d", vh: 400, stage: "delivery", scene: "finale", plate: PLATES.finale },
  { id: "reviews", kind: "reviews", vh: 200, stage: null },
  { id: "finale", kind: "finale", vh: 100, stage: null },
];

export const HUD_STAGES: Array<{ id: StageId; blockId: string }> = [
  { id: "inspection", blockId: "seoul" },
  { id: "korea_road", blockId: "bridge-documents" },
  { id: "port_busan", blockId: "port" },
  { id: "sea", blockId: "bridge-sea" },
  { id: "vladivostok", blockId: "vladivostok" },
  { id: "customs", blockId: "bridge-customs" },
  { id: "delivery", blockId: "road" },
];
// HUD labels per TZ: Покупка → Осмотр → Документы → Порт → Море → Прибытие → Таможня → Доставка
export const HUD_ORDER: Array<{ key: string; blockId: string }> = [
  { key: "purchase", blockId: "seoul" },
  { key: "inspection", blockId: "garage" },
  { key: "documents", blockId: "bridge-documents" },
  { key: "port", blockId: "port" },
  { key: "sea", blockId: "bridge-sea" },
  { key: "arrival", blockId: "vladivostok" },
  { key: "customs", blockId: "bridge-customs" },
  { key: "delivery", blockId: "road" },
];

export function totalVh(blocks: BlockDef[] = BLOCKS): number {
  return blocks.reduce((s, b) => s + b.vh, 0);
}
export interface BlockAt { block: BlockDef; index: number; local: number; startVh: number }
/** progress 0..1 over the whole chain -> block + local progress (clamped, monotone). */
export function blockAt(progress: number, blocks: BlockDef[] = BLOCKS): BlockAt {
  const total = totalVh(blocks);
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  let acc = 0;
  for (let i = 0; i < blocks.length; i++) {
    const start = acc / total;
    const end = (acc + blocks[i].vh) / total;
    if (p < end || i === blocks.length - 1) {
      return { block: blocks[i], index: i, local: Math.min(1, Math.max(0, (p - start) / Math.max(1e-9, end - start))), startVh: acc };
    }
    acc += blocks[i].vh;
  }
  return { block: blocks[blocks.length - 1], index: blocks.length - 1, local: 1, startVh: total - blocks[blocks.length - 1].vh };
}
export function startProgressOf(blockId: string, blocks: BlockDef[] = BLOCKS): number {
  const total = totalVh(blocks);
  let acc = 0;
  for (const b of blocks) { if (b.id === blockId) return acc / total; acc += b.vh; }
  return 0;
}
/** Stage shown in HUD/caption for a block (bridges & garage carry their stage). */
export function stageForBlock(block: BlockDef): StageId | null {
  return block.bridgeStage ?? block.stage;
}
