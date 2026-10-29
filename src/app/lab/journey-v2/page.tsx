// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Lab page for journey-v2 captures (?block=<id> deep-links by anchor scroll; dev + Preview only)
// @created: 2026-10-29
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Home from "@/app/page";

export const metadata: Metadata = { title: "Journey v2 · lab", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LabJourneyV2({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Home searchParams={searchParams} />;
}
