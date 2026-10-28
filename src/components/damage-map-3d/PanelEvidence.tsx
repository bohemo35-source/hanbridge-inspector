// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Side panel for the selected body panel: gauge scale, evidence list, verifier status
// @created: 2026-10-28
"use client";

import type { Evidence } from "@/lib/schema";
import { COLORS, panelLabel, PANEL_IDS, type PanelVisual } from "./panels";

const KIND_RU: Record<string, string> = { scratch: "Царапина", dent: "Вмятина", rust: "Коррозия", repaint: "Перекрас", putty: "Шпатлёвка", panel_replaced: "Замена панели", mechanical: "Механика", other: "Другое" };
const STATE_RU = { factory: "заводская краска", repaint: "перекрас", putty: "шпатлёвка / ремонт", unconfirmed: "находка не подтверждена", noData: "нет замера" } as const;
const STATE_EN = { factory: "factory paint", repaint: "repaint", putty: "filler / body repair", unconfirmed: "finding not confirmed", noData: "no reading" } as const;
const EV_ICON: Record<Evidence["type"], string> = { frame: "КАДР", mask: "SAM", transcript: "ГОЛОС", gauge: "мкм", auction_sheet: "KR" };

const fmtT = (s?: number) => (s === undefined ? "" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`);

function evidenceTitle(e: Evidence, lang: "en" | "ru") {
  switch (e.type) {
    case "gauge": return lang === "ru" ? "Толщиномер" : "Paint gauge";
    case "transcript": return `Muse Voice · ${fmtT(e.tStart)}–${fmtT(e.tEnd)}`;
    case "auction_sheet": return lang === "ru" ? "Аукционный лист · Muse Spark" : "Auction sheet · Muse Spark";
    case "mask": return `SAM 3.1 · ${lang === "ru" ? "кадр" : "frame"} ${e.mediaId}`;
    case "frame": return `${lang === "ru" ? "Кадр" : "Frame"} ${e.mediaId}`;
  }
}

export function PanelEvidence({ visual, lang = "ru", mediaUrl }: { visual: PanelVisual | null; lang?: "en" | "ru"; mediaUrl?: (mediaId: string) => string | undefined }) {
  if (!visual) {
    return (
      <div className="pe">
        <style>{PE_CSS}</style>
        <div className="pe-eyebrow">{lang === "ru" ? "Панель" : "Panel"}</div>
        <p className="pe-empty">{lang === "ru" ? "Нажми на панель на машине или на находку в списке." : "Tap a panel on the car or a finding in the list."}</p>
      </div>
    );
  }
  const idx = PANEL_IDS.indexOf(visual.panel) + 1;
  const pct = visual.microns !== undefined ? Math.min(100, (visual.microns / 300) * 100) : null;
  const stateText = (lang === "ru" ? STATE_RU : STATE_EN)[visual.state];
  const gaugeColor = visual.state === "unconfirmed" && visual.microns !== undefined ? (visual.microns <= 150 ? COLORS.factory : visual.microns <= 220 ? COLORS.repaint : COLORS.putty) : visual.color;
  return (
    <div className="pe" aria-live="polite">
      <style>{PE_CSS}</style>
      <div className="pe-head">
        <div>
          <div className="pe-eyebrow">{lang === "ru" ? "Панель" : "Panel"} {String(idx).padStart(2, "0")} / 13</div>
          <h2>{panelLabel(visual.panel, lang)}</h2>
        </div>
        <span className="pe-status" style={{ color: visual.findings.length ? visual.color : COLORS.factory }}>
          {visual.findings.length ? (lang === "ru" ? KIND_RU[visual.findings[0].kind] : visual.findings[0].kind) : lang === "ru" ? "норма" : "ok"}
        </span>
      </div>
      {pct !== null && (
        <div className="pe-gauge">
          <div className="pe-scale"><div className="pe-needle" style={{ left: `calc(${pct}% - 1px)` }} /></div>
          <div className="pe-ticks"><span>0</span><span>150</span><span>220</span><span>300 {lang === "ru" ? "мкм" : "µm"}</span></div>
          <div className="pe-val" style={{ color: gaugeColor }}>{visual.microns}<small>{lang === "ru" ? "мкм" : "µm"} · {stateText}</small></div>
        </div>
      )}
      {visual.findings.length === 0 && <p className="pe-empty">{lang === "ru" ? "Находок нет. Агент ничего не отметил на этой панели." : "No findings on this panel."}</p>}
      {visual.findings.map((f) => (
        <div key={f.id} className="pe-finding">
          <div className="pe-ftitle">{lang === "ru" ? f.description_ru : f.description_en} <span className="pe-conf">{f.confidence.toFixed(2)}</span></div>
          <div className="pe-ev">
            {f.evidence.map((e, i) => {
              const url = e.type === "frame" || e.type === "mask" ? mediaUrl?.(e.mediaId) : undefined;
              return (
                <div key={i} className="pe-ev-item">
                  <div className="pe-ico">{EV_ICON[e.type]}</div>
                  <div className="pe-ev-body">
                    <div className="pe-k">{evidenceTitle(e, lang)}</div>
                    {e.quote && <div className="pe-q">{e.type === "transcript" ? `«${e.quote}»` : e.quote}</div>}
                    {e.gaugeMicrons !== undefined && !e.quote && <div className="pe-q">{e.gaugeMicrons} {lang === "ru" ? "мкм" : "µm"}</div>}
                    {(e.type === "frame" || e.type === "mask") &&
                      (url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="pe-frame" src={url} alt={evidenceTitle(e, lang)} />
                      ) : (
                        <div className="pe-frame pe-frame-ph">{lang === "ru" ? "оригинальный кадр осмотра" : "original inspection frame"} · {e.mediaId}</div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pe-verifier" style={{ borderColor: f.verified ? COLORS.factory : COLORS.unconfirmed, color: f.verified ? COLORS.factory : COLORS.unconfirmed }}>
            <b>{f.verified ? "Verifier: " + (lang === "ru" ? "подтверждено" : "confirmed") : "Verifier: " + (lang === "ru" ? "не подтверждено" : "not confirmed")}</b>
            {f.verifierNote && <div>{f.verifierNote}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const PE_CSS = `
.pe{background:#11141a;border:1px solid #242a33;border-radius:12px;padding:16px;min-width:0;color:#e8ebee}
.pe-eyebrow{font:11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8b94a1}
.pe-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.pe-head h2{margin:2px 0 0;font-size:18px;font-weight:700}
.pe-status{font:11px ui-monospace,Menlo,monospace;padding:3px 8px;border-radius:6px;border:1px solid currentColor;white-space:nowrap}
.pe-gauge{margin-top:12px}
.pe-scale{position:relative;height:8px;border-radius:4px;background:linear-gradient(90deg,#4fb38a 0 50%,#e3a33b 50% 73.3%,#e5544b 73.3% 100%);opacity:.85}
.pe-needle{position:absolute;top:-5px;width:2px;height:18px;background:#e8ebee;border-radius:1px;transition:left .5s}
.pe-ticks{display:flex;justify-content:space-between;font:10px ui-monospace,Menlo,monospace;color:#5d6672;margin-top:4px}
.pe-val{font:700 28px ui-monospace,Menlo,monospace;margin-top:6px;font-variant-numeric:tabular-nums}
.pe-val small{font-size:12px;color:#8b94a1;font-weight:500;margin-left:6px}
.pe-empty{color:#8b94a1;font-size:13px;margin:12px 0 0}
.pe-finding{margin-top:14px;padding-top:12px;border-top:1px solid #242a33}
.pe-ftitle{font-weight:600;font-size:13.5px}
.pe-conf{font:11px ui-monospace,Menlo,monospace;color:#8b94a1;margin-left:6px}
.pe-ev{display:grid;gap:10px;margin-top:10px}
.pe-ev-item{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start}
.pe-ico{width:34px;height:26px;border-radius:7px;display:grid;place-items:center;background:#161a21;border:1px solid #242a33;font:9.5px ui-monospace,Menlo,monospace;color:#8b94a1}
.pe-ev-body{min-width:0}
.pe-k{font:11px ui-monospace,Menlo,monospace;color:#8b94a1}
.pe-q{margin-top:2px;color:#d6dbe0;font-size:13px}
.pe-frame{display:block;margin-top:6px;width:100%;border-radius:8px;border:1px solid #242a33}
.pe-frame-ph{aspect-ratio:16/7;display:grid;place-items:center;background:repeating-linear-gradient(135deg,#0e1116 0 10px,#12161c 10px 20px);color:#5d6672;font:11px ui-monospace,Menlo,monospace}
.pe-verifier{margin-top:12px;padding:10px 12px;border-radius:8px;font-size:12px;border:1px solid}
.pe-verifier div{color:#c9cfd6;margin-top:3px}
`;
