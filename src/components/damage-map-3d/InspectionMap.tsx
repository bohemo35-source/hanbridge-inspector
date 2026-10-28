// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Drop-in block for /r/:id: 3D map + selected-panel evidence + findings list (shared selection)
// @created: 2026-10-28
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Report } from "@/lib/schema";
import type { BodyType } from "./bodyTemplates";
import { guessBodyType } from "./bodyTypeMap";
import { allPanelVisuals, COLORS, isPanelId, panelLabel, type PanelId } from "./panels";
import { PanelEvidence } from "./PanelEvidence";

const DamageMap3D = dynamic(() => import("./DamageMap3D"), {
  ssr: false,
  loading: () => <div style={{ height: "min(78vh,760px)", minHeight: 420, borderRadius: 14, background: "#07080a", border: "1px solid #242a33" }} />,
});

export function InspectionMap({ report, lang = "ru", bodyTypeOverride, initialPanel, mediaUrl }: { report: Report; lang?: "en" | "ru"; bodyTypeOverride?: BodyType; initialPanel?: PanelId; mediaUrl?: (id: string) => string | undefined }) {
  const [selected, setSelected] = useState<PanelId | null>(initialPanel ?? null);
  const bodyType = bodyTypeOverride ?? report.vehicle.bodyType ?? guessBodyType(report.vehicle.make, report.vehicle.model).type;
  const visuals = useMemo(() => allPanelVisuals(report.paintReadings, report.findings), [report]);
  const selVisual = selected ? visuals.find((v) => v.panel === selected) ?? null : null;
  const findings = report.findings.filter((f) => isPanelId(f.panel));

  return (
    <div className="im">
      <style>{IM_CSS}</style>
      <div className="im-map">
        <DamageMap3D bodyType={bodyType} doors={report.vehicle.doors} readings={report.paintReadings} findings={report.findings} selected={selected} onSelect={setSelected} lang={lang} />
      </div>
      <aside className="im-side">
        <PanelEvidence visual={selVisual} lang={lang} mediaUrl={mediaUrl} />
        <div className="im-card">
          <div className="im-eyebrow">{lang === "ru" ? "Находки · клик открывает панель" : "Findings · tap to open the panel"}</div>
          <div className="im-list">
            {findings.map((f) => {
              const v = visuals.find((x) => x.panel === f.panel)!;
              const col = f.verified ? v.color : COLORS.unconfirmed;
              return (
                <button key={f.id} type="button" className={`im-f${f.verified ? "" : " im-unc"}`} aria-current={selected === f.panel} onClick={() => setSelected(f.panel as PanelId)}>
                  <span className="im-stripe" style={{ background: col }} />
                  <span>
                    <span className="im-t">{panelLabel(f.panel, lang)}</span>
                    <span className="im-d">{v.microns !== undefined ? `${v.microns} ${lang === "ru" ? "мкм" : "µm"} · ` : ""}{f.severity} · {f.confidence.toFixed(2)}</span>
                  </span>
                  <span className="im-s" style={{ color: f.verified ? COLORS.factory : COLORS.unconfirmed }}>{f.verified ? (lang === "ru" ? "✓ проверено" : "✓ verified") : lang === "ru" ? "✗ не подтв." : "✗ unconfirmed"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

const IM_CSS = `
.im{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:980px){.im{grid-template-columns:minmax(0,1fr)}}
.im-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.im-card{background:#11141a;border:1px solid #242a33;border-radius:12px;padding:16px}
.im-eyebrow{font:11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8b94a1}
.im-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.im-f{display:grid;grid-template-columns:4px 1fr auto;gap:10px;align-items:center;text-align:left;background:#161a21;border:1px solid #242a33;border-radius:8px;padding:9px 10px 9px 0;cursor:pointer;width:100%;color:#e8ebee}
.im-f:hover{border-color:#384150}
.im-f[aria-current="true"]{border-color:#c9a46a}
.im-stripe{align-self:stretch;border-radius:0 3px 3px 0}
.im-t{display:block;font-weight:600;font-size:13px}
.im-unc .im-t{text-decoration:line-through;text-decoration-color:rgba(255,255,255,.35)}
.im-d{display:block;font:12px ui-monospace,Menlo,monospace;color:#8b94a1}
.im-s{font:11px ui-monospace,Menlo,monospace;padding:3px 8px;border:1px solid currentColor;border-radius:6px;white-space:nowrap}
`;
