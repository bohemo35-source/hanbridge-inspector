// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Lab page for the journey scene (video capture; dev + Vercel Preview only)
// @created: 2026-10-28
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BODY_TYPES, type BodyType } from "@/components/damage-map-3d/bodyTemplates";
import { isStageId } from "@/components/journey-3d/route";
import LabJourneyClient from "./LabJourneyClient";

export const metadata: Metadata = { title: "Journey scene · lab", robots: { index: false, follow: false } };

export default async function LabJourneyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const q = await searchParams;
  const stageRaw = typeof q.stage === "string" ? q.stage : undefined;
  const bodyRaw = typeof q.body === "string" ? q.body : "hatchback";
  const body: BodyType = (BODY_TYPES as readonly string[]).includes(bodyRaw) ? (bodyRaw as BodyType) : "hatchback";
  const lang = q.lang === "en" ? "en" : "ru";
  const beatRaw = typeof q.beat === "string" ? Number(q.beat) : NaN;
  const beat = beatRaw === 0 || beatRaw === 1 || beatRaw === 2 ? beatRaw : undefined;
  return <LabJourneyClient stage={isStageId(stageRaw) ? stageRaw : undefined} beat={beat} body={body} lang={lang} />;
}
