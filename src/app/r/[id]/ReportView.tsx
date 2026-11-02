// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Public report view: verdict, InspectionMap, findings/Unconfirmed, listing, agent trace, chat, delivery tab (EN/RU)
// @created: 2026-10-29
// @updated: 2026-11-02 claude-code — garage studio (one neutral 3D car, panels from this report, real photos) replaces the parametric map when the car has a photo index
"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Report } from "@/lib/schema";
import type { GarageData } from "@/lib/garage/data";
import { InspectionMap } from "@/components/damage-map-3d/InspectionMap";
import { guessBodyType } from "@/components/damage-map-3d/bodyTypeMap";
import { isStageId } from "@/components/journey-3d/route";

const JourneyScene = dynamic(() => import("@/components/journey-3d/JourneyScene"), { ssr: false });
const GarageStudio = dynamic(() => import("@/components/garage-studio/GarageStudio"), { ssr: false });

const T = {
  ru: { confirmed: "Подтверждённые находки", unconfirmed: "Unconfirmed — не подтверждены верификатором", trace: "Трасса агента", delivery: "Доставка", report: "Отчёт", chat: "Чат с экспертом", ask: "Спросить по этому отчёту…", send: "Отправить", listing: "Фото объявления (номер скрыт)", handoff: "Передано менеджеру", cost: "Растаможка и итоговая стоимость — расчёт менеджера (manager_quote_required)" },
  en: { confirmed: "Confirmed findings", unconfirmed: "Unconfirmed — not supported by the verifier", trace: "Agent trace", delivery: "Delivery", report: "Report", chat: "Expert chat", ask: "Ask about this report…", send: "Send", listing: "Listing photo (plate hidden)", handoff: "Handed off to a manager", cost: "Customs / landed cost — manager quote required" },
} as const;

export function ReportView({ report, garage }: { report: Report; garage?: GarageData }) {
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [tab, setTab] = useState<"report" | "delivery">("report");
  const [chat, setChat] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const t = T[lang];
  const verified = report.findings.filter((f) => f.verified);
  const unconfirmed = report.findings.filter((f) => !f.verified);
  const bodyType = report.vehicle.bodyType ?? guessBodyType(report.vehicle.make, report.vehicle.model).type;
  const stage = isStageId(report.shipping?.stage) ? report.shipping.stage : "inspection";

  async function send() {
    if (!input.trim()) return;
    const msgs = [...chat, { role: "user", content: input }];
    setChat(msgs); setInput("");
    try {
      const res = await fetch("/api/expert/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.id, report, messages: msgs }) });
      const data = await res.json();
      setChat([...msgs, { role: "assistant", content: data.answer ?? data.error ?? "…" }]);
    } catch { setChat([...msgs, { role: "assistant", content: "chat unavailable" }]); }
  }

  const FindingCard = ({ f }: { f: Report["findings"][number] }) => (
    <div style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: 14 }}>
      <b>{lang === "ru" ? f.description_ru : f.description_en}</b>
      <div style={{ font: "12px monospace", color: "#8b94a1" }}>{f.panel} · {f.kind} · {f.severity} · conf {f.confidence.toFixed(2)}{f.conflict ? " · ⚠ conflict" : ""}</div>
      {f.evidence.map((e, i) => (
        <div key={i} style={{ fontSize: 13, color: "#c9cfd6", marginTop: 6 }}>
          {e.type === "transcript" && e.quote ? <>🎙 {e.tStart !== undefined ? `${Math.floor(e.tStart / 60)}:${String(Math.floor(e.tStart % 60)).padStart(2, "0")} ` : ""}«{e.quote}»</> : null}
          {e.type === "gauge" ? <>📏 {e.gaugeMicrons ? `${e.gaugeMicrons} µm` : e.quote ?? "gauge"}</> : null}
          {e.type === "obd" ? <>OBD: {e.quote}</> : null}
          {(e.type === "frame" || e.type === "mask") ? <>📷 {e.mediaId}{report.mediaUrls?.[e.mediaId] ? <> — <a style={{ color: "#c9a46a" }} href={report.mediaUrls[e.mediaId]}>plate-safe photo</a></> : ""}</> : null}
          {e.type === "auction_sheet" ? <>🇰🇷 {e.quote}</> : null}
        </div>
      ))}
      {f.verifierNote && <div style={{ fontSize: 12, color: f.verified ? "#4fb38a" : "#e3a33b", marginTop: 6 }}>Verifier: {f.verifierNote}</div>}
    </div>
  );

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20, color: "#e8ebee", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ font: "11px monospace", letterSpacing: ".12em", color: "#8b94a1" }}>HANBRIDGE INSPECTOR · {report.id}</div>
          <h1 style={{ margin: "6px 0" }}>{report.vehicle.year ?? ""} {report.vehicle.make} {report.vehicle.model}</h1>
        </div>
        <div>
          <button onClick={() => setLang("ru")} style={{ fontWeight: lang === "ru" ? 700 : 400 }}>RU</button>{" "}
          <button onClick={() => setLang("en")} style={{ fontWeight: lang === "en" ? 700 : 400 }}>EN</button>
        </div>
      </div>
      <div style={{ fontSize: 42, fontWeight: 800, color: report.verdict.decision === "BUY" ? "#4fb38a" : report.verdict.decision === "WALK_AWAY" ? "#e5544b" : "#e3a33b" }}>
        {report.verdict.decision.replace("_", " ")} <span style={{ fontSize: 16, color: "#8b94a1" }}>conf {report.verdict.confidence.toFixed(2)}</span>
      </div>
      {(report.verdict.handoff || report.handoffReason) && <p style={{ color: "#e3a33b" }}>{t.handoff}{report.handoffReason ? `: ${report.handoffReason}` : ""}</p>}
      <ul>{(lang === "ru" ? report.verdict.reasons_ru : report.verdict.reasons_en).map((r, i) => <li key={i}>{r}</li>)}</ul>
      <p style={{ color: "#8b94a1", fontSize: 13 }}>{t.cost}</p>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <button onClick={() => setTab("report")} style={{ fontWeight: tab === "report" ? 700 : 400 }}>{t.report}</button>
        <button onClick={() => setTab("delivery")} style={{ fontWeight: tab === "delivery" ? 700 : 400 }}>{t.delivery}</button>
      </div>
      {tab === "delivery" ? (
        <JourneyScene compact currentStage={stage} bodyType={bodyType} doors={report.vehicle.doors} lang={lang} reportSummary={{ findings: report.findings.length, confirmed: verified.length }} />
      ) : (<>
        {garage ? <div style={{ margin: "14px -20px", borderRadius: 8, overflow: "hidden" }}><GarageStudio data={garage} lang={lang} embedded /></div> : <InspectionMap report={report} lang={lang} mediaUrl={(id) => report.mediaUrls?.[id]} />}
        <h2>{t.confirmed} ({verified.length})</h2>
        <div style={{ display: "grid", gap: 10 }}>{verified.map((f) => <FindingCard key={f.id} f={f} />)}</div>
        <h2>{t.unconfirmed} ({unconfirmed.length})</h2>
        <div style={{ display: "grid", gap: 10, opacity: 0.75 }}>{unconfirmed.map((f) => <FindingCard key={f.id} f={f} />)}</div>
        {report.listingUrl && (<><h2>{t.listing}</h2>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={report.listingUrl} alt="listing" style={{ width: "100%", borderRadius: 12 }} /></>)}
        <h2>{t.trace} ({report.trace.length})</h2>
        <div style={{ display: "grid", gap: 6 }}>
          {report.trace.map((s, i) => (
            <div key={i} style={{ font: "12px monospace", color: "#c9cfd6", background: "#11141a", border: "1px solid #242a33", borderRadius: 8, padding: "8px 10px" }}>
              {s.ok === false ? "✗" : "✓"} <b>{s.tool}</b> {s.ms ?? 0}ms {s.why ? `— ${s.why}` : ""}<br /><span style={{ color: "#8b94a1" }}>{s.outputSummary ?? ""}</span>
            </div>
          ))}
        </div>
        <h2>{t.chat}</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {chat.map((m, i) => <div key={i} style={{ background: m.role === "user" ? "#161a21" : "#11141a", borderRadius: 10, padding: 10 }}>{m.content}</div>)}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.ask} style={{ flex: 1, padding: 10, borderRadius: 8, background: "#11141a", color: "#e8ebee", border: "1px solid #242a33" }} />
            <button onClick={send}>{t.send}</button>
          </div>
        </div>
      </>)}
    </main>
  );
}
