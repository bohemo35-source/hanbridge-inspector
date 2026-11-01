// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Landing: tool-first hero (demo cars, instant reports, live agent) + Journey v2 scroll story below
// @created: 2026-10-27
// @updated: 2026-11-01 claude-code — hero first, journey moved below (#journey)
import { readFile } from "node:fs/promises";
import path from "node:path";
import JourneyV2 from "@/components/journey-v2/JourneyV2";
import type { ReviewItem } from "@/components/journey-v2/Reviews";
import Hero from "@/components/hero/Hero";
import { listReportsAsync } from "@/lib/store/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadReviews(): Promise<ReviewItem[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public/reviews/manifest.json"), "utf8");
    const parsed = JSON.parse(raw) as ReviewItem[];
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.video && r.quote_ru && r.quote_en) : [];
  } catch { return []; }
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const lang = q.lang === "ru" ? "ru" : "en";
  const reports = await listReportsAsync().catch(() => []);
  const report = reports.find((r) => r.carId === "mini-cooper-s") ?? reports[0];
  const reviews = await loadReviews();
  return (
    <main className="w-full">
      <Hero reports={reports} lang={lang} />
      <div id="journey">
        <JourneyV2 report={report} lang={lang} reviews={reviews} />
      </div>
    </main>
  );
}
