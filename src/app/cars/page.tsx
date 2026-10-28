// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /cars — demo-car catalog + all generated reports with verdicts and /r/:id links
// @created: 2026-10-29
import { CARS } from "@/lib/agent/catalog";
import { listReportsAsync } from "@/lib/store/reports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CarsPage() {
  const reports = await listReportsAsync();
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: "#e8ebee", fontFamily: "system-ui" }}>
      <p style={{ font: "11px monospace", letterSpacing: ".12em", color: "#8b94a1" }}>HANBRIDGE INSPECTOR</p>
      <h1>Машины и отчёты</h1>
      <h2>Запустить агента</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {CARS.map((c) => (
          <a key={c.carId} href={`/inspect/${c.carId}`} style={{ color: "#e8ebee", background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: 14, textDecoration: "none" }}>
            <b>{c.year} {c.make} {c.model}</b> <span style={{ color: "#8b94a1" }}>{c.carId} → live trace</span>
          </a>
        ))}
      </div>
      <h2>Отчёты ({reports.length})</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {reports.map((r) => (
          <a key={r.id} href={`/r/${r.id}`} style={{ color: "#e8ebee", background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: 14, textDecoration: "none", display: "flex", gap: 14 }}>
            {r.listingUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.listingUrl} alt="" style={{ width: 140, borderRadius: 8 }} /> : null}
            <span><b>{r.vehicle.year ?? ""} {r.vehicle.make} {r.vehicle.model}</b><br />
              <span style={{ fontWeight: 800, color: r.verdict.decision === "BUY" ? "#4fb38a" : r.verdict.decision === "WALK_AWAY" ? "#e5544b" : "#e3a33b" }}>{r.verdict.decision.replace("_", " ")}</span>
              <span style={{ color: "#8b94a1" }}> · находок {r.findings.length}, подтверждено {r.findings.filter((f) => f.verified).length} · /r/{r.id}</span></span>
          </a>
        ))}
        {!reports.length && <p style={{ color: "#8b94a1" }}>Пока нет отчётов — запустите агента по машине выше или <code>node scripts/e2e/run-cars.mjs</code>.</p>}
      </div>
    </main>
  );
}
