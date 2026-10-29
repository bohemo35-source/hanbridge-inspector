// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 orchestrator: chain of short 3D scenes + Muse Image bridges + garage + reviews + finale, HUD progress
// @created: 2026-10-29
"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Report } from "@/lib/schema";
import type { Lang } from "./copy";
import { CAPTIONS, FINALE, HANDOVER_CARD } from "./copy";
import { BLOCKS, blockAt, totalVh, type BlockDef } from "./blocks";
import SceneBlock from "./SceneBlock";
import Bridge from "./Bridge";
import Hud from "./Hud";
import ReviewsSection, { type ReviewItem } from "./Reviews";

const GarageScene = dynamic(() => import("@/components/garage-3d/GarageScene"), { ssr: false });

const CAPTION_BY_BLOCK: Record<string, string> = Object.fromEntries(BLOCKS.filter((b) => CAPTIONS[b.id]).map((b) => [b.id, b.id]));
const HUD_BY_BLOCK: Record<string, string> = {
  seoul: "purchase", "bridge-sourcing": "inspection", garage: "inspection", "bridge-documents": "documents",
  port: "port", "bridge-sea": "sea", vladivostok: "arrival", "bridge-customs": "customs", road: "delivery", handover: "delivery",
};
const FALLBACK_IMG: Record<string, string> = {
  seoul: "/journey-v2/env-seoul-night.jpg", port: "/journey-v2/env-port-night.jpg", vladivostok: "/journey-v2/env-vladivostok-dawn.jpg",
  road: "/journey-v2/tex-terrain-forest.jpg", finale: "/journey-v2/env-golden-hour.jpg",
};

export default function JourneyV2({ report, lang, reviews }: { report?: Report; lang: Lang; reviews: ReviewItem[] }) {
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const visibleBlocks = useMemo(() => BLOCKS.filter((b) => b.kind !== "reviews" || reviews.length > 0), [reviews]);
  const total = totalVh(visibleBlocks);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const noWebgl = (() => { try { return !document.createElement("canvas").getContext("webgl2"); } catch { return true; } })();
    setReduced(mq.matches || noWebgl || new URLSearchParams(window.location.search).has("no3d"));
    setMobile(window.matchMedia("(max-width: 768px)").matches);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const mobileScale = mobile ? 1.3 : 1;
  if (reduced === null) return <div className="min-h-[100svh] bg-[#07090d]" />;
  if (reduced) {
    return (
      <main className="bg-[#07090d] text-white" data-testid="journey-fallback">
        {visibleBlocks.map((b) => (
          <section key={b.id} className="mx-auto w-full max-w-4xl px-4 py-10" data-fallback-block={b.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.bridgeImage ?? FALLBACK_IMG[b.scene ?? ""] ?? FALLBACK_IMG.seoul} alt="" className="w-full rounded-2xl object-cover" />
            <h2 className="mt-4 text-2xl font-semibold">{CAPTIONS[b.id]?.[lang] ?? FINALE.pickCar[lang]}</h2>
            {b.kind === "garage" && report && <p className="mt-2 text-zinc-300">{report.vehicle.year} {report.vehicle.make} {report.vehicle.model} · {report.verdict.decision.replace("_", " ")} · <a className="text-amber-300 underline" href={`/r/${report.id}`}>{FINALE.demoReport[lang]}</a></p>}
            {b.kind === "reviews" && <ReviewsSection reviews={reviews} lang={lang} />}
          </section>
        ))}
        <Finale lang={lang} report={report} />
      </main>
    );
  }

  const at = blockAt(progress, visibleBlocks);
  const captionKey = CAPTION_BY_BLOCK[at.block.id];
  const caption = at.block.id === "garage" ? "" : captionKey ? CAPTIONS[captionKey][lang] : at.block.id === "handover" ? HANDOVER_CARD[lang] : at.block.kind === "reviews" || at.block.kind === "finale" ? CAPTIONS.finale[lang] : CAPTIONS.seoul[lang];
  return (
    <main className="relative bg-[#07090d]" data-testid="journey-v2" data-total-vh={total} data-progress={progress.toFixed(3)}>
      <Hud lang={lang} activeKey={HUD_BY_BLOCK[at.block.id] ?? "purchase"} caption={caption} reportId={report?.id} />
      {visibleBlocks.map((b) => <Block key={b.id} block={b} lang={lang} report={report} reviews={reviews} mobileScale={mobileScale} />)}
    </main>
  );
}

function Block({ block, lang, report, reviews, mobileScale }: { block: BlockDef; lang: Lang; report?: Report; reviews: ReviewItem[]; mobileScale: number }) {
  if (block.kind === "scene3d" && block.scene) return <SceneBlock sceneId={block.scene} blockId={block.id} heightVh={block.vh} mobileScale={mobileScale} />;
  if (block.kind === "bridge" && block.bridgeImage && block.bridgeStage) return <Bridge id={block.id} image={block.bridgeImage} stage={block.bridgeStage} heightVh={block.vh} mobileScale={mobileScale} lang={lang} />;
  if (block.kind === "garage") return <div data-journey-block="garage"><GarageScene report={report} lang={lang} /></div>;
  if (block.kind === "reviews") return <ReviewsSection reviews={reviews} lang={lang} />;
  return <Finale lang={lang} report={report} />;
}

export function Finale({ lang, report }: { lang: Lang; report?: Report }) {
  return (
    <section data-journey-block="finale" className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#0b0e13]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/journey-v2/env-golden-hour.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="relative mx-auto max-w-2xl px-5 py-24 text-center text-white">
        <h2 className="text-3xl font-semibold leading-tight sm:text-5xl">{CAPTIONS.finale[lang]}</h2>
        <p className="mt-4 text-zinc-300">{FINALE.totalNote[lang]}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/cars" className="rounded-full bg-amber-300 px-6 py-3 font-semibold text-zinc-950">{FINALE.pickCar[lang]}</a>
          {report && <a href={`/r/${report.id}`} className="rounded-full border border-white/30 bg-black/45 px-6 py-3 font-semibold text-white backdrop-blur-md">{FINALE.demoReport[lang]}</a>}
        </div>
      </div>
    </section>
  );
}
