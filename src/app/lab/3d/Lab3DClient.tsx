// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Client part of /lab/3d: body template switch + InspectionMap on the demo report
// @created: 2026-10-28
"use client";

import { useState } from "react";
import { BODY_TYPES, type BodyType } from "@/components/damage-map-3d/bodyTemplates";
import { InspectionMap } from "@/components/damage-map-3d/InspectionMap";
import { DEMO_REPORT } from "@/components/damage-map-3d/fixtures/demoReport";

const LABEL: Record<BodyType, string> = { sedan: "Седан", suv: "SUV", hatchback: "Хэтчбек" };

export default function Lab3DClient() {
  const [type, setType] = useState<BodyType>("sedan");
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const v = DEMO_REPORT.verdict;
  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "14px max(16px, env(safe-area-inset-right)) 40px max(16px, env(safe-area-inset-left))", display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", paddingBottom: 12, borderBottom: "1px solid #242a33" }}>
        <b style={{ letterSpacing: ".02em" }}>Hanbridge Inspector</b>
        <span style={{ font: "12px ui-monospace,Menlo,monospace", color: "#8b94a1" }}>/lab/3d · demo data</span>
        <span style={{ flex: 1 }} />
        <div role="group" aria-label="Body template" style={{ display: "flex", gap: 6 }}>
          {BODY_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t} style={btn(type === t)}>
              {LABEL[t]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setLang(lang === "ru" ? "en" : "ru")} style={btn(false)}>
          {lang === "ru" ? "EN" : "RU"}
        </button>
      </header>
      <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: ".04em", color: "#e3a33b", border: "1.5px solid #e3a33b", borderRadius: 8, padding: "5px 10px" }}>{v.decision}</span>
        <span style={{ color: "#c9cfd6", fontSize: 14 }}>{(lang === "ru" ? v.reasons_ru : v.reasons_en).join(" ")}</span>
        <span style={{ font: "12px ui-monospace,Menlo,monospace", color: "#8b94a1" }}>
          {lang === "ru" ? "уверенность" : "confidence"} {v.confidence.toFixed(2)} · {lang === "ru" ? "стоимость: посчитает менеджер" : "cost: manager quote required"}
        </span>
      </section>
      <InspectionMap key={type} report={DEMO_REPORT} lang={lang} bodyTypeOverride={type} initialPanel="front_right_fender" />
    </main>
  );
}

const btn = (on: boolean): React.CSSProperties => ({
  background: "#11141a",
  border: `1px solid ${on ? "#c9a46a" : "#242a33"}`,
  color: on ? "#c9a46a" : "#e8ebee",
  borderRadius: 8,
  padding: "6px 11px",
  fontSize: 12,
  cursor: "pointer",
});
