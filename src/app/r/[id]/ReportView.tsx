// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Public report view ("personal cabinet"): verdict, garage studio / InspectionMap, findings/Unconfirmed, listing, agent trace, chat, delivery tab (EN/RU)
// @created: 2026-10-29
// @updated: 2026-11-02 claude-code — garage studio (one neutral 3D car, panels from this report, real photos) replaces the parametric map when the car has a photo index
// @updated: 2026-11-02 claude-code — film v4 design: display/mono type, sodium palette, evidence chips, model badges in the agent trace, ?lang= on load
// @updated: 2026-11-03 claude-code — «open the car's garage» only for catalog cars (uploads have no /garage page); «Not confirmed» without «by the verifier» (an owner-typed reading never reaches it)
"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Report } from "@/lib/schema";
import type { GarageData } from "@/lib/garage/data";
import { panelLabel } from "@/lib/domain/panels";
import { InspectionMap } from "@/components/damage-map-3d/InspectionMap";
import { guessBodyType } from "@/components/damage-map-3d/bodyTypeMap";
import { isStageId } from "@/components/journey-3d/route";

const JourneyScene = dynamic(() => import("@/components/journey-3d/JourneyScene"), { ssr: false });
const GarageStudio = dynamic(() => import("@/components/garage-studio/GarageStudio"), { ssr: false });

type Lang = "ru" | "en";
const T = {
  ru: { kicker: "Отчёт осмотра", confirmed: "Подтверждённые находки", unconfirmed: "Не подтверждены", trace: "Как работал агент", delivery: "Доставка", report: "Отчёт", chat: "Спросить эксперта", ask: "Спросить по этому отчёту…", send: "Отправить", listing: "Фото для объявления · номер скрыт", handoff: "Передано менеджеру", cost: "Растаможка и итоговая стоимость — расчёт менеджера.", conf: "уверенность", none: "Нет", verifier: "Проверка", steps: "шагов", garage: "Открыть гараж авто ↗", photo: "кадр", voice: "голос", gauge: "толщиномер", sheet: "аукционный лист", empty: "Задайте вопрос — ответ строится только по этому отчёту." },
  en: { kicker: "Inspection report", confirmed: "Confirmed findings", unconfirmed: "Not confirmed", trace: "How the agent worked", delivery: "Delivery", report: "Report", chat: "Ask the expert", ask: "Ask about this report…", send: "Send", listing: "Listing photo · plate hidden", handoff: "Handed off to a manager", cost: "Customs and landed cost — quoted by a manager.", conf: "confidence", none: "None", verifier: "Verifier", steps: "steps", garage: "Open the car's garage ↗", photo: "frame", voice: "voice", gauge: "gauge", sheet: "auction sheet", empty: "Ask a question — the answer is built from this report only." },
} as const;
const KIND: Record<string, [string, string]> = { repaint: ["Repainted", "Перекрас"], putty: ["Filler under the paint", "Шпатлёвка под краской"], panel_replaced: ["Panel replaced", "Деталь заменена"], dent: ["Dent", "Вмятина"], scratch: ["Scratch", "Царапина"], rust: ["Rust", "Ржавчина"], mechanical: ["Mechanical", "Механика"], other: ["Note", "Замечание"] };
/** which Meta model stands behind each agent tool (as in the agent's code) */
const TOOL_MODEL: Record<string, string> = { // same map as the live run page (/inspect/[carId])
  index_photos: "Muse Glimmer", read_diagnostic_report: "Muse Spark", read_inspector_report: "Muse Spark", find_defects: "SAM 3.1 + Muse Spark",
  transcribe_note: "Muse Voice Transcribe + Muse Spark", read_gauge_video: "Muse Spark", analyze_paint_readings: "rules", estimate_landed_cost: "manager quote",
  make_listing_photo: "SAM 3.1 + Muse Image", finalize_report: "Muse Spark", verifier: "Muse Spark Open", recheck_panel: "Glimmer index + SAM 3.1 + Muse Spark",
  context_check: "rules", conflict_check: "rules",
};
const dColor = (d: string) => (d === "BUY" ? "var(--ok)" : d === "WALK_AWAY" ? "var(--bad)" : "var(--sodium)");
const tc = (t?: number) => (t === undefined ? "" : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} `);

export function ReportView({ report, garage, initialLang }: { report: Report; garage?: GarageData; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang ?? "ru");
  const [tab, setTab] = useState<"report" | "delivery">("report");
  const [chat, setChat] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const t = T[lang];
  const verified = report.findings.filter((f) => f.verified);
  const unconfirmed = report.findings.filter((f) => !f.verified);
  const bodyType = report.vehicle.bodyType ?? guessBodyType(report.vehicle.make, report.vehicle.model).type;
  const stage = isStageId(report.shipping?.stage) ? report.shipping.stage : "inspection";
  const dec = report.verdict.decision;

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
    <article className="rounded-[6px] border border-bone/10 bg-ink-2 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[.18em] text-sodium">{panelLabel(f.panel, lang)}</span>
        <span className={`font-mono text-[9.5px] uppercase tracking-[.16em] ${f.verified ? "text-ok" : "text-mist"}`}>{f.severity} · {t.conf} {f.confidence.toFixed(2)}{f.conflict ? " · ⚠" : ""}</span>
      </div>
      <h3 className="mt-1.5 font-display text-[26px] font-medium leading-tight">{KIND[f.kind]?.[lang === "ru" ? 1 : 0] ?? f.kind}</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-bone-2">{lang === "ru" ? f.description_ru : f.description_en}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {f.evidence.map((e, i) => {
          const url = report.mediaUrls?.[e.mediaId];
          if (e.type === "transcript" && e.quote) return <p key={i} className="w-full border-l-2 border-sodium/50 pl-3 text-[13px] italic leading-snug text-bone-2"><span className="mr-1.5 font-mono text-[9.5px] not-italic uppercase tracking-[.16em] text-sodium">{t.voice} {tc(e.tStart)}</span>«{e.quote}»</p>;
          if (e.type === "gauge") return <span key={i} className="rounded-full border border-bone/15 px-3 py-1 font-mono text-[11px] text-bone">{t.gauge} · {e.gaugeMicrons ? `${e.gaugeMicrons} µm` : e.quote ?? ""}</span>;
          if (e.type === "obd") return <span key={i} className="rounded-full border border-bone/15 px-3 py-1 font-mono text-[11px] text-bone">OBD · {e.quote}</span>;
          if (e.type === "auction_sheet") return <span key={i} className="rounded-full border border-bone/15 px-3 py-1 font-mono text-[11px] text-bone">{t.sheet} · {e.quote}</span>;
          if ((e.type === "frame" || e.type === "mask") && url) return (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="group relative block h-20 w-28 overflow-hidden rounded-[3px] border border-bone/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={e.mediaId} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-1.5 font-mono text-[8.5px] uppercase tracking-[.12em] text-sodium-hi">{t.photo} · {e.mediaId}</span>
            </a>);
          if (e.type === "frame" || e.type === "mask") return <span key={i} className="rounded-full border border-bone/15 px-3 py-1 font-mono text-[11px] text-bone-2">{t.photo} · {e.mediaId}</span>;
          return null;
        })}
      </div>
      {f.verifierNote && <p className={`mt-3 border-t border-bone/10 pt-3 text-[12.5px] leading-snug ${f.verified ? "text-ok" : "text-mist"}`}><span className="font-mono text-[9.5px] uppercase tracking-[.16em]">{t.verifier} · Muse Spark Open</span><br />{f.verifierNote}</p>}
    </article>
  );

  return (
    <main className="min-h-screen bg-ink text-bone">
      <header className="mx-auto flex max-w-[1220px] flex-wrap items-center justify-between gap-3 border-b border-bone/10 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <a href={`/${lang === "ru" ? "?lang=ru" : ""}`} className="font-display text-[17px] font-semibold uppercase tracking-[.42em]">Hanbridge</a>
          <span className="hidden font-mono text-[10.5px] uppercase tracking-[.2em] text-mist sm:inline">{t.kicker} · {report.id}</span>
        </div>
        <nav className="flex gap-4 font-mono text-[11px] uppercase tracking-[.2em]">
          {(["ru", "en"] as const).map((l) => <button key={l} onClick={() => setLang(l)} className={lang === l ? "text-bone" : "text-mist hover:text-bone"}>{l.toUpperCase()}</button>)}
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1220px] gap-6 px-5 pb-8 pt-10 sm:px-8 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[.3em] text-sodium">{report.vehicle.year ?? ""} · {report.vehicle.make}{report.vehicle.mileageKm ? ` · ${report.vehicle.mileageKm.toLocaleString(lang === "ru" ? "ru-RU" : "en-US")} km` : ""}</div>
          <h1 className="mt-3 font-display text-[clamp(40px,6vw,80px)] font-medium leading-[.95]">{report.vehicle.make} {report.vehicle.model}</h1>
          <ul className="mt-5 space-y-1.5">{(lang === "ru" ? report.verdict.reasons_ru : report.verdict.reasons_en).map((r, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-bone-2"><span className="mt-[2px] font-mono text-[10px] text-sodium">—</span>{r}</li>)}</ul>
        </div>
        <div className="md:text-right">
          <div className="inline-block border-2 px-6 py-3 font-mono text-[clamp(26px,3.4vw,40px)] font-medium uppercase tracking-[.18em]" style={{ color: dColor(dec), borderColor: dColor(dec), boxShadow: `0 0 50px color-mix(in srgb, ${dColor(dec)} 25%, transparent)` }}>{dec.replace("_", " ")}</div>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[.18em] text-mist">{t.conf} {report.verdict.confidence.toFixed(2)} · {verified.length}/{report.findings.length} {lang === "ru" ? "подтверждено" : "verified"}</div>
          {(report.verdict.handoff || report.handoffReason) && <p className="mt-2 text-[13px] text-warn">{t.handoff}{report.handoffReason ? `: ${report.handoffReason}` : ""}</p>}
          <p className="mt-2 text-[12.5px] text-mist">{t.cost}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1220px] gap-1 px-5 sm:px-8">
        {(["report", "delivery"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[.2em] ${tab === k ? "bg-bone text-ink" : "border border-bone/20 text-bone-2 hover:border-sodium"}`}>{k === "report" ? t.report : t.delivery}</button>
        ))}
        {garage && garage.photoTotal > 0 && <a href={`/garage/${garage.carId}${lang === "ru" ? "?lang=ru" : ""}`} className="ml-auto self-center font-mono text-[11px] uppercase tracking-[.2em] text-sodium-hi hover:text-sodium">{t.garage}</a>}
      </div>

      {tab === "delivery" ? (
        <div className="mx-auto max-w-[1220px] px-5 py-8 sm:px-8">
          <JourneyScene compact currentStage={stage} bodyType={bodyType} doors={report.vehicle.doors} lang={lang} reportSummary={{ findings: report.findings.length, confirmed: verified.length }} />
        </div>
      ) : (<>
        <div className="mt-6">{garage ? <GarageStudio data={garage} lang={lang} embedded /> : <div className="mx-auto max-w-[1220px] px-5 sm:px-8"><InspectionMap report={report} lang={lang} mediaUrl={(id) => report.mediaUrls?.[id]} /></div>}</div>

        <div className="mx-auto grid max-w-[1220px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0 space-y-10">
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[.3em] text-sodium">{t.confirmed} · {verified.length}</h2>
              <div className="grid gap-3">{verified.length ? verified.map((f) => <FindingCard key={f.id} f={f} />) : <p className="text-bone-2">{t.none}</p>}</div>
            </section>
            {unconfirmed.length > 0 && <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[.3em] text-mist">{t.unconfirmed} · {unconfirmed.length}</h2>
              <div className="grid gap-3 opacity-80">{unconfirmed.map((f) => <FindingCard key={f.id} f={f} />)}</div>
            </section>}
          </div>

          <div className="min-w-0 space-y-10">
            {report.listingUrl && <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[.3em] text-mist">{t.listing}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.listingUrl} alt="listing" className="w-full rounded-[6px] border border-bone/10" />
            </section>}

            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[.3em] text-mist">{t.trace} · {report.trace.length} {t.steps}</h2>
              <ol className="relative space-y-0 border-l border-bone/12 pl-5">
                {report.trace.map((s, i) => (
                  <li key={i} className="relative pb-4">
                    <i className={`absolute -left-[25px] top-[5px] h-2 w-2 rounded-full ${s.ok === false ? "bg-bad" : "bg-sodium"}`} />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[12px] text-bone">{s.tool}</span>
                      {(s.model || TOOL_MODEL[s.tool]) && <span className="rounded-[2px] border border-signal/40 px-1.5 font-mono text-[9.5px] uppercase tracking-[.12em] text-signal">{s.model ?? TOOL_MODEL[s.tool]}</span>}
                      <span className="font-mono text-[10px] text-mist">{((s.ms ?? 0) / 1000).toFixed(1)} s</span>
                    </div>
                    {s.why && <p className="mt-0.5 text-[12.5px] italic leading-snug text-bone-2">{s.why}</p>}
                    {s.outputSummary && <p className="mt-0.5 break-all font-mono text-[10.5px] leading-snug text-mist">{s.outputSummary.slice(0, 220)}</p>}
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[.3em] text-mist">{t.chat}</h2>
              <div className="space-y-2">
                {!chat.length && <p className="text-[13px] text-mist">{t.empty}</p>}
                {chat.map((m, i) => <div key={i} className={`rounded-[6px] px-4 py-3 text-[14px] leading-relaxed ${m.role === "user" ? "ml-8 bg-ink-3 text-bone" : "border border-bone/10 bg-ink-2 text-bone-2"}`}>{m.content}</div>)}
                <div className="flex gap-2 pt-1">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.ask}
                    className="flex-1 rounded-full border border-bone/15 bg-ink-2 px-4 py-2.5 text-[14px] text-bone outline-none placeholder:text-mist focus:border-sodium" />
                  <button onClick={send} className="rounded-full bg-sodium px-5 py-2.5 font-mono text-[11px] uppercase tracking-[.18em] text-ink">{t.send}</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </>)}
    </main>
  );
}
