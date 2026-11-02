// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Landing: tool-first hero (demo cars, instant reports, live agent, "check your own car") + film v3 "how the car gets home" below (#journey)
// @created: 2026-10-27
// @updated: 2026-11-01 claude-code — hero first, journey moved below (#journey)
// @updated: 2026-11-02 claude — the early journey-v2 prototype below the hero replaced by the current film v3 (same as /lab/film)
import { Fraunces } from "next/font/google";
import FilmV3 from "@/components/film3/FilmV3";
import Hero from "@/components/hero/Hero";
import { listReportsAsync } from "@/lib/store/reports";

const serif = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["300", "400"], variable: "--font-serif", display: "swap" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const lang = q.lang === "ru" ? "ru" : "en";
  const reports = await listReportsAsync().catch(() => []);
  const report = reports.find((r) => r.carId === "kia-morning") ?? reports.find((r) => r.carId === "mini-cooper-s") ?? reports[0];
  return (
    <main className={`${serif.variable} w-full`} style={{ ["--tw-font-serif" as string]: "var(--font-serif)" }}>
      <style>{`.font-serif{font-family:var(--font-serif),Georgia,serif}`}</style>
      <Hero reports={reports} lang={lang} />
      <div id="journey">
        <FilmV3 report={report} lang={lang} />
      </div>
    </main>
  );
}
