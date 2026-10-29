// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Client wrapper for /lab/garage (car/lang/debug/beat from query; full scroll scene)
// @created: 2026-10-29
"use client";

import dynamic from "next/dynamic";
import type { Report } from "@/lib/schema";
import type { Beat } from "@/components/garage-3d/parts";

const GarageScene = dynamic(() => import("@/components/garage-3d/GarageScene"), { ssr: false });

export default function LabGarageClient({ report, lang, debugParts, beat, paint }: {
  report?: Report; lang: "ru" | "en"; debugParts?: boolean; beat?: Beat; paint?: string;
}) {
  return (
    <main className="bg-[#0a0c10]">
      <GarageScene report={report} lang={lang} debugParts={debugParts} pinnedBeat={debugParts ? undefined : beat} paint={paint} />
      <div className="flex h-[25vh] items-center justify-center text-zinc-500">
        {lang === "ru" ? "Конец сцены гаража" : "End of garage scene"}
      </div>
    </main>
  );
}
