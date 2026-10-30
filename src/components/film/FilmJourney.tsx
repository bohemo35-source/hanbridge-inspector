// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Scroll-scrubbed film journey: Wan clips per scene (crossfade), chapter copy, HUD (golden route line, insured shield, open receipt), then the 3D garage demo
// @created: 2026-10-31
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Report } from "@/lib/schema";
import { ROUTE, SCENES, UI, type Lang, type ReceiptLine } from "./scenes";

const GarageScene = dynamic(() => import("@/components/garage-3d/GarageScene"), { ssr: false });

/** hackathon build: say how we earn. Set false for the production site. */
const SHOW_VAT_NOTE = true;
const FADE = 0.18; // share of a scene used to crossfade into the next one

const starts = (() => { let a = 0; return SCENES.map((s) => { const v = a; a += s.vh; return v; }); })();
const TOTAL_VH = SCENES.reduce((a, s) => a + s.vh, 0);

export default function FilmJourney({ report, lang }: { report?: Report; lang: Lang }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [pos, setPos] = useState({ i: 0, t: 0 }); // scene index, local progress 0..1
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1]));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = wrap.current; if (!el) return;
      const vh = window.innerHeight / 100;
      const y = -el.getBoundingClientRect().top / vh; // scrolled vh inside the film
      const yy = Math.max(0, Math.min(TOTAL_VH - 0.001, y));
      let i = SCENES.length - 1; while (i > 0 && starts[i] > yy) i--;
      const t = (yy - starts[i]) / SCENES[i].vh;
      setPos((p) => (p.i === i && Math.abs(p.t - t) < 0.002 ? p : { i, t }));
      setLoaded((s) => (s.has(i + 1) && s.has(i + 2) ? s : new Set([...s, i, i + 1, i + 2])));
      // scrub: current clip follows scroll; next clip runs its first frames during the crossfade
      [i, i + 1].forEach((k) => {
        const v = vids.current[k]; if (!v || !v.duration) return;
        const lt = k === i ? t : 0;
        const target = Math.min(v.duration - 0.05, lt * v.duration);
        if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  const s = SCENES[pos.i];
  const fadeK = pos.t > 1 - FADE && pos.i < SCENES.length - 1 ? (pos.t - (1 - FADE)) / FADE : 0;
  const textK = Math.min(1, pos.t / 0.12) * (1 - fadeK); // copy fades in at scene start, out in the crossfade
  const receipt = useMemo(() => SCENES.slice(0, pos.i + 1).flatMap((x) => x.receipt ?? []), [pos.i]);
  const insured = SCENES.slice(0, pos.i + 1).some((x) => x.insured);
  const routeK = (s.stop + (SCENES[pos.i + 1] && SCENES[pos.i + 1].stop > s.stop ? pos.t : 0)) / (ROUTE.length - 1);

  return (
    <div className="bg-[#07090d] text-[#eef0f4]">
      <div ref={wrap} style={{ height: `${TOTAL_VH}vh` }} className="relative" data-testid="film" data-scene={s.id}>
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          {SCENES.map((x, k) => {
            const op = k === pos.i ? 1 : k === pos.i + 1 ? fadeK : 0;
            return (
              <video key={x.id} ref={(v) => { vids.current[k] = v; }} muted playsInline preload={loaded.has(k) ? "auto" : "none"}
                poster={`/film/${x.id}.jpg`} src={loaded.has(k) ? `/film/${x.id}.mp4` : undefined}
                className="absolute inset-0 h-full w-full object-cover" style={{ opacity: op, zIndex: k === pos.i + 1 ? 2 : 1, visibility: op > 0 ? "visible" : "hidden" }} />
            );
          })}
          {/* grade + legibility */}
          <div className="pointer-events-none absolute inset-0 z-[3]" style={{ background: s.hero
            ? "linear-gradient(180deg,rgba(7,9,13,.55),transparent 50%,rgba(7,9,13,.45))"
            : "linear-gradient(90deg,rgba(7,9,13,.72),rgba(7,9,13,.2) 45%,transparent 70%),linear-gradient(0deg,rgba(7,9,13,.6),transparent 38%)" }} />

          {/* top bar */}
          <div className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-5 pt-5 text-[11px] uppercase tracking-[.26em] text-[#c9ced8] sm:px-16 sm:pt-7">
            <b className="font-semibold text-[#eef0f4]">Hanbridge Auto</b>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">{s.place[lang]}</span>
              <Shield on={insured} lang={lang} />
            </div>
          </div>

          {/* copy */}
          {s.hero ? (
            <div className="absolute inset-x-0 top-[16vh] z-[5] px-5 text-center" style={{ opacity: Math.max(textK, pos.i === 0 && pos.t < 0.05 ? 1 : 0) }}>
              <h1 className="font-serif text-5xl font-light tracking-wide sm:text-8xl">Hanbridge <span className="text-amber-300">Auto</span></h1>
              <p className="mt-3 text-lg font-light text-[#e3e6ec] sm:text-2xl">{s.sub?.[lang]}</p>
            </div>
          ) : (
            <div className="absolute bottom-[132px] left-5 right-5 z-[5] max-w-[560px] sm:bottom-[120px] sm:left-16" style={{ opacity: textK, transform: `translateY(${(1 - textK) * 14}px)` }}>
              {s.chapter && <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[.3em] text-amber-300"><i className="inline-block h-px w-7 bg-amber-300" />{s.chapter[lang]}</div>}
              <h2 className="whitespace-pre-line font-serif text-3xl font-light leading-[1.08] sm:text-5xl">{s.title?.[lang]}</h2>
              {s.sub && <p className="mt-3 text-[15px] font-light leading-relaxed text-[#c9ced8] sm:text-[17px]">{s.sub[lang]}</p>}
              {s.cta && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a href="/cars" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950">{UI.cta[lang]}</a>
                  <a href="#inspection" className="rounded-full border border-white/25 bg-black/40 px-5 py-3 text-sm font-semibold backdrop-blur-md">{UI.seeInspection[lang]}</a>
                </div>
              )}
            </div>
          )}

          {/* right panel: inspection steps or the open receipt */}
          {s.panel === "steps" ? <Steps lang={lang} k={pos.i === SCENES.findIndex((x) => x.id === "inspect") ? 4 : 2} />
            : receipt.length > 0 && <Receipt lines={receipt} lang={lang} showNote={SHOW_VAT_NOTE && s.id === "handover"} />}

          {/* golden route line = the bridge that never ends */}
          <Route k={routeK} stop={s.stop} lang={lang} />

          {pos.i === 0 && pos.t < 0.3 && <div className="absolute inset-x-0 bottom-24 z-[5] text-center text-[11px] uppercase tracking-[.3em] text-[#c9ced8]">{UI.scroll[lang]} ↓</div>}
        </div>
      </div>

      <section id="inspection" className="relative">
        <div className="mx-auto max-w-3xl px-5 pb-6 pt-24 text-center">
          <div className="mb-3 text-[11px] uppercase tracking-[.3em] text-amber-300">Hanbridge Inspector</div>
          <h2 className="font-serif text-3xl font-light sm:text-5xl">{UI.garageTitle[lang]}</h2>
          <p className="mt-3 text-[#c9ced8]">{UI.garageSub[lang]}</p>
        </div>
        <GarageScene report={report} lang={lang} />
      </section>
    </div>
  );
}

function Shield({ on, lang }: { on: boolean; lang: Lang }) {
  return (
    <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-500 ${on ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-white/30"}`}>
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M6 1 1 3v4c0 3 2.2 5.4 5 6 2.8-.6 5-3 5-6V3L6 1Z" stroke="currentColor" strokeWidth="1.4" fill={on ? "currentColor" : "none"} fillOpacity=".25" /></svg>
      {UI.insured[lang]}
    </span>
  );
}

function Receipt({ lines, lang, showNote }: { lines: ReceiptLine[]; lang: Lang; showNote: boolean }) {
  return (
    <div className="absolute right-5 top-20 z-[5] hidden w-[300px] rounded-2xl border border-white/10 bg-[#0e1117]/65 p-4 text-[13px] backdrop-blur-xl md:block lg:right-16 lg:top-auto lg:bottom-[120px]">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[.2em] text-[#8b93a3]"><span>{UI.receipt[lang]}</span><span>{lines.length}</span></div>
      {lines.map((l, k) => (
        <div key={k} className="flex items-start justify-between gap-3 border-t border-white/[.07] py-2 first-of-type:border-0" style={{ animation: "filmIn .5s ease both" }}>
          <span className="text-[#dfe3ea]">{l.item[lang]}</span>
          <span className="shrink-0 text-right">
            <span className={l.by === "zero" ? "font-semibold text-emerald-300" : "font-semibold"}>{l.by === "zero" ? "0" : `→ ${l.payee[lang]}`}</span>
            {l.by !== "zero" && <span className="block text-[10px] uppercase tracking-[.12em] text-[#8b93a3]">{l.by === "you" ? UI.byYou[lang] : UI.byInvoice[lang]}</span>}
          </span>
        </div>
      ))}
      {showNote && <p className="mt-2 border-t border-white/[.07] pt-2 text-[11px] leading-snug text-[#aab1bd]">{UI.zeroNote[lang]}</p>}
      <style>{`@keyframes filmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Steps({ lang, k }: { lang: Lang; k: number }) {
  return (
    <div className="absolute right-5 top-20 z-[5] hidden w-[280px] rounded-2xl border border-white/10 bg-[#0e1117]/65 p-4 text-[13px] backdrop-blur-xl md:block lg:right-16 lg:top-auto lg:bottom-[120px]">
      <div className="mb-2 text-[10px] uppercase tracking-[.2em] text-[#8b93a3]">{UI.stepsTitle[lang]}</div>
      {UI.steps.map((st, n) => (
        <div key={n} className="flex items-center gap-3 border-t border-white/[.07] py-2 first-of-type:border-0">
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${n < k ? "bg-amber-300 text-zinc-950" : "border border-white/20 text-white/40"}`}>{n < k ? "✓" : n + 1}</span>
          <span className={n < k ? "text-[#eef0f4]" : "text-white/40"}>{st[lang]}</span>
        </div>
      ))}
    </div>
  );
}

function Route({ k, stop, lang }: { k: number; stop: number; lang: Lang }) {
  const pct = Math.max(0, Math.min(1, k)) * 100;
  return (
    <div className="absolute inset-x-5 bottom-8 z-[5] sm:inset-x-16 sm:bottom-10">
      <div className="relative h-[2px] bg-white/15">
        <div className="absolute inset-y-0 left-0 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.8)]" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_16px_rgba(252,211,77,1)]" style={{ left: `${pct}%` }} />
        {ROUTE.map((_, n) => <span key={n} className={`absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${n <= stop ? "bg-amber-300" : "bg-white/30"}`} style={{ left: `${(n / (ROUTE.length - 1)) * 100}%` }} />)}
      </div>
      <div className="relative mt-3 hidden h-4 text-[10px] uppercase tracking-[.18em] sm:block">
        {ROUTE.map((r, n) => <span key={n} className={`absolute -translate-x-1/2 whitespace-nowrap ${n === stop ? "text-amber-300" : n < stop ? "text-[#c9ced8]" : "text-white/35"}`} style={{ left: `${(n / (ROUTE.length - 1)) * 100}%` }}>{r[lang]}</span>)}
      </div>
    </div>
  );
}
