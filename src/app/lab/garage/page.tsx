// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Lab page for the garage inspection scene (video capture; dev + Vercel Preview only)
// @created: 2026-10-29
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listReportsAsync } from "@/lib/store/reports";
import type { Beat } from "@/components/garage-3d/parts";
import LabGarageClient from "./LabGarageClient";

export const metadata: Metadata = { title: "Garage scene · lab", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LabGaragePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const q = await searchParams;
  const carId = typeof q.car === "string" ? q.car : "mini-cooper-s";
  const lang = q.lang === "en" ? "en" : "ru";
  const debugParts = q.debug === "parts";
  const beatRaw = typeof q.beat === "string" ? Number(q.beat) : NaN;
  const beat = [0, 1, 2, 3, 4, 5].includes(beatRaw) ? (beatRaw as Beat) : undefined;
  const paint = typeof q.paint === "string" && /^#[0-9a-fA-F]{6}$/.test(q.paint) ? q.paint : undefined;

  const reports = await listReportsAsync();
  const report = reports.find((r) => r.carId === carId) ?? reports[0];
  return <LabGarageClient report={report} lang={lang} debugParts={debugParts} beat={beat} paint={paint} />;
}
