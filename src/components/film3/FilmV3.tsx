// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v3 player: scroll-scrubbed clips + code inserts, narrator subtitles, chapter label, fact chips, receipt toasts (full receipt twice), "watch with sound" autoscroll, then the 3D garage proof
// @created: 2026-11-01
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Report } from "@/lib/schema";
import InsertView from "./Inserts";
import { CHAPTERS, RECEIPT_BUSAN, RECEIPT_CUSTOMS, SCENES, UI, type Lang, type Line } from "./scenes3";

const GarageScene = dynamic(() => import("@/components/garage-3d/GarageScene"), { ssr: false });

/** hackathon build: say how we earn. Set false for the production site. */
const SHOW_VAT_NOTE = true;
const FADE = 0.16;
const starts = (() => { let a = 0; return SCENES.map((s) => { const v = a; a += s.vh; return v; }); })();
const TOTAL_VH = SCENES.reduce((a, s) => a + s.vh, 0);
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const nn = (n: number) => String(n).padStart(2, "0");

export default function FilmV3({ report, lang }: { report?: Report; lang: Lang }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [pos, setPos] = useState({ i: 0, t: 0 });
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1, 2]));
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const music = useRef<HTMLAudioElement | null>(null);
  const voice = useRef<HTMLAudioElement | null>(null);
  const lastCh = useRef(-1);

  /* scroll → scene index + local progress, video scrubbing */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = wrap.current; if (!el) return;
      const vh = window.innerHeight / 100;
      const yy = cl(-el.getBoundingClientRect().top / vh, 0, TOTAL_VH - 0.001);
      let i = SCENES.length - 1; while (i > 0 && starts[i] > yy) i--;
      const t = (yy - starts[i]) / SCENES[i].vh;
      setPos((p) => (p.i === i && Math.abs(p.t - t) < 0.002 ? p : { i, t }));
      setLoaded((s) => (s.has(i + 1) && s.has(i + 2) && s.has(i + 3) ? s : new Set([...s, i, i + 1, i + 2, i + 3])));
      [i, i + 1].forEach((k) => {
        const v = vids.current[k]; if (!v || !v.duration) return;
        const target = Math.min(v.duration - 0.05, (k === i ? t : 0) * v.duration);
        if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  /* watch mode: autoscroll at each scene's pace; voice per chapter + one music track (files optional) */
  const stopAuto = useCallback(() => {
    autoRef.current = false; setAuto(false);
    music.current?.pause(); voice.current?.pause();
  }, []);
  const startAuto = useCallback(() => {
    const el = wrap.current; if (!el) return;
    autoRef.current = true; setAuto(true); lastCh.current = -1;
    if (!music.current) { music.current = new Audio("/film3/audio/music.mp3"); music.current.loop = true; music.current.volume = 0.35; }
    music.current.play().catch(() => {});
    const top0 = el.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY < top0 || window.scrollY > top0 + (TOTAL_VH - 1) * window.innerHeight / 100) window.scrollTo(0, top0);
    let y = window.scrollY, prev = performance.now();
    const step = (now: number) => {
      if (!autoRef.current) return;
      const dt = Math.min(64, now - prev); prev = now;
      const vh = window.innerHeight / 100;
      const local = (y - top0) / vh;
      let i = SCENES.length - 1; while (i > 0 && starts[i] > local) i--;
      const sc = SCENES[i];
      y += (sc.vh * vh) / (sc.sec * 1000) * dt;
      if (local >= TOTAL_VH - 1) { stopAuto(); return; }
      window.scrollTo(0, y);
      if (sc.ch !== lastCh.current) {
        lastCh.current = sc.ch;
        voice.current?.pause();
        voice.current = new Audio(`/film3/audio/${lang}/${nn(sc.ch)}.mp3`);
        voice.current.play().catch(() => {});
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [lang, stopAuto]);
  useEffect(() => {
    if (!auto) return;
    const user = () => stopAuto();
    window.addEventListener("wheel", user, { passive: true });
    window.addEventListener("touchstart", user, { passive: true });
    window.addEventListener("keydown", user);
    return () => { window.removeEventListener("wheel", user); window.removeEventListener("touchstart", user); window.removeEventListener("keydown", user); };
  }, [auto, stopAuto]);
  useEffect(() => () => { music.current?.pause(); voice.current?.pause(); }, []);

  const s = SCENES[pos.i];
  const fadeK = pos.t > 1 - FADE && pos.i < SCENES.length - 1 ? (pos.t - (1 - FADE)) / FADE : 0;
  const inK = cl(pos.t / 0.08) * (1 - fadeK);
  const insured = SCENES.slice(0, pos.i + 1).some((x) => x.insured);
  const lines = SCENES.slice(0, pos.i + 1).filter((x) => x.toast || x.receipt).length;

  // subtitle: lines split the scene evenly
  const subs = s.sub ?? [];
  const sIdx = subs.length ? Math.min(subs.length - 1, Math.floor(cl(pos.t / 0.9) * subs.length)) : -1;
  const sLocal = subs.length ? (cl(pos.t / 0.9) * subs.length) - sIdx : 0;
  const subK = sIdx < 0 ? 0 : Math.min(cl(sLocal / 0.12), sIdx === subs.length - 1 ? 1 - fadeK : cl((1 - sLocal) / 0.1)) * (pos.t < 0.02 ? 0 : 1);

  return (
    <div className="bg-[#07090d] text-[#eef0f4]">
      <div ref={wrap} style={{ height: `${TOTAL_VH}vh` }} className="relative" data-testid="film3" data-scene={s.id}>
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          {SCENES.map((x, k) => {
            const op = k === pos.i ? 1 : k === pos.i + 1 ? fadeK : 0;
            const z = k === pos.i + 1 ? 2 : 1;
            if (x.insert) {
              if (op <= 0) return null;
              return (
                <div key={x.id} className="absolute inset-0" style={{ opacity: op, zIndex: z }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/film3/${x.bg}.jpg`} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-[.35]" />
                  <div className="absolute inset-0 pb-[18vh] pt-[12vh]"><InsertView kind={x.insert} t={k === pos.i ? pos.t : 0} lang={lang} /></div>
                </div>
              );
            }
            return (
              <video key={x.id} ref={(v) => { vids.current[k] = v; }} muted playsInline preload={loaded.has(k) ? "auto" : "none"}
                poster={`/film3/${x.clip}.jpg`} src={loaded.has(k) ? `/film3/${x.clip}.mp4` : undefined}
                className="absolute inset-0 h-full w-full object-cover" style={{ opacity: op, zIndex: z, visibility: op > 0 ? "visible" : "hidden" }} />
            );
          })}

          {/* legibility: top and bottom bands only — the car stays clean */}
          <div className="pointer-events-none absolute inset-0 z-[3]" style={{ background: "linear-gradient(180deg,rgba(7,9,13,.6),transparent 22%,transparent 62%,rgba(7,9,13,.82))" }} />

          {/* top bar */}
          <div className="absolute inset-x-0 top-0 z-[6] flex items-start justify-between px-4 pt-4 sm:px-12 sm:pt-7">
            <div>
              <b className="text-[11px] font-semibold uppercase tracking-[.26em]">Hanbridge Auto</b>
              {!s.hero && <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[.28em] text-amber-300" style={{ opacity: inK || 1 }}>
                <i className="inline-block h-px w-6 bg-amber-300" />{nn(s.ch)} · {CHAPTERS[s.ch][lang]}</div>}
            </div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[.2em]">
              {lines > 0 && <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[#c9ced8] backdrop-blur">{UI.receipt[lang]} · {lines}</span>}
              <Shield on={insured} lang={lang} />
            </div>
          </div>

          {/* hero */}
          {s.hero && (
            <div className="absolute inset-x-0 top-[18vh] z-[6] px-5 text-center" style={{ opacity: pos.t < 0.05 ? 1 : 1 - fadeK }}>
              <h1 className="font-serif text-5xl font-light tracking-wide sm:text-8xl">Hanbridge <span className="text-amber-300">Auto</span></h1>
              <p className="mt-3 text-lg font-light text-[#e3e6ec] sm:text-2xl">{UI.tagline[lang]}</p>
              <button onClick={auto ? stopAuto : startAuto} className="mt-8 rounded-full bg-amber-300 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_10px_40px_rgba(252,211,77,.35)]">{auto ? UI.stop[lang] : UI.watch[lang]}</button>
              <div className="mt-4 text-[11px] uppercase tracking-[.3em] text-[#c9ced8]">{UI.scroll[lang]} ↓</div>
            </div>
          )}

          {/* fact chips */}
          {s.chips && (
            <div className="absolute right-4 top-20 z-[6] flex flex-col items-end gap-2 sm:right-12 sm:top-28">
              {s.chips.map((c, n) => {
                const k = cl((pos.t - 0.15 - n * 0.2) / 0.08) * (1 - fadeK);
                return <span key={n} className="rounded-full border border-amber-300/40 bg-black/45 px-4 py-2 text-sm font-semibold text-amber-200 backdrop-blur-md" style={{ opacity: k, transform: `translateX(${(1 - k) * 16}px)` }}>{c[lang]}</span>;
              })}
            </div>
          )}

          {/* one-line receipt toast */}
          {s.toast && <Toast line={s.toast} lang={lang} k={cl((pos.t - 0.2) / 0.08) * cl((0.85 - pos.t) / 0.08)} />}

          {/* full receipt: Busan and customs only */}
          {s.receipt && <Receipt lines={s.receipt === "busan" ? RECEIPT_BUSAN : RECEIPT_CUSTOMS} lang={lang} k={cl((pos.t - 0.08) / 0.1) * (1 - fadeK)} />}

          {/* narrator subtitle */}
          {sIdx >= 0 && (
            <div className="absolute inset-x-0 bottom-[9vh] z-[6] flex justify-center px-5 sm:bottom-[8vh]">
              <p key={`${s.id}-${sIdx}`} className="max-w-[900px] text-center text-[21px] font-semibold leading-snug sm:text-[32px]"
                style={{ opacity: subK, transform: `translateY(${(1 - subK) * 8}px)`, textShadow: "0 2px 18px rgba(0,0,0,.85), 0 1px 3px rgba(0,0,0,.9)" }}>
                {subs[sIdx][lang]}
              </p>
            </div>
          )}

          {/* end CTA */}
          {s.cta && (
            <div className="absolute inset-x-0 bottom-[22vh] z-[6] flex flex-wrap justify-center gap-3 px-5" style={{ opacity: cl((pos.t - 0.35) / 0.1) }}>
              <a href="/cars" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950">{UI.cta[lang]}</a>
              <a href="#proof" className="rounded-full border border-white/25 bg-black/40 px-5 py-3 text-sm font-semibold backdrop-blur-md">{UI.seeReport[lang]}</a>
            </div>
          )}

          {/* progress = the golden line */}
          <div className="absolute inset-x-0 bottom-0 z-[6] h-[3px] bg-white/10">
            <div className="h-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.8)]" style={{ width: `${((starts[pos.i] + pos.t * s.vh) / TOTAL_VH) * 100}%` }} />
          </div>

          {/* floating pause / play while the film is past the hero */}
          {!s.hero && (
            <button onClick={auto ? stopAuto : startAuto} className="absolute bottom-[3vh] right-4 z-[7] rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-semibold backdrop-blur-md sm:right-12">
              {auto ? UI.stop[lang] : UI.watch[lang]}
            </button>
          )}
        </div>
      </div>

      <section id="proof" className="relative">
        <div className="mx-auto max-w-3xl px-5 pb-6 pt-24 text-center">
          <div className="mb-3 text-[11px] uppercase tracking-[.3em] text-amber-300">11 · {CHAPTERS[11][lang]}</div>
          <h2 className="font-serif text-3xl font-light sm:text-5xl">{UI.proofTitle[lang]}</h2>
          <p className="mt-3 text-[#c9ced8]">{UI.proofSub[lang]}</p>
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
      <span className="hidden sm:inline">{UI.insured[lang]}</span>
    </span>
  );
}

function Payee({ l, lang }: { l: Line; lang: Lang }) {
  return (
    <span className="shrink-0 text-right">
      <span className={l.by === "zero" ? "font-semibold text-emerald-300" : "font-semibold"}>{l.by === "zero" ? "0" : `→ ${l.payee[lang]}`}</span>
      {l.by !== "zero" && <span className="block text-[10px] uppercase tracking-[.12em] text-[#8b93a3]">{l.by === "you" ? UI.byYou[lang] : UI.byInvoice[lang]}</span>}
    </span>
  );
}

function Toast({ line, lang, k }: { line: Line; lang: Lang; k: number }) {
  return (
    <div className="absolute right-4 top-[20vh] z-[6] w-[min(320px,calc(100vw-32px))] rounded-2xl border border-white/12 bg-[#0e1117]/75 p-3.5 text-[13px] backdrop-blur-xl sm:right-12"
      style={{ opacity: k, transform: `translateX(${(1 - k) * 24}px)` }}>
      <div className="mb-1 text-[10px] uppercase tracking-[.2em] text-amber-300">+ {UI.receipt[lang]}</div>
      <div className="flex items-start justify-between gap-3"><span className="text-[#dfe3ea]">{line.item[lang]}</span><Payee l={line} lang={lang} /></div>
      {line.by === "zero" && SHOW_VAT_NOTE && <p className="mt-2 border-t border-white/[.07] pt-2 text-[11px] leading-snug text-[#aab1bd]">{UI.zeroNote[lang]}</p>}
    </div>
  );
}

function Receipt({ lines, lang, k }: { lines: Line[]; lang: Lang; k: number }) {
  return (
    <div className="absolute right-4 top-[14vh] z-[6] w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/12 bg-[#0e1117]/78 p-4 text-[13px] backdrop-blur-xl sm:right-12 sm:top-[18vh]"
      style={{ opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[.2em] text-[#8b93a3]"><span>{UI.receipt[lang]}</span><span>{lines.length}</span></div>
      {lines.map((l, n) => (
        <div key={n} className="flex items-start justify-between gap-3 border-t border-white/[.07] py-2 first-of-type:border-0" style={{ opacity: cl(k * lines.length - n) }}>
          <span className="text-[#dfe3ea]">{l.item[lang]}</span><Payee l={l} lang={lang} />
        </div>
      ))}
    </div>
  );
}
