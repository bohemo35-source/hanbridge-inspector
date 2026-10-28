// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Client wrapper for /lab/journey demo (stage/body/lang from query)
// @created: 2026-10-28
"use client";

import dynamic from "next/dynamic";
import type { BodyType } from "@/components/damage-map-3d/bodyTemplates";
import type { StageId } from "@/components/journey-3d/route";

const JourneyScene = dynamic(() => import("@/components/journey-3d/JourneyScene"), { ssr: false });

export default function LabJourneyClient({ stage, body, lang }: { stage?: StageId; body: BodyType; lang: "ru" | "en" }) {
  // With ?stage= the scene is pinned to that stage (for captures); without it the full scroll journey plays.
  return (
    <main className="bg-[#0c0e12]">
      <JourneyScene bodyType={body} lang={lang} currentStage={stage} compact={!!stage} />
      {!stage && <div className="flex h-[40vh] items-center justify-center text-zinc-500">{lang === "ru" ? "Конец маршрута" : "End of route"}</div>}
    </main>
  );
}
