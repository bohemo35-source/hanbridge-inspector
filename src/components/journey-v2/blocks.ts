// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 block chain: order, scroll heights (vh), pure progress mapping
// @created: 2026-10-29
import type { StageId } from "@/components/journey-3d/route";

export type BlockKind = "scene3d" | "bridge" | "garage" | "reviews" | "finale";
export interface BlockDef {
  id: string;
  kind: BlockKind;
  /** desktop height in vh of scroll; mobile multiplies scene/bridge heights */
  vh: number;
  stage: StageId | null;
  scene?: "seoul" | "port" | "vladivostok" | "road" | "finale";
  bridgeImage?: string;
  bridgeStage?: StageId;
}

export const BLOCKS: BlockDef[] = [
  { id: "seoul", kind: "scene3d", vh: 500, stage: null, scene: "seoul" },
  { id: "bridge-sourcing", kind: "bridge", vh: 300, stage: "inspection", bridgeImage: "/journey-v2/bridge-sourcing.jpg", bridgeStage: "inspection" },
  { id: "garage", kind: "garage", vh: 500, stage: "inspection" },
  { id: "bridge-documents", kind: "bridge", vh: 300, stage: "korea_road", bridgeImage: "/journey-v2/bridge-documents.jpg", bridgeStage: "korea_road" },
  { id: "port", kind: "scene3d", vh: 450, stage: "port_busan", scene: "port" },
  { id: "bridge-sea", kind: "bridge", vh: 450, stage: "sea", bridgeImage: "/journey-v2/bridge-sea.jpg", bridgeStage: "sea" },
  { id: "vladivostok", kind: "scene3d", vh: 400, stage: "vladivostok", scene: "vladivostok" },
  { id: "bridge-customs", kind: "bridge", vh: 300, stage: "customs", bridgeImage: "/journey-v2/bridge-customs.jpg", bridgeStage: "customs" },
  { id: "road", kind: "scene3d", vh: 450, stage: "delivery", scene: "road" },
  { id: "handover", kind: "scene3d", vh: 300, stage: "delivery", scene: "finale" },
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
