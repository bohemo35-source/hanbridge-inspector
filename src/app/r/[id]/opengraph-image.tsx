// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: OG share card for /r/:id
// @created: 2026-10-29
import { ImageResponse } from "next/og";
import { getReportAsync } from "@/lib/store/reports";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReportAsync(id);
  const title = r ? `${r.vehicle.make} ${r.vehicle.model}` : "Hanbridge Inspector";
  const verdict = r?.verdict.decision ?? "INSPECTION REPORT";
  return new ImageResponse(
    (<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 64, background: "#0b0d10", color: "#e8ebee", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 24, letterSpacing: 4, color: "#8b94a1" }}>HANBRIDGE INSPECTOR</div>
      <div style={{ fontSize: 64, fontWeight: 800, marginTop: 16 }}>{title}</div>
      <div style={{ fontSize: 48, fontWeight: 800, marginTop: 16, color: verdict === "BUY" ? "#4fb38a" : verdict === "WALK_AWAY" ? "#e5544b" : "#e3a33b" }}>{verdict.replace("_", " ")}</div>
      <div style={{ fontSize: 24, color: "#8b94a1", marginTop: 16 }}>Every finding verified against its evidence</div>
    </div>),
    size,
  );
}
