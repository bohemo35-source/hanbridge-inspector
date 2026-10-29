// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: /inspect/:carId — live agent trace (SSE) for a demo car, then link to /r/:id
// @created: 2026-10-29
"use client";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

type Step = { i?: number; tool: string; why?: string; argsSummary?: string; ms?: number; ok?: boolean; outputSummary?: string };

export default function InspectPage() {
  const { carId } = useParams<{ carId: string }>();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ url: string; reportId: string } | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function run() {
    if (started.current) return; started.current = true;
    setRunning(true); setSteps([]); setError("");
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
    setRunning(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24, color: "#e8ebee", fontFamily: "system-ui" }}>
      <p style={{ font: "11px monospace", letterSpacing: ".12em", color: "#8b94a1" }}>HANBRIDGE INSPECTOR · LIVE AGENT</p>
      <h1>{carId}</h1>
      <button onClick={run} disabled={running} style={{ padding: "10px 18px", borderRadius: 8, background: "#c9a46a", border: 0, fontWeight: 700, cursor: "pointer" }}>
        {running ? "Агент работает…" : "Запустить осмотр"}
      </button>
      {error && <p style={{ color: "#e5544b" }}>{error}</p>}
      <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
        {steps.map((s, k) => (
          <div key={k} style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: "10px 14px" }}>
            <b>{s.ok === false ? "✗" : "✓"} {s.tool}</b> <span style={{ color: "#8b94a1", font: "12px monospace" }}>{s.ms ?? 0} ms</span>
            {s.why && <div style={{ color: "#c9cfd6", fontSize: 13 }}>{s.why}</div>}
            {s.outputSummary && <div style={{ color: "#8b94a1", fontSize: 12 }}>{s.outputSummary}</div>}
          </div>
        ))}
      </div>
      {done && <p style={{ marginTop: 20 }}><a href={done.url} style={{ color: "#c9a46a", fontWeight: 700 }}>Открыть отчёт {done.reportId} →</a></p>}
    </main>
  );
}
