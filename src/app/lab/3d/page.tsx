// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Lab page for the 3D damage map on a demo report (dev + Vercel Preview only)
// @created: 2026-10-28
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Lab3DClient from "./Lab3DClient";

export const metadata: Metadata = { title: "3D damage map · lab", robots: { index: false, follow: false } };

export default function Lab3DPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Lab3DClient />;
}
