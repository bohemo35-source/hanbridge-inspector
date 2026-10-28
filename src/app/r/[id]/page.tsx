// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /r/:id — public (no login, noindex) inspection report
// @created: 2026-10-29
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportAsync } from "@/lib/store/reports";
import { ReportView } from "./ReportView";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const runtime = "nodejs";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportAsync(id);
  if (!report) notFound();
  return <ReportView report={report} />;
}
