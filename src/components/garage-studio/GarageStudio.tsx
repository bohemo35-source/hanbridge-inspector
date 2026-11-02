// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Garage studio UI: 3D bay + panel rail, legend, assemble/explode, panel card with status, gauge spread, findings, inspector quotes and the car's real photos (lightbox)
// @created: 2026-11-02
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PANELS, panelLabel, type PanelId } from "@/lib/domain/panels";
import type { GarageData, PanelPhoto, PanelState, PanelStatus } from "@/lib/garage/data";
import type { StudioHandle } from "./scene";

type Lang = "en" | "ru";
export const STATUS_COLOR: Record<PanelStatus, string> = {
  clean: "#5f666d", factory: "#8cc7cf", unconfirmed: "#a7adb4", damage: "#e8875a", repaint: "#eea65a", putty: "#e2574c", replaced: "#b49cf0",
};
const STATUS_LABEL: Record<Lang, Record<PanelStatus, string>> = {
  en: { clean: "No remarks", factory: "Factory paint", unconfirmed: "Unconfirmed", damage: "Wear / damage", repaint: "Repainted", putty: "Filler / repair", replaced: "Replaced" },
  ru: { clean: "Без замечаний", factory: "Заводской окрас", unconfirmed: "Не подтверждено", damage: "Износ / повреждение", repaint: "Перекрас", putty: "Шпатлёвка / ремонт", replaced: "Заменена" },
};
const STATUS_NOTE: Record<Lang, Record<PanelStatus, string>> = {
  en: { clean: "Photographed, no findings by the agent or the inspector.", factory: "Paint thickness within factory range.", unconfirmed: "The inspector mentioned it, the independent verifier did not confirm it.", damage: "Traces of use or damage, confirmed.", repaint: "Paint layer thicker than factory — the panel was repainted.", putty: "Thick layer: filler under the paint, body repair.", replaced: "The panel was replaced." },
  ru: { clean: "Деталь сфотографирована, ни агент, ни инспектор замечаний не нашли.", factory: "Толщина ЛКП в заводском диапазоне.", unconfirmed: "Инспектор упомянул, независимая проверка не подтвердила.", damage: "Следы эксплуатации или повреждение — подтверждено.", repaint: "Слой краски толще заводского — деталь перекрашивалась.", putty: "Толстый слой: шпатлёвка под краской, кузовной ремонт.", replaced: "Деталь заменена." },
};
const KIND: Record<string, [string, string]> = { repaint: ["Repainted", "Перекрас"], putty: ["Filler under the paint", "Шпатлёвка под краской"], panel_replaced: ["Panel replaced", "Деталь заменена"], dent: ["Dent", "Вмятина"], scratch: ["Scratch", "Царапина"], rust: ["Rust", "Ржавчина"], mechanical: ["Mechanical", "Механика"], other: ["Note", "Замечание"] };
const T = {
  en: { explode: "Take apart", assemble: "Put together", reset: "Reset view", hint: "Drag to turn · click a panel", photos: "Real photos of this panel", noPhotos: "No photos of this panel", findings: "Findings", gauge: "Paint gauge", points: "points", noGauge: "No gauge reading on this panel", verified: "verified", unconfirmed: "unconfirmed", report: "Full report", close: "Close", panels: "13 body panels", loading: "Bringing the car into the bay…", noWebgl: "3D is off on this device — the panel list still works.", of: "of", voice: "voice", frame: "frame", materials: "Inspection materials", sheet: "Inspector's sheet", video: "Paint gauge video", fromSheet: "From the inspector's sheet", original: "original in Russian", videoNote: "The inspector measures every panel with a paint gauge — the readings and the voice behind this report." },
  ru: { explode: "Разобрать", assemble: "Собрать", reset: "Вид по умолчанию", hint: "Тяните, чтобы вращать · кликните деталь", photos: "Реальные фото этой детали", noPhotos: "Фото этой детали нет", findings: "Находки", gauge: "Толщиномер", points: "точек", noGauge: "Замера толщиномером по этой детали нет", verified: "подтверждено", unconfirmed: "не подтверждено", report: "Полный отчёт", close: "Закрыть", panels: "13 деталей кузова", loading: "Машина въезжает в бокс…", noWebgl: "3D на этом устройстве выключено — список деталей работает.", of: "из", voice: "голос", frame: "кадр", materials: "Материалы осмотра", sheet: "Лист осмотра", video: "Видео толщиномера", fromSheet: "Из листа осмотра", original: "оригинал на русском", videoNote: "Инспектор проходит толщиномером каждую деталь — это исходник замеров и голоса в отчёте." },
} as const;
/** Glimmer photo notes are English; RU comes from the one-off Muse Spark translation (notes-ru.json) */
const photoNote = (ph: PanelPhoto, lang: Lang) => (lang === "ru" ? ph.noteRu ?? ph.note : ph.note);
const thumb = (url: string, w = 640) => `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=72`;
const tc = (t?: number) => (t === undefined ? "" : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} `);

export default function GarageStudio({ data, lang, embedded = false }: { data: GarageData; lang: Lang; embedded?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const studio = useRef<StudioHandle | null>(null);
  const tag = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [hover, setHover] = useState<PanelId | null>(null);
  const [sel, setSel] = useState<PanelId | null>(null);
  const [exploded, setExploded] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [mat, setMat] = useState<null | "sheet" | "video">(null);
  const t = T[lang];
  const byId = useMemo(() => new Map(data.panels.map((p) => [p.panel, p])), [data]);
  const remarks = data.panels.filter((p) => !["clean", "factory"].includes(p.status));
  const q = lang === "ru" ? "?lang=ru" : "";

  // embedded far down a long page: the 12 MB model, the parts and the HDRI load only when the bay comes near
  const [near, setNear] = useState(!embedded);
  useEffect(() => {
    if (near || !host.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: "700px 0px" });
    io.observe(host.current); return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let ok = false;
    try { ok = !!document.createElement("canvas").getContext("webgl2"); } catch { ok = false; }
    if (!ok || new URLSearchParams(location.search).has("no3d")) { setWebgl(false); return; }
    let alive = true;
    import("./scene").then(({ createStudio }) => {
      if (!alive || !host.current) return;
      studio.current = createStudio(host.current, {
        onHover: (p) => setHover(p),
        onPick: (p) => setSel(p),
        onReady: () => setReady(true),
        onFrame: () => {
          // label follows the hovered / selected panel
          const el = tag.current, s = studio.current; if (!el || !s) return;
          const id = el.dataset.panel as PanelId | undefined; if (!id) return;
          const pr = s.project(id); if (!pr) return;
          el.style.transform = `translate(${pr.x}px, ${pr.y}px)`; el.style.opacity = pr.visible ? "1" : "0";
        },
      }, { mobile: window.matchMedia("(max-width: 768px)").matches, zoom: !embedded });
    });
    return () => { alive = false; studio.current?.dispose(); studio.current = null; };
  }, [embedded, near]);

  useEffect(() => {
    if (!ready) return;
    studio.current?.setStatus(Object.fromEntries(data.panels.map((p) => [p.panel, p.status === "clean" ? null : { color: STATUS_COLOR[p.status], weight: p.status === "factory" ? 0.28 : 1 }])));
  }, [ready, data]);
  useEffect(() => { studio.current?.setHover(hover); }, [hover]);
  useEffect(() => { studio.current?.setSelected(sel); setZoom(null); }, [sel]);
  useEffect(() => { studio.current?.setExploded(exploded); }, [exploded]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (zoom !== null) setZoom(null); else setSel(null); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [zoom]);

  const tagPanel = hover ?? sel;
  const cur = sel ? byId.get(sel) : undefined;
  const pick = useCallback((p: PanelId) => setSel((s) => (s === p ? null : p)), []);

  return (
    <div className={`relative w-full overflow-hidden bg-ink text-bone ${embedded ? "h-[92svh] min-h-[560px]" : "h-[100svh] min-h-[600px]"}`}>
      <div ref={host} className="absolute inset-0" />
      {/* film grade over the 3D: vignette + grain */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(110% 85% at 50% 45%, transparent 55%, rgba(6,7,8,.7) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="hb-grain" /></div>

      {!ready && webgl && <div className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-[11px] uppercase tracking-[.3em] text-mist">{t.loading}</div>}
      {!webgl && <div className="absolute inset-x-0 top-1/3 px-6 text-center font-display text-2xl italic text-bone-2">{t.noWebgl}</div>}

      {/* floating label */}
      <div ref={tag} data-panel={tagPanel ?? ""} className="pointer-events-none absolute left-0 top-0 z-[5] transition-opacity" style={{ opacity: tagPanel && ready ? 1 : 0 }}>
        {tagPanel && <div className="-translate-x-1/2 -translate-y-full whitespace-nowrap border-l-2 bg-ink/80 px-3 py-1.5 backdrop-blur-md" style={{ borderColor: STATUS_COLOR[byId.get(tagPanel)?.status ?? "clean"] }}>
          <div className="font-mono text-[10px] uppercase tracking-[.18em] text-bone">{panelLabel(tagPanel, lang)}</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.16em]" style={{ color: STATUS_COLOR[byId.get(tagPanel)?.status ?? "clean"] }}>{STATUS_LABEL[lang][byId.get(tagPanel)?.status ?? "clean"]}{byId.get(tagPanel)?.reading ? ` · ${byId.get(tagPanel)!.reading!.microns} µm` : ""}</div>
        </div>}
      </div>

      {/* header */}
      <div className="absolute inset-x-0 top-0 z-[6] flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[.3em] text-sodium">{lang === "ru" ? "Гараж осмотра" : "Inspection bay"} · {data.photoTotal} {lang === "ru" ? "фото" : "photos"}</div>
          <h2 className="mt-1 font-display text-[clamp(28px,3.4vw,46px)] font-medium leading-none">{data.title}</h2>
          {data.sheet && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[.14em] text-bone-2">{data.sheet.facts.filter((f) => !/model|модель/i.test(f.en + f.ru)).slice(0, 4).map((f) => <span key={f.en}><span className="text-mist">{lang === "ru" ? f.ru : f.en}</span> {lang === "ru" ? f.value_ru : f.value_en}</span>)}</div>}
        </div>
        <div className="flex items-center gap-3">
          {(data.sheet || data.gaugeVideo) && <div className="flex gap-1.5">
            {data.gaugeVideo && <button onClick={() => { setMat("video"); setSel(null); }} className={`rounded-full border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] backdrop-blur-md ${mat === "video" ? "border-sodium bg-sodium text-ink" : "border-sodium/60 bg-ink/50 text-sodium-hi hover:border-sodium"}`}>▶ {t.video}</button>}
            {data.sheet && <button onClick={() => { setMat("sheet"); setSel(null); }} className={`rounded-full border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] backdrop-blur-md ${mat === "sheet" ? "border-sodium bg-sodium text-ink" : "border-bone/25 bg-ink/50 hover:border-sodium"}`}>{t.sheet}</button>}
          </div>}
          {data.decision && <span className="border px-3 py-1 font-mono text-[12px] uppercase tracking-[.2em]" style={{ color: dColor(data.decision), borderColor: dColor(data.decision), background: "rgba(6,7,8,.6)" }}>{data.decision.replace("_", " ")}</span>}
          {data.reportId && !embedded && <a href={`/r/${data.reportId}${q}`} className="rounded-full border border-bone/25 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.18em] hover:border-sodium">{t.report} ↗</a>}
        </div>
      </div>

      {/* panel rail on a dark band: the bay lights must not run behind the text */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] hidden w-[340px] md:block" style={{ background: "linear-gradient(90deg, rgba(6,7,8,.88), rgba(6,7,8,.55) 65%, transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-32" style={{ background: "linear-gradient(180deg, rgba(6,7,8,.85), transparent)" }} />
      {/* panel rail */}
      <div className="absolute bottom-24 left-4 top-36 z-[6] hidden w-[230px] flex-col sm:left-8 md:flex">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[.26em] text-mist">{t.panels}{remarks.length ? ` · ${remarks.length} !` : ""}</div>
        <div className="flex-1 space-y-px overflow-y-auto pr-1">
          {PANELS.map(({ id }) => {
            const p = byId.get(id)!; const on = sel === id;
            return (
              <button key={id} onClick={() => pick(id)} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left transition-colors ${on ? "bg-bone/10" : "hover:bg-bone/5"}`}>
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[p.status], boxShadow: p.status !== "clean" ? `0 0 8px ${STATUS_COLOR[p.status]}` : "none" }} />
                <span className={`flex-1 text-[13px] ${on ? "text-bone" : "text-bone-2"}`}>{panelLabel(id, lang)}</span>
                <span className="font-mono text-[10px] text-mist">{p.reading ? p.reading.microns : p.photos.length ? `${p.photos.length}▣` : ""}</span>
              </button>
            );
          })}
        </div>
        <Legend lang={lang} panels={data.panels} />
      </div>

      {/* mobile chips */}
      <div className="absolute inset-x-0 bottom-20 z-[6] flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {PANELS.map(({ id }) => { const p = byId.get(id)!; return (
          <button key={id} onClick={() => pick(id)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] ${sel === id ? "border-sodium bg-ink/80" : "border-bone/15 bg-ink/60"}`}>
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[p.status] }} />{panelLabel(id, lang)}
          </button>); })}
      </div>

      {/* controls */}
      <div className="absolute bottom-5 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 sm:bottom-7">
        <button onClick={() => setExploded((v) => !v)} disabled={!ready} className="rounded-full bg-sodium px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-[.2em] text-ink shadow-[0_0_40px_rgba(238,166,90,.3)] disabled:opacity-40">{exploded ? t.assemble : t.explode}</button>
        <button onClick={() => { setSel(null); studio.current?.resetView(); }} className="rounded-full border border-bone/25 bg-ink/50 px-4 py-3 font-mono text-[11px] uppercase tracking-[.18em] backdrop-blur-md hover:border-sodium">{t.reset}</button>
      </div>
      <div className="pointer-events-none absolute bottom-7 right-8 z-[6] hidden font-mono text-[10px] uppercase tracking-[.22em] text-mist lg:block">{t.hint}</div>

      {/* panel card */}
      {cur && <PanelCard p={cur} lang={lang} sheet={data.sheet} onClose={() => setSel(null)} onZoom={setZoom} />}
      {!cur && mat && <Materials data={data} lang={lang} tab={mat} setTab={setMat} onClose={() => setMat(null)} />}

      {/* lightbox */}
      {cur && zoom !== null && cur.photos[zoom] && (
        <div className="absolute inset-0 z-[9] flex items-center justify-center bg-ink/92 p-4 backdrop-blur-sm sm:p-10" onClick={() => setZoom(null)}>
          <figure className="relative max-h-full max-w-[1200px]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(cur.photos[zoom].url, 1920)} alt={photoNote(cur.photos[zoom], lang)} className="max-h-[78svh] w-auto rounded-[4px] object-contain" />
            <figcaption className="mt-3 flex items-start justify-between gap-6 text-[13px] text-bone-2">
              <span><span className="font-mono text-[10px] uppercase tracking-[.2em] text-sodium">{panelLabel(cur.panel, lang)} · {zoom + 1} {t.of} {cur.photos.length}</span><br />{photoNote(cur.photos[zoom], lang)}</span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => setZoom((z) => (z! + cur.photos.length - 1) % cur.photos.length)} className="rounded-full border border-bone/25 px-3 py-1.5">←</button>
                <button onClick={() => setZoom((z) => (z! + 1) % cur.photos.length)} className="rounded-full border border-bone/25 px-3 py-1.5">→</button>
                <button onClick={() => setZoom(null)} className="rounded-full border border-bone/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.18em]">{t.close}</button>
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

const dColor = (d: string) => (d === "BUY" ? "#86cfa2" : d === "WALK_AWAY" ? "#e2574c" : "#eea65a");

function Legend({ lang, panels }: { lang: Lang; panels: PanelState[] }) {
  const used = new Set(panels.map((p) => p.status));
  const order: PanelStatus[] = ["replaced", "putty", "repaint", "damage", "unconfirmed", "factory", "clean"];
  return (
    <div className="mt-3 space-y-1 border-t border-bone/10 pt-3">
      {order.filter((s) => used.has(s)).map((s) => (
        <div key={s} className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[.16em] text-mist"><i className="h-1.5 w-3" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[lang][s]}</div>
      ))}
    </div>
  );
}

function PanelCard({ p, lang, sheet, onClose, onZoom }: { p: PanelState; lang: Lang; sheet?: GarageData["sheet"]; onClose: () => void; onZoom: (i: number) => void }) {
  const sheetLines = (sheet?.sections ?? []).flatMap((sc) => sc.items.filter((it) => it.panels?.includes(p.panel)));
  const t = T[lang]; const c = STATUS_COLOR[p.status];
  const note = (ph: PanelPhoto) => photoNote(ph, lang);
  return (
    <aside key={p.panel} className="absolute inset-x-3 bottom-3 z-[8] max-h-[62svh] overflow-y-auto rounded-[6px] border border-bone/12 bg-ink/88 shadow-[0_40px_120px_rgba(0,0,0,.7)] backdrop-blur-xl md:inset-x-auto md:bottom-24 md:right-8 md:top-28 md:max-h-none md:w-[400px]"
      style={{ animation: "hb-card-in .45s cubic-bezier(.2,.8,.2,1)" }}>
      <style>{`@keyframes hb-card-in{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}`}</style>
      <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-bone/10 bg-ink/90 px-5 py-4 backdrop-blur-xl">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.22em]" style={{ color: c }}>● {STATUS_LABEL[lang][p.status]}</div>
          <h3 className="mt-1 font-display text-[30px] font-medium leading-none">{panelLabel(p.panel, lang)}</h3>
        </div>
        <button onClick={onClose} className="rounded-full border border-bone/20 px-2.5 py-1 font-mono text-[11px] text-bone-2 hover:border-sodium" aria-label={t.close}>✕</button>
      </div>
      <div className="space-y-5 px-5 py-4">
        <p className="text-[14px] leading-relaxed text-bone-2">{STATUS_NOTE[lang][p.status]}</p>

        <section>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-mist">{t.gauge}</div>
          {p.reading ? (
            <div className="flex items-end gap-4">
              <span className="font-display text-[44px] font-medium leading-none" style={{ color: c }}>{p.reading.microns}<span className="ml-1 font-mono text-[13px] text-mist">µm</span></span>
              {p.reading.min !== undefined && p.reading.max !== undefined && <span className="pb-1 font-mono text-[11px] text-bone-2">{p.reading.min}–{p.reading.max} µm · {p.reading.points ?? "?"} {t.points}</span>}
            </div>
          ) : <p className="text-[13px] text-mist">{t.noGauge}</p>}
        </section>

        {p.findings.length > 0 && (
          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-mist">{t.findings}</div>
            <div className="space-y-3">
              {p.findings.map((f, i) => (
                <div key={i} className="border-l-2 pl-3" style={{ borderColor: f.verified ? "#86cfa2" : "#a7adb4" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="font-display text-[20px] font-medium">{KIND[f.kind]?.[lang === "ru" ? 1 : 0] ?? f.kind}{f.microns ? ` · ${f.microns} µm` : ""}</b>
                    <span className={`font-mono text-[9.5px] uppercase tracking-[.16em] ${f.verified ? "text-ok" : "text-mist"}`}>{f.verified ? t.verified : t.unconfirmed}</span>
                  </div>
                  {f.quotes.map((qq, k) => <p key={k} className="mt-1 text-[13px] italic leading-snug text-bone-2"><span className="mr-1.5 font-mono text-[9.5px] not-italic uppercase tracking-[.16em] text-sodium">{t.voice} {tc(qq.t)}</span>«{qq.quote}»</p>)}
                  {!f.quotes.length && <p className="mt-1 text-[13px] leading-snug text-bone-2">{lang === "ru" ? f.ru : f.en}</p>}
                  {f.frames.length > 0 && <div className="mt-2 flex gap-1.5">{f.frames.slice(0, 3).map((fr) => (
                    <a key={fr.id} href={fr.url} target="_blank" rel="noreferrer" className="relative block h-14 w-20 overflow-hidden rounded-[3px] border border-bone/15" title={fr.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(fr.url, 256)} alt={fr.id} loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-1 font-mono text-[8px] uppercase tracking-[.1em] text-sodium-hi">{t.frame}</span>
                    </a>))}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {sheetLines.length > 0 && (
          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-mist">{t.fromSheet}</div>
            {sheetLines.map((it, i) => <p key={i} className="border-l-2 border-sodium/50 pl-3 text-[13.5px] leading-snug text-bone">{lang === "ru" ? it.ru : it.en}{lang === "en" && <span className="mt-1 block text-[12px] italic text-mist">«{it.ru}» — {t.original}</span>}</p>)}
          </section>
        )}

        <section>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-mist">{p.photos.length ? `${t.photos} · ${p.photos.length}` : t.noPhotos}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {p.photos.map((ph, i) => (
              <button key={ph.id} onClick={() => onZoom(i)} className={`group relative overflow-hidden rounded-[3px] bg-ink-3 ${i === 0 ? "col-span-2 aspect-[16/10]" : "aspect-[4/3]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(ph.url, i === 0 ? 828 : 384)} alt={note(ph)} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-3 pb-2 pt-6 text-left text-[12px] leading-snug text-bone-2">{note(ph)}</span>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

const STATE_COLOR: Record<string, string> = { ok: "#86cfa2", note: "#eea65a", issue: "#e2574c" };

/** The inspection's own materials: the inspector's checklist (structured from the original text) and the paint-gauge video. */
function Materials({ data, lang, tab, setTab, onClose }: { data: GarageData; lang: Lang; tab: "sheet" | "video"; setTab: (v: "sheet" | "video") => void; onClose: () => void }) {
  const t = T[lang];
  return (
    <aside className="absolute inset-x-3 bottom-3 z-[8] flex max-h-[70svh] flex-col overflow-hidden rounded-[6px] border border-bone/12 bg-ink/90 shadow-[0_40px_120px_rgba(0,0,0,.7)] backdrop-blur-xl md:inset-x-auto md:bottom-24 md:right-8 md:top-28 md:max-h-none md:w-[440px]"
      style={{ animation: "hb-card-in .45s cubic-bezier(.2,.8,.2,1)" }}>
      <style>{`@keyframes hb-card-in{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex items-start justify-between gap-3 border-b border-bone/10 px-5 py-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.22em] text-sodium">{t.materials}</div>
          <div className="mt-2 flex gap-1">
            {data.sheet && <button onClick={() => setTab("sheet")} className={`px-3 py-1 font-display text-[20px] ${tab === "sheet" ? "text-bone" : "text-mist hover:text-bone-2"}`}>{t.sheet}</button>}
            {data.gaugeVideo && <button onClick={() => setTab("video")} className={`px-3 py-1 font-display text-[20px] ${tab === "video" ? "text-bone" : "text-mist hover:text-bone-2"}`}>{t.video}</button>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-full border border-bone/20 px-2.5 py-1 font-mono text-[11px] text-bone-2 hover:border-sodium" aria-label={t.close}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "video" && data.gaugeVideo && (
          <div>
            <video key={data.gaugeVideo.url} src={data.gaugeVideo.url} poster={data.gaugeVideo.poster} controls playsInline preload="none" className="max-h-[52svh] w-full rounded-[4px] bg-black object-contain" />
            <p className="mt-3 text-[13px] leading-relaxed text-bone-2">{t.videoNote}</p>
          </div>
        )}
        {tab === "sheet" && data.sheet && (
          <div className="space-y-5">
            {data.sheet.facts.length > 0 && <dl className="grid grid-cols-2 gap-x-4 gap-y-2">{data.sheet.facts.map((f) => (
              <div key={f.en}><dt className="font-mono text-[9.5px] uppercase tracking-[.18em] text-mist">{lang === "ru" ? f.ru : f.en}</dt><dd className="text-[14px] text-bone">{lang === "ru" ? f.value_ru : f.value_en}</dd></div>))}</dl>}
            {data.sheet.sections.map((sc) => (
              <section key={sc.en}>
                <div className="mb-2 flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[sc.state] ?? "#8d949b", boxShadow: `0 0 8px ${STATE_COLOR[sc.state] ?? "transparent"}` }} /><h4 className="font-display text-[22px] font-medium">{lang === "ru" ? sc.ru : sc.en}</h4></div>
                <ul className="space-y-1.5">{sc.items.map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-bone-2"><span className="mt-[3px] font-mono text-[10px] text-sodium">✓</span><span>{lang === "ru" ? it.ru : it.en}</span></li>))}</ul>
              </section>
            ))}
            <p className="border-t border-bone/10 pt-3 font-mono text-[9.5px] uppercase leading-relaxed tracking-[.16em] text-mist">{lang === "ru" ? "Оригинальный текст инспектора, разложен по разделам моделью Muse Spark" : "The inspector's original text (Russian), structured and translated by Muse Spark"}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
