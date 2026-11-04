// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /r/:id — public (no login, noindex) inspection report
// @created: 2026-10-29
// @updated: 2026-11-02 claude-code — garage studio data (real panel photos) for the report's car
// @updated: 2026-11-03 claude-code — uploaded cars get the garage too (body template by type, panels from the report; no photo index → no per-panel photos)
// @updated: 2026-11-04 claude-code — language via reportLang(): EN unless ?lang=ru
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportAsync } from "@/lib/store/reports";
import { ReportView } from "./ReportView";
import { garageData } from "@/lib/garage/data";
import { reportLang } from "./lang";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const runtime = "nodejs";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const lang = reportLang((await searchParams).lang);
  const report = await getReportAsync(id);
  if (!report) notFound();
  const carId = report.carId ?? report.id;
  const title = `${report.vehicle.year ?? ""} ${report.vehicle.make} ${report.vehicle.model}`.trim();
  // catalog cars: panel photos from the Muse Glimmer index; uploads: the same garage from the report alone
  const garage = await garageData(carId, report, title).catch(() => undefined);
  return <ReportView report={report} garage={garage} initialLang={lang} />;
}
