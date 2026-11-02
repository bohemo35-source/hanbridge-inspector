// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Landing: tool-first hero (demo cars, instant reports, live agent, "check your own car") + film v3 "how the car gets home" below (#journey)
// @created: 2026-10-27
// @updated: 2026-11-01 claude-code — hero first, journey moved below (#journey)
// @updated: 2026-11-02 claude — the early journey-v2 prototype below the hero replaced by the current film v3 (same as /lab/film)
// @updated: 2026-11-02 claude-code — film v4 (trailer) below the hero; fonts come from the root layout
import Film4 from "@/components/film4/Film4";
import Hero from "@/components/hero/Hero";
import { listReportsAsync } from "@/lib/store/reports";
import { garageData } from "@/lib/garage/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const lang = q.lang === "ru" ? "ru" : "en";
  const reports = await listReportsAsync().catch(() => []);
  const report = reports.find((r) => r.carId === "kia-sportage") ?? reports.find((r) => r.carId === "mini-cooper-s") ?? reports[0]; // hero car: Kia Sportage
  const garage = report?.carId ? await garageData(report.carId, report, `${report.vehicle.year ?? ""} ${report.vehicle.make} ${report.vehicle.model}`.trim()).catch(() => undefined) : undefined;
  return (
    <main className="w-full">
      <Hero reports={reports} lang={lang} />
      <div id="journey">
        <Film4 report={report} lang={lang} garage={garage} />
      </div>
    </main>
  );
}
