// @agent:   claude
// @project: hanbridge-inspector
// @purpose: /inspect/new — "check your own car": visitor adds 3–10 photos (+ optional paint-gauge numbers), the same agent runs live.
//           Photos are resized in the browser (≤1280 px) and sent in one request; they are not stored — only the report and a plate-hidden listing photo are.
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code — video note: the gauge screen must be in the frame (owner decision: a readable matching screen confirms)
// @updated: 2026-11-03 claude-code — optional video (straight to Vercel Blob from the browser, deleted after the run); gauge hint: photo signs of repaint need gauge numbers
// @updated: 2026-11-04 claude-code — honest wait: expected time (about 1.5–2 min), elapsed seconds and the current step (EN/RU) while the agent runs
"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { stepLabel } from "./stepLabel";

type Step = { i?: number; tool: string; why?: string; ms?: number; ok?: boolean; outputSummary?: string };
const MODEL_OF: Record<string, string[]> = {
  index_photos: ["Muse Glimmer · open-weight · live"], find_defects: ["SAM 3.1", "Muse Spark"], recheck_panel: ["Glimmer index", "SAM 3.1", "Muse Spark"],
  analyze_paint_readings: ["rules"], estimate_landed_cost: ["manager quote"], make_listing_photo: ["SAM 3.1", "Muse Image"],
  finalize_report: ["Muse Spark"], verifier: ["Muse Spark Open · Baseten"], segment_image: ["SAM 3.1"],
};
const PANELS: [string, string, string][] = [
  ["hood", "Hood", "Капот"], ["roof", "Roof", "Крыша"], ["trunk", "Trunk", "Багажник"], ["front_bumper", "Front bumper", "Передний бампер"], ["rear_bumper", "Rear bumper", "Задний бампер"],
  ["front_left_fender", "Front left fender", "Крыло пер. лев."], ["front_right_fender", "Front right fender", "Крыло пер. прав."], ["rear_left_fender", "Rear left fender", "Крыло зад. лев."], ["rear_right_fender", "Rear right fender", "Крыло зад. прав."],
  ["front_left_door", "Front left door", "Дверь пер. лев."], ["front_right_door", "Front right door", "Дверь пер. прав."], ["rear_left_door", "Rear left door", "Дверь зад. лев."], ["rear_right_door", "Rear right door", "Дверь зад. прав."],
];
const T = {
  en: { title: "Check your own car", sub: "Add 3–10 walk-around photos (whole car from 4 corners works best). Optional: paint-gauge readings. The same agent inspects it live in about 1–2 minutes.",
    make: "Make", model: "Model", year: "Year", body: "Body", photos: "Photos (3–10)", paint: "Paint gauge, µm (optional)", go: "Inspect", busy: "Agent is working…",
    privacy: "Photos are processed for this inspection only and are not stored. The report and one listing photo with the plate hidden are published at a public link. Do not upload photos of people or documents.",
    open: "Open report", need: "Fill make, model, year and add 3–10 photos.", prep: "Preparing photos…", back: "Demo cars",
    video: "Video with your voice (optional, ≤150 MB)", videoNote: "Keep the gauge screen in the frame and say each reading aloud («hood 110, left fender 240»): a number counts as confirmed only where the screen shows the same. The first 3 min are used; the video goes to temporary storage and is deleted right after the inspection.",
    upVideo: "Uploading video", videoBig: "Video must be under 150 MB.",
    gaugeHint: "Photos can show signs of repaint (shade, gloss, overspray, gaps) but not paint thickness. Such signs go to «Not confirmed» and a manager checks them — add gauge numbers to confirm.",
    eta: "Usually about 1.5–2 min (a few minutes with a long video). Keep this page open.", now: "now", elapsed: "s" },
  ru: { title: "Проверить свою машину", sub: "Добавьте 3–10 фото обхода (лучше всего машина целиком с 4 углов). Можно указать замеры толщиномера. Тот же агент осмотрит машину вживую за 1–2 минуты.",
    make: "Марка", model: "Модель", year: "Год", body: "Кузов", photos: "Фото (3–10)", paint: "Толщиномер, мкм (необязательно)", go: "Осмотреть", busy: "Агент работает…",
    privacy: "Фото используются только для этого осмотра и не сохраняются. По публичной ссылке публикуются отчёт и одно фото для объявления со скрытым номером. Не загружайте фото людей и документов.",
    open: "Открыть отчёт", need: "Заполните марку, модель, год и добавьте 3–10 фото.", prep: "Готовлю фото…", back: "Демо-машины",
    video: "Видео с голосом (необязательно, до 150 МБ)", videoNote: "Держите экран толщиномера в кадре и называйте замеры вслух («капот 110, левое крыло 240»): цифра подтверждается, только если экран показывает то же самое. Используются первые 3 мин; видео попадает во временное хранилище и удаляется сразу после осмотра.",
    upVideo: "Загружаю видео", videoBig: "Видео должно быть меньше 150 МБ.",
    gaugeHint: "По фото видны признаки окраса (оттенок, блеск, напыл, зазоры), но не толщина краски. Такие признаки идут в «Не подтверждено», их проверит менеджер — добавьте замеры толщиномера, чтобы подтвердить.",
    eta: "Обычно около 1,5–2 мин (с длинным видео — несколько минут). Не закрывайте страницу.", now: "сейчас", elapsed: "с" },
};

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", 0.82));
}

function NewInspection() {
  const lang = useSearchParams().get("lang") === "ru" ? "ru" : "en";
  const t = T[lang]; const q = lang === "ru" ? "?lang=ru" : "";
  const [files, setFiles] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [status, setStatus] = useState(""); const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [t0, setT0] = useState(0); const [, tick] = useState(0);
  useEffect(() => { if (!busy) return; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, [busy]);
  const [done, setDone] = useState<{ url: string; reportId: string; verdict?: { decision: string } } | null>(null);
  // wake the open-weight Glimmer GPU while the form is being filled (cold start takes 1–3 min)
  useEffect(() => { fetch("/api/glimmer-warm").catch(() => undefined); }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setDone(null); setSteps([]);
    const fd0 = new FormData(e.currentTarget);
    if (!fd0.get("make") || !fd0.get("model") || !fd0.get("year") || files.length < 3 || files.length > 10) { setError(t.need); return; }
    if (video && video.size > 150 * 1024 * 1024) { setError(t.videoBig); return; }
    setBusy(true); setT0(Date.now()); setStatus(t.prep);
    try {
      const fd = new FormData();
      for (const [k, v] of fd0.entries()) if (k !== "photos" && k !== "video" && String(v).trim()) fd.append(k, v);
      for (const [i, f] of files.entries()) fd.append("photos", await shrink(f), `photo-${i + 1}.jpg`);
      // the video goes from the browser straight to Vercel Blob (a function body is capped at 4.5 MB); the run gets its URL
      if (video) {
        setStatus(`${t.upVideo}…`);
        const ext = (video.name.match(/\.(mp4|mov|m4v|webm|3gp)$/i)?.[1] ?? "mp4").toLowerCase();
        const b = await upload(`uploads/video-${Date.now().toString(36)}.${ext}`, video, {
          access: "public", handleUploadUrl: "/api/blob-upload", multipart: video.size > 20 * 1024 * 1024,
          onUploadProgress: (p) => setStatus(`${t.upVideo} ${Math.round(p.percentage)}%`),
        });
        fd.append("videoUrl", b.url);
      }
      setStatus(t.busy);
      const res = await fetch("/api/upload-run", { method: "POST", body: fd });
      if (!res.ok || !res.body) { setError((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`); setBusy(false); return; }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done: end, value } = await reader.read(); if (end) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split("\n\n"); buf = blocks.pop() ?? "";
        for (const b of blocks) {
          const ev = b.match(/event: (\w+)/)?.[1]; const data = b.match(/data: (.*)/s)?.[1]; if (!ev || !data) continue;
          const p = JSON.parse(data);
          if (ev === "step") setSteps((s) => [...s, p]);
          if (ev === "done") setDone(p);
          if (ev === "error") setError(p.error);
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "failed"); }
    setBusy(false); setStatus("");
  }

  const input = { background: "#11141a", border: "1px solid #2a313c", borderRadius: 8, color: "#e8ebee", padding: "9px 10px", fontSize: 15, width: "100%" } as const;
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24, color: "#e8ebee", fontFamily: "system-ui" }}>
      <p style={{ font: "11px monospace", letterSpacing: ".12em", color: "#8b94a1" }}><a href={`/${q}`} style={{ color: "#8b94a1" }}>HANBRIDGE INSPECTOR</a> · {t.back.toUpperCase()}</p>
      <h1 style={{ marginBottom: 6 }}>{t.title}</h1>
      <p style={{ color: "#c9cfd6", marginTop: 0 }}>{t.sub}</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <label>{t.make}<input name="make" maxLength={40} style={input} placeholder="Hyundai" /></label>
          <label>{t.model}<input name="model" maxLength={40} style={input} placeholder="Sonata" /></label>
          <label>{t.year}<input name="year" type="number" min={1990} max={2027} style={input} placeholder="2021" /></label>
          <label>{t.body}<select name="bodyType" style={input} defaultValue="sedan"><option value="sedan">sedan</option><option value="suv">SUV</option><option value="hatchback">hatchback</option></select></label>
        </div>
        <label>{t.photos}<input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 10))} style={{ ...input, padding: 8 }} /></label>
        {files.length > 0 && <p style={{ margin: 0, color: "#8b94a1", fontSize: 13 }}>{files.length} / 10</p>}
        <label>{t.video}<input name="video" type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} style={{ ...input, padding: 8 }} /></label>
        <p style={{ margin: "-6px 0 0", color: "#8b94a1", fontSize: 12 }}>{t.videoNote}</p>
        <p style={{ margin: 0, color: "#c9cfd6", fontSize: 13, borderLeft: "2px solid #c9a46a", paddingLeft: 10 }}>{t.gaugeHint}</p>
        <details><summary style={{ cursor: "pointer", color: "#c9a46a" }}>{t.paint}</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}>
            {PANELS.map(([id, en, ru]) => <label key={id} style={{ fontSize: 13 }}>{lang === "ru" ? ru : en}<input name={`paint_${id}`} type="number" min={20} max={3000} style={input} /></label>)}
          </div>
        </details>
        <p style={{ fontSize: 12, color: "#8b94a1", margin: 0 }}>{t.privacy}</p>
        <button disabled={busy} style={{ padding: "11px 18px", borderRadius: 8, background: "#c9a46a", border: 0, fontWeight: 700, cursor: busy ? "default" : "pointer", justifySelf: "start" }}>{busy ? status || t.busy : t.go}</button>
      </form>
      {busy && (
        <p style={{ margin: "14px 0 0", color: "#c9cfd6", fontSize: 13, borderLeft: "2px solid #9fb4ff", paddingLeft: 10 }}>
          {t.eta} <span style={{ font: "12px monospace", color: "#8b94a1" }}>{Math.round((Date.now() - t0) / 1000)} {t.elapsed}</span>
          {status === t.busy && <><br />{t.now}: {stepLabel(steps.at(-1)?.tool, lang)}</>}
        </p>
      )}
      {error && <p style={{ color: "#e5544b" }}>{error}</p>}
      <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
        {steps.map((s, k) => (
          <div key={k} style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{s.ok === false ? "✗" : "✓"} {s.tool}</b>
              {(MODEL_OF[s.tool] ?? []).map((m) => <span key={m} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#1b2230", color: "#9fb4ff", border: "1px solid #2c3a55" }}>{m}</span>)}
              <span style={{ color: "#8b94a1", font: "12px monospace", marginLeft: "auto" }}>{((s.ms ?? 0) / 1000).toFixed(1)} s</span>
            </div>
            {s.why && <div style={{ color: "#c9cfd6", fontSize: 13, marginTop: 4 }}>{s.why}</div>}
            {s.outputSummary && <div style={{ color: "#8b94a1", fontSize: 12, marginTop: 2, wordBreak: "break-word" }}>{s.outputSummary}</div>}
          </div>
        ))}
      </div>
      {done && <p style={{ marginTop: 20 }}>{done.verdict?.decision && <b style={{ marginRight: 10 }}>{done.verdict.decision.replace("_", " ")}</b>}<a href={`${done.url}${q}`} style={{ color: "#c9a46a", fontWeight: 700 }}>{t.open} →</a></p>}
    </main>
  );
}

export default function Page() { return <Suspense><NewInspection /></Suspense>; }
