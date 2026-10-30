// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Lab page for the scroll film journey v2 (bridge of trust) before it replaces "/"
// @created: 2026-10-31
import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { listReportsAsync } from "@/lib/store/reports";
import FilmJourney from "@/components/film/FilmJourney";

const serif = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["300", "400"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = { title: "Hanbridge Auto · the bridge", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LabFilmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const lang = q.lang === "ru" ? "ru" : "en";
  const reports = await listReportsAsync().catch(() => []);
  const report = reports.find((r) => r.carId === (typeof q.car === "string" ? q.car : "kia-sportage")) ?? reports[0];
  return (
    <main className={`${serif.variable} w-full`} style={{ ["--tw-font-serif" as string]: "var(--font-serif)" }}>
      <style>{`.font-serif{font-family:var(--font-serif),Georgia,serif}`}</style>
      <FilmJourney report={report} lang={lang} />
    </main>
  );
}
