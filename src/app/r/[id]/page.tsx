// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /r/:id — public (no login, noindex) inspection report
// @created: 2026-10-29
// @updated: 2026-11-02 claude-code — garage studio data (real panel photos) for the report's car
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportAsync } from "@/lib/store/reports";
import { ReportView } from "./ReportView";
import { garageData } from "@/lib/garage/data";
import { blobUrl, hasMedia } from "@/lib/agent/media";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const runtime = "nodejs";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportAsync(id);
  if (!report) notFound();
  const carId = report.carId;
  const garage = carId && (hasMedia(carId, "out", "photo-index.json") || blobUrl(carId, "out", "photo-index.json"))
    ? await garageData(carId, report, `${report.vehicle.year ?? ""} ${report.vehicle.make} ${report.vehicle.model}`.trim()).catch(() => undefined) : undefined;
  return <ReportView report={report} garage={garage} />;
}
