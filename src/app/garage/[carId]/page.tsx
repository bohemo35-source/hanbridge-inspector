// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: /garage/:carId — interactive inspection bay for one demo car: newest report + the car's real photos per panel; switcher to the other inspections
// @created: 2026-11-02
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CARS, getCar } from "@/lib/agent/catalog";
import { listReportsAsync } from "@/lib/store/reports";
import { garageData } from "@/lib/garage/data";
import GarageStudio from "@/components/garage-studio/GarageStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ carId: string }> }): Promise<Metadata> {
  const { carId } = await params; const car = getCar(carId);
  return { title: car ? `${car.year} ${car.make} ${car.model} · Hanbridge garage` : "Hanbridge garage", robots: { index: false, follow: false } }; // same report data as /r/:id
}

export default async function GaragePage({ params, searchParams }: { params: Promise<{ carId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { carId } = await params; const q = await searchParams;
  const lang = q.lang === "ru" ? "ru" : "en";
  const car = getCar(carId); if (!car) notFound();
  const reports = await listReportsAsync().catch(() => []);
  const report = reports.find((r) => r.carId === carId);
  const data = await garageData(carId, report, `${car.year} ${car.make} ${car.model}`);
  const qs = lang === "ru" ? "?lang=ru" : "";
  return (
    <main className="min-h-[100svh] bg-ink">
      <GarageStudio data={data} lang={lang} />
      <nav className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-2 px-5 py-8 sm:px-8">
        <Link href={`/${qs}`} className="mr-3 font-display text-[15px] font-semibold uppercase tracking-[.42em] text-bone">Hanbridge</Link>
        <span className="mr-2 font-mono text-[10.5px] uppercase tracking-[.24em] text-mist">{lang === "ru" ? "Другие осмотры" : "Other inspections"}</span>
        {CARS.map((c) => (
          <Link key={c.carId} href={`/garage/${c.carId}${qs}`} className={`rounded-full border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.14em] ${c.carId === carId ? "border-sodium text-sodium" : "border-bone/20 text-bone-2 hover:border-sodium"}`}>{c.year} {c.make} {c.model}</Link>
        ))}
        <span className="ml-auto flex gap-3 font-mono text-[11px] uppercase tracking-[.2em]">
          <Link href={`/garage/${carId}`} className={lang === "en" ? "text-bone" : "text-mist"}>EN</Link>
          <Link href={`/garage/${carId}?lang=ru`} className={lang === "ru" ? "text-bone" : "text-mist"}>RU</Link>
        </span>
      </nav>
    </main>
  );
}
