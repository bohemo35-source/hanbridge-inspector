// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /inspect/:carId — live agent trace (SSE) for a demo car, then link to /r/:id
// @created: 2026-10-29
// @updated: 2026-11-01 claude-code — Meta model badge on every step, elapsed timer, link to last report while waiting
"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Step = { i?: number; tool: string; why?: string; argsSummary?: string; ms?: number; ok?: boolean; outputSummary?: string };

// Which Meta model does the work behind each agent tool (orchestrator.ts / tools/*).
const MODEL_OF: Record<string, string[]> = {
  index_photos: ["Muse Glimmer · open-weight · index built once per car"],
  read_diagnostic_report: ["Muse Spark"],
  read_inspector_report: ["Muse Spark"],
  find_defects: ["SAM 3.1", "Muse Spark"],
  transcribe_note: ["Muse Voice Transcribe", "Muse Spark"],
  read_gauge_video: ["Muse Spark"],
  analyze_paint_readings: ["rules"],
  estimate_landed_cost: ["manager quote"],
  make_listing_photo: ["SAM 3.1", "Muse Image"],
  finalize_report: ["Muse Spark"],
  verifier: ["Muse Spark Open · Baseten"],
  sparkChat: ["Muse Spark"],
};

const L = {
  en: { run: "Run the inspection", running: "Agent is working…", note: "A full live run takes about 1–2 minutes. Every step below is a real call to a Meta model, except the photo index: Muse Glimmer builds it once per car and the agent reuses it.", open: "Open report", elapsed: "elapsed" },
  ru: { run: "Запустить осмотр", running: "Агент работает…", note: "Полный живой прогон идёт 1–2 минуты. Каждый шаг ниже — настоящий вызов модели Meta, кроме индекса фото: его один раз на машину строит Muse Glimmer, агент переиспользует.", open: "Открыть отчёт", elapsed: "прошло" },
};

export default function InspectPage() {
  const { carId } = useParams<{ carId: string }>();
  const lang = useSearchParams().get("lang") === "ru" ? "ru" : "en";
  const t = L[lang];
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ url: string; reportId: string; verdict?: { decision: string } } | null>(null);
  const [error, setError] = useState("");
  const [t0, setT0] = useState(0);
  const [now, setNow] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function run() {
    if (started.current) return; started.current = true;
    setRunning(true); setSteps([]); setError(""); setT0(Date.now()); setNow(Date.now());
    try {
      const res = await fetch(`/api/inspections/${carId}/run`, { method: "POST" });
      const reader = res.body!.getReader(); const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done: end, value } = await reader.read(); if (end) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split("\n\n"); buf = blocks.pop() ?? "";
        for (const b of blocks) {
          const ev = b.match(/event: (\w+)/)?.[1]; const data = b.match(/data: (.*)/s)?.[1];
          if (!ev || !data) continue;
          const parsed = JSON.parse(data);
          if (ev === "step") setSteps((p) => [...p, parsed]);
          if (ev === "done") setDone(parsed);
          if (ev === "error") setError(parsed.error);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    setRunning(false); started.current = false;
  }

  const sec = t0 ? Math.round(((running ? now : now || Date.now()) - t0) / 1000) : 0;
  const q = lang === "ru" ? "?lang=ru" : "";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24, color: "#e8ebee", fontFamily: "system-ui" }}>
      <p style={{ font: "11px monospace", letterSpacing: ".12em", color: "#8b94a1" }}><a href={`/${q}`} style={{ color: "#8b94a1" }}>HANBRIDGE INSPECTOR</a> · LIVE AGENT</p>
      <h1 style={{ marginBottom: 6 }}>{carId}</h1>
      <p style={{ color: "#8b94a1", fontSize: 14, marginTop: 0 }}>{t.note}</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={run} disabled={running} style={{ padding: "10px 18px", borderRadius: 8, background: "#c9a46a", border: 0, fontWeight: 700, cursor: running ? "default" : "pointer" }}>
          {running ? t.running : t.run}
        </button>
        {t0 > 0 && <span style={{ font: "13px monospace", color: "#8b94a1" }}>{t.elapsed} {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>}
      </div>
      {error && <p style={{ color: "#e5544b" }}>{error}</p>}
      <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
        {steps.map((s, k) => (
          <div key={k} style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{s.ok === false ? "✗" : "✓"} {s.tool}</b>
              {(MODEL_OF[s.tool] ?? []).map((m) => (
                <span key={m} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#1b2230", color: "#9fb4ff", border: "1px solid #2c3a55" }}>{m}</span>
              ))}
              <span style={{ color: "#8b94a1", font: "12px monospace", marginLeft: "auto" }}>{((s.ms ?? 0) / 1000).toFixed(1)} s</span>
            </div>
            {s.why && <div style={{ color: "#c9cfd6", fontSize: 13, marginTop: 4 }}>{s.why}</div>}
            {s.outputSummary && <div style={{ color: "#8b94a1", fontSize: 12, marginTop: 2, wordBreak: "break-word" }}>{s.outputSummary}</div>}
          </div>
        ))}
      </div>
      {done && (
        <p style={{ marginTop: 20 }}>
          {done.verdict?.decision && <b style={{ marginRight: 10 }}>{done.verdict.decision.replace("_", " ")}</b>}
          <a href={`${done.url}${q}`} style={{ color: "#c9a46a", fontWeight: 700 }}>{t.open} {done.reportId} →</a>
        </p>
      )}
    </main>
  );
}
