// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Client wrapper for /lab/journey demo (stage/beat/body/lang from query; always the non-compact full journey)
// @created: 2026-10-28
// @updated: 2026-10-29 muse-code
"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { BodyType } from "@/components/damage-map-3d/bodyTemplates";
import { STAGE_IDS, progressOf, type StageId } from "@/components/journey-3d/route";

const JourneyScene = dynamic(() => import("@/components/journey-3d/JourneyScene"), { ssr: false });

export default function LabJourneyClient({ stage, beat, body, lang }: { stage?: StageId; beat?: number; body: BodyType; lang: "ru" | "en" }) {
  // With ?stage= (and optional ?beat=0|1|2) scroll the full non-compact journey to that beat for captures.
  useEffect(() => {
    if (!stage) return;
    const targetProgress = progressOf(stage) + ((beat ?? 0) + 0.5) / 3 / STAGE_IDS.length;
    const tryScroll = () => {
      const outer = document.querySelector<HTMLElement>("[data-journey-outer]");
      if (!outer) return false;
      const top = outer.offsetTop + targetProgress * (outer.offsetHeight - window.innerHeight);
      window.scrollTo(0, Math.max(0, top));
      return true;
    };
    const timers = [300, 900, 1800, 3000].map((ms) => window.setTimeout(tryScroll, ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [stage, beat]);

  return (
    <main className="bg-[#0c0e12]">
      <JourneyScene bodyType={body} lang={lang} currentStage={stage} />
      <div className="flex h-[30vh] items-center justify-center text-zinc-500">{lang === "ru" ? "Конец маршрута" : "End of route"}</div>
    </main>
  );
}
