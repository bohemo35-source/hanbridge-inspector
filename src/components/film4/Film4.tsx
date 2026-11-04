// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v4 player ("trailer"): scroll-scrubbed clips with letterbox, grain, grade and Ken Burns; act cards; transitions (dissolve / light wipe / zoom-through / dip); word-by-word trailer lines; ledger toasts; watch mode; then the garage proof
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code
// @updated: 2026-11-03 claude-code — portrait: the whole 16:9 frame in a band over the scene's pre-blurred picture (film3/b/); phones: pre-blurred insert backgrounds; watch mode starts without waiting for the voice and follows it only while its clock advances (a stuck voice froze the picture), timing prefetched; big lines under the band in portrait; coming clips woken in watch mode
// @updated: 2026-11-03 claude-code — phones: `hb-lite` (no SVG glow / blur / backdrop blur in inserts and maps), first poster high priority
// @updated: 2026-11-03 claude-code — phones: light clips (film3/m/), poster image always under the clip, the clip shows once it has a frame, decoder woken once
// @updated: 2026-11-03 claude-code — clip time spans the transition tail too: the incoming clip moves while it fades in (was parked on frame 0)
// @updated: 2026-11-04 claude-code — Play/Stop generation counter, followY, clipSync (drift by rate, seek past 1 s); portrait: 4:3 band with equal gaps (portrait.ts), line under it, cards under the line — never over the picture
// @updated: 2026-11-04 claude-code — portrait: Play / "or scroll" under the picture band (title stays on it); sound balance baked into drums-mix.mp3 (iOS ignores .volume): voice 1.0, drums 0.35
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Report } from "@/lib/schema";
import type { GarageData } from "@/lib/garage/data";
import InsertView from "./Inserts";
import { ACTS, RECEIPT_BUSAN, RECEIPT_CUSTOMS, SCENES, UI, type Lang, type Line, type Scene } from "./story";
import { TW, clipProgress, clipSpan, clipSync } from "./clipTime";
import { portraitLayout } from "./portrait";
import { followY, newVoiceClock, voiceDecision } from "./voiceFollow";

const GarageScene = dynamic(() => import("@/components/garage-3d/GarageScene"), { ssr: false });
const GarageStudio = dynamic(() => import("@/components/garage-studio/GarageStudio"), { ssr: false });

/** say how we earn (Korea export VAT refund) under the zero-commission line — a business fact the owner wants shown */
const SHOW_VAT_NOTE = true;
const starts = (() => { let a = 0; return SCENES.map((s) => { const v = a; a += s.vh; return v; }); })();
const TOTAL_VH = SCENES.reduce((a, s) => a + s.vh, 0);
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** narration timing built by scripts/film4/align-narration.mts: scene id → [start, end] seconds in the voice file */
type Narration = { file: string; duration: number; scenes: Record<string, [number, number]> };
const actStart = ACTS.map((_, a) => starts[SCENES.findIndex((s) => s.act === a)] ?? 0);

export default function Film4({ report, lang, garage }: { report?: Report; lang: Lang; garage?: GarageData }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [pos, setPos] = useState({ i: 0, t: 0 });
  const posRef = useRef(0); posRef.current = pos.i;
  const [auto, setAuto] = useState(false);
  const [narrow, setNarrow] = useState(false);
  /** the film stage (sticky, 100svh) in CSS px: the portrait layout is computed from it */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 390, h: 844 });
  /** phones and narrow windows get the light clips (film3/m/: 540p, ~1 MB); null until mounted, so no clip starts loading twice */
  const [mob, setMob] = useState<boolean | null>(null);
  /** clips that have a decoded frame: until then the poster image shows (phones used to see black scenes) */
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const markReady = useCallback((id: string) => setReady((r) => (r.has(id) ? r : new Set(r).add(id))), []);
  const unmarkReady = useCallback((id: string) => setReady((r) => { if (!r.has(id)) return r; const n = new Set(r); n.delete(id); return n; }), []);
  const autoRef = useRef(false);
  const autoGen = useRef(0); // each Play / Stop starts a new run: a Play that resumes after its await only goes on if no Stop or Play came meanwhile
  /** watch mode: seconds a scene lasts (clips then play natively instead of being scrubbed); null while scrolling */
  const playSec = useRef<((i: number) => number) | null>(null);

  /* capture scripts read the timeline from here */
  useEffect(() => { if (location.search.includes("capture")) (window as unknown as { __film4: unknown }).__film4 = { ids: SCENES.map((x) => x.id), starts, vhs: SCENES.map((x) => x.vh) }; }, []);

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
      setPos((p) => (p.i === i && Math.abs(p.t - t) < 0.0015 ? p : { i, t }));
      const sec = playSec.current;
      // a clip's time runs over the previous scene's transition tail (TW) plus its own scene: the incoming clip is already
      // moving while it fades in and carries on without a jump (it used to wait on frame 0 for the whole transition)
      const len = (k: number) => (sec ? Math.max(0.5, sec(k)) : SCENES[k].vh);
      vids.current.forEach((v, k) => {
        if (!v || !v.duration) return;
        const local = clipProgress(k, i, t, len); // see clipTime.ts (tested)
        if (local === null) { if (!v.paused) v.pause(); return; }
        const span = clipSpan(k, len);
        const target = Math.min(v.duration - 0.05, local * v.duration);
        if (sec) {
          // watch mode: native playback at the pace of the scene; small drift caught up by rate, seek only past 1 s (clipTime.ts, tested)
          const { seekTo, rate } = clipSync(v.currentTime, target, v.duration / span);
          if (Math.abs(v.playbackRate - rate) > 0.02) v.playbackRate = rate;
          if (seekTo !== null) v.currentTime = seekTo;
          if (v.paused && target < v.duration - 0.1) v.play().catch(() => {});
          return;
        }
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const rs = () => {
      const el = stageRef.current, w = el?.clientWidth || window.innerWidth, h = el?.clientHeight || window.innerHeight;
      setNarrow(w < h); setStage((p) => (p.w === w && p.h === h ? p : { w, h })); on();
    };
    // phones = touch screens or windows under 900 px (a narrow desktop window too); follows changes of the media query
    const mq = window.matchMedia?.("(pointer: coarse), (max-width: 899px)");
    setMob(mq ? mq.matches : window.innerWidth < 900);
    const onMq = (e: MediaQueryListEvent) => setMob(e.matches);
    mq?.addEventListener?.("change", onMq);
    rs();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", rs);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", rs); mq?.removeEventListener?.("change", onMq); cancelAnimationFrame(raf); };
  }, []);

  /* watch mode: drums only (CC0, unfa) + narration. With a narration timing file the scroll follows the voice;
     without it, each scene runs at its own pace (scene.sec). */
  const music = useRef<HTMLAudioElement | null>(null);
  const narr = useRef<HTMLAudioElement | null>(null);
  const timing = useRef<Narration | null | undefined>(undefined);
  const fade = (a: HTMLAudioElement | null, to: number, ms = 900, then?: () => void) => {
    if (!a) return; const from = a.volume, t0 = performance.now();
    const f = (now: number) => { const k = Math.min(1, (now - t0) / ms); a.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(f); else then?.(); };
    requestAnimationFrame(f);
  };
  const stopAuto = useCallback(() => {
    autoRef.current = false; autoGen.current++; setAuto(false); playSec.current = null;
    narr.current?.pause(); fade(music.current, 0, 700, () => music.current?.pause());
  }, []);
  const startAuto = useCallback(async () => {
    const el = wrap.current; if (!el) return;
    autoRef.current = true; setAuto(true); const gen = ++autoGen.current;
    const top0 = el.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY < top0 || window.scrollY > top0 + (TOTAL_VH - 1) * window.innerHeight / 100) window.scrollTo(0, top0);
    if (timing.current === undefined) timing.current = await fetch(`/film3/audio/narration-${lang}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!autoRef.current || gen !== autoGen.current) return; // stopped (wheel, Stop) or Play pressed again while the timing was loading: one loop, no music without a picture
    const tm = timing.current;
    // The balance lives in the files, not in .volume: iOS Safari ignores HTMLMediaElement.volume (always 1), so on an iPhone every
    // volume set here was heard as 1.0 / 1.0 (voice only 3.4 dB over the drums). drums-mix.mp3 = drums.mp3 × 0.35 (−29.9 LUFS, made with
    // ffmpeg), voice −17.4 LUFS at 1.0 → the voice sits 12.5 dB over the drums on every device; .volume only fades in/out (desktop, Android).
    // (history: 1.0 / 0.22, 0.8 / 0.35, 0.8 / 0.58 — the owner: "the voice got quiet, the drums loud", back to drums 0.35, voice 1.0)
    if (!music.current) { music.current = new Audio("/film3/audio/drums-mix.mp3"); music.current.loop = true; music.current.volume = 0; }
    music.current.play().then(() => fade(music.current, 1, 1500)).catch(() => {});
    playSec.current = (i) => { const w = tm?.scenes[SCENES[i].id]; return w ? w[1] - w[0] : SCENES[i].sec; };
    // where the voice should be for the current scroll position
    const vhNow = () => window.innerHeight / 100;
    const sceneAt = (yy: number) => { const local = (yy - top0) / vhNow(); let i = SCENES.length - 1; while (i > 0 && starts[i] > local) i--; return { i, t: cl((local - starts[i]) / SCENES[i].vh) }; };
    if (tm) {
      if (!narr.current || narr.current.dataset.lang !== lang) { narr.current?.pause(); narr.current = new Audio(tm.file); narr.current.dataset.lang = lang; narr.current.volume = 1; }
      const { i, t } = sceneAt(window.scrollY); const w = tm.scenes[SCENES[i].id];
      if (w) narr.current.currentTime = w[0] + t * (w[1] - w[0]);
      narr.current.play().catch(() => {});
    }
    let y = window.scrollY, prev = performance.now();
    // A stuck voice never holds the picture (a phone stood 2.5 s on the title; a voice stuck after a seek froze the picture for minutes):
    // the picture follows the voice only while the voice's clock really advances, otherwise it keeps the scene's pace; when the voice moves
    // again and is more than 1 s off, the voice is brought to the picture (a voice slightly behind is waited for, see followY).
    const voiceAt = (yy: number) => { const { i, t } = sceneAt(yy); const w = tm?.scenes[SCENES[i].id]; return w ? w[0] + t * (w[1] - w[0]) : null; };
    const clock = newVoiceClock(); // see voiceFollow.ts (tested)
    const step = (now: number) => {
      if (!autoRef.current || gen !== autoGen.current) return;
      const dt = Math.min(64, now - prev); prev = now;
      const vh = vhNow();
      const a = narr.current;
      const d = tm && a ? voiceDecision(clock, now, { time: a.currentTime, paused: a.paused, readyState: a.readyState }, voiceAt(y)) : { follow: false, seekTo: null };
      if (a && d.seekTo !== null) a.currentTime = d.seekTo;
      if (tm && a && d.follow) {
        // follow the voice: find the scene whose window holds the audio time
        const time = a.currentTime;
        let j = SCENES.findIndex((sc) => { const w = tm.scenes[sc.id]; return w && time >= w[0] && time < w[1]; });
        if (j < 0) j = time >= tm.duration - 0.05 ? SCENES.length - 1 : sceneAt(y).i;
        const w = tm.scenes[SCENES[j].id];
        const k = w ? cl((time - w[0]) / Math.max(0.01, w[1] - w[0])) : 0;
        y = followY(y, top0 + (starts[j] + k * SCENES[j].vh) * vh); // never backwards
      } else {
        // the scene's own pace (the voice window when there is narration, so picture and voice stay in step)
        const { i } = sceneAt(y); const sc = SCENES[i];
        y += (sc.vh * vh) / (Math.max(0.5, playSec.current?.(i) ?? sc.sec) * 1000) * dt;
      }
      if ((y - top0) / vh >= TOTAL_VH - 0.5) { stopAuto(); return; }
      window.scrollTo(0, y);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [stopAuto, lang]);
  useEffect(() => { // the voice timing is small: fetch it ahead so Play starts without waiting
    if (timing.current !== undefined) return;
    fetch(`/film3/audio/narration-${lang}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (timing.current === undefined) timing.current = j; }).catch(() => undefined);
  }, [lang]);
  useEffect(() => () => { music.current?.pause(); narr.current?.pause(); }, []);
  useEffect(() => () => { autoRef.current = false; }, []); // unmount stops the autoscroll loop
  useEffect(() => {
    if (!auto) return;
    const user = () => stopAuto();
    window.addEventListener("wheel", user, { passive: true });
    window.addEventListener("touchstart", user, { passive: true });
    window.addEventListener("keydown", user);
    return () => { window.removeEventListener("wheel", user); window.removeEventListener("touchstart", user); window.removeEventListener("keydown", user); };
  }, [auto, stopAuto]);

  const s = SCENES[pos.i];
  // only neighbours keep a decoder: ~30 open videos crash mobile Safari and headless Chrome
  // clips are all-intra (every frame a keyframe), so a scrub seek decodes one frame; the next two are preloaded
  const near = (k: number) => k >= pos.i - 1 && k <= pos.i + 2;
  const next = SCENES[pos.i + 1] as Scene | undefined;
  const e = next ? ease(seg(pos.t, 1 - TW, 1)) : 0; // transition progress into the next scene
  const outK = 1 - e;
  const insured = SCENES.slice(0, pos.i + 1).some((x) => x.insured);
  const ledger = SCENES.slice(0, pos.i + 1).filter((x) => x.toast || x.receipt).length;
  const lb = narrow ? 0 : 7.5; // letterbox, vh (2.39:1 feel on desktop)
  // portrait: header · band · line · card · rail with equal gaps (portrait.ts, tested); null on landscape screens and for insert/card scenes
  const pl = (x: Scene) => (narrow && x.clip ? portraitLayout(stage.w, stage.h, cardRoom(x)) : null);
  const P = pl(s);
  const overall = (starts[pos.i] + pos.t * s.vh) / TOTAL_VH;

  return (
    <div className={`bg-ink text-bone ${mob ? "hb-lite" : ""}`}>
      <div ref={wrap} style={{ height: `${TOTAL_VH + 100}vh` }} className="relative" data-testid="film4" data-scene={s.id}>
        <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-ink">
          {/* picture */}
          <div className="absolute inset-0">
            {SCENES.map((x, k) => {
              const cur = k === pos.i, inc = k === pos.i + 1 && e > 0;
              if (!cur && !inc && !(x.clip && near(k))) return null;
              const st = layerStyle(x, cur ? "cur" : inc ? "inc" : "off", cur ? pos.t : 0, e, next?.in);
              if (x.card || x.end) {
                if (!cur && !inc) return null;
                return <div key={x.id} className="absolute inset-0 bg-ink" style={{ opacity: st.opacity, zIndex: st.z }} />;
              }
              if (x.insert) {
                if (!cur && !inc) return null;
                return (
                  <div key={x.id} className="absolute inset-0" style={{ ...st.style, zIndex: st.z }}>
                    {/* phones: the same look from a pre-blurred image (film3/b/) — no CSS blur redrawn every frame, and never a black scene */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mob ? `/film3/b/${x.bg}.jpg` : `/film3/${x.bg}.jpg`} alt=""
                      className={mob ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[.42] saturate-[.6]"} />
                    <div className="absolute inset-0" style={{ paddingTop: `${lb + 9}vh`, paddingBottom: `${lb + 17}vh` }}>
                      <InsertView kind={x.insert} t={cur ? pos.t : 0} lang={lang} report={report} />
                    </div>
                  </div>
                );
              }
              return (
                // the poster image is always under the clip; the clip shows once it has a frame (iOS does not paint a never-played video)
                <div key={x.id} className="absolute inset-0 will-change-transform" data-clip={x.clip}
                  style={{ ...st.style, zIndex: st.z, visibility: cur || inc ? "visible" : "hidden" }}>
                  {/* portrait: cropping 16:9 to the screen showed a third of the frame — the whole frame goes in a band, the scene blurred behind */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {narrow && <img src={`/film3/b/${x.clip}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  {/* the band: a 4:3 crop of the 16:9 clip around the scene's subject (posM), placed by portraitLayout */}
                  <div className={narrow ? "absolute inset-x-0 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.6)]" : "absolute inset-0"} style={narrow ? { top: pl(x)?.bandTop, height: pl(x)?.bandH } : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/film3/${x.clip}.jpg`} alt="" decoding="async" fetchPriority={k === 0 ? "high" : "auto"} className="absolute inset-0 h-full w-full object-cover" style={narrow ? { objectPosition: x.posM } : undefined} />
                  <video ref={(v) => { vids.current[k] = v; }} muted playsInline preload={near(k) ? "auto" : "none"}
                    src={near(k) && mob !== null ? `/film3/${mob ? "m/" : ""}${x.clip}.mp4` : undefined}
                    onLoadStart={() => unmarkReady(x.id)} onLoadedData={() => markReady(x.id)} onSeeked={() => markReady(x.id)} onPlaying={() => markReady(x.id)}
                    onLoadedMetadata={(e) => {
                      // phones: play once muted to wake the decoder and start buffering (iOS may ignore preload), so scroll seeks paint frames
                      // and the next clip is ready in watch mode; the tick pauses any clip that is not on screen
                      const v = e.currentTarget; if (mob) v.play().then(() => { if (!playSec.current || vids.current.indexOf(v) > posRef.current + 1) v.pause(); }).catch(() => {});
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ opacity: ready.has(x.id) ? 1 : 0, objectPosition: narrow ? x.posM : undefined }} />
                  </div>
                </div>
              );
            })}
            {/* light wipe edge: the bridge's golden line sweeping across */}
            {next?.in === "wipe" && e > 0 && e < 1 && (
              <div className="pointer-events-none absolute inset-y-0 z-[3] w-[2px]" style={{ left: `${e * 100}%`, background: "var(--sodium-hi)", boxShadow: "0 0 18px 4px rgba(255,201,138,.75), 0 0 80px 24px rgba(238,166,90,.35)" }} />
            )}
          </div>

          {/* grade: vignette + grain, letterbox bars */}
          <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(6,7,8,.55) 100%), linear-gradient(180deg, rgba(6,7,8,.35), transparent 26%, transparent 58%, rgba(6,7,8,.78))" }} />
          <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"><div className="hb-grain" /></div>
          <div className="absolute inset-x-0 top-0 z-[5] bg-ink" style={{ height: `${lb}vh` }} />
          <div className="absolute inset-x-0 bottom-0 z-[5] bg-ink" style={{ height: `${lb}vh` }} />

          {/* top bar, inside the letterbox */}
          <div className="absolute inset-x-0 top-0 z-[6] flex items-center justify-between px-4 sm:px-10" style={{ height: lb ? `${lb}vh` : 56 }}>
            <div className="flex items-center gap-4">
              <span className="font-display text-[15px] font-semibold uppercase tracking-[.42em] text-bone">Hanbridge</span>
              {!s.open && <span className="hidden font-mono text-[10.5px] uppercase tracking-[.22em] text-mist sm:inline">{ACTS[s.act].n} · {ACTS[s.act].title[lang]}</span>}
            </div>
            <div className="flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-[.22em]">
              {ledger > 0 && <span className="hidden text-bone-2 sm:inline">{UI.ledger[lang]} · {String(ledger).padStart(2, "0")}</span>}
              <span className="flex items-center gap-2 transition-colors duration-700" style={{ color: insured ? "var(--signal)" : "rgba(239,233,223,.25)" }}>
                <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "currentColor", boxShadow: insured ? "0 0 10px currentColor" : "none" }} />{UI.insured[lang]}
              </span>
            </div>
          </div>

          {/* opening title */}
          {/* portrait: the title sits on the picture band, Play and "or scroll" under it (in the line's slot) — never over the picture */}
          {s.open && (
            <div className={`absolute z-[6] flex flex-col items-center justify-center px-5 text-center ${P ? "inset-x-0" : "inset-0"}`} style={{ opacity: 1 - e, ...(P ? { top: P.bandTop, height: P.bandH } : {}) }}>
              <div className="font-mono text-[11px] uppercase tracking-[.5em] text-sodium-hi/90">{UI.presents[lang]}</div>
              <h1 className="mt-5 font-display text-[clamp(54px,11vw,168px)] font-medium uppercase leading-[.86] tracking-[.12em]" style={{ textShadow: "0 4px 60px rgba(0,0,0,.6)" }}>Hanbridge</h1>
              <p className="mt-5 font-display text-[clamp(20px,2.4vw,34px)] italic text-bone/90">{UI.tagline[lang]}</p>
              {!P && (
                <div className="mt-10 flex flex-col items-center gap-4">
                  <PlayButton on={auto} onClick={auto ? stopAuto : startAuto} lang={lang} />
                  <span className="font-mono text-[10px] uppercase tracking-[.4em] text-bone-2">{UI.scroll[lang]}</span>
                </div>
              )}
            </div>
          )}
          {s.open && P && (
            // centred between the band and the progress rail (40 px); the block (button 62 + 12 + "or scroll" 15) is 89 px tall
            <div className="absolute inset-x-0 z-[6] flex flex-col items-center gap-3" style={{ top: P.bandTop + P.bandH + Math.max(P.gap, (stage.h - 40 - P.bandTop - P.bandH - 89) / 2), opacity: 1 - e }}>
              <PlayButton on={auto} onClick={auto ? stopAuto : startAuto} lang={lang} />
              <span className="font-mono text-[10px] uppercase tracking-[.4em] text-bone-2">{UI.scroll[lang]}</span>
            </div>
          )}

          {/* act card */}
          {s.card && <ActCard s={s} t={pos.t} out={outK} lang={lang} />}

          {/* end card */}
          {s.end && <EndCard t={pos.t} lang={lang} />}

          {/* fact chips (right) */}
          {s.chips && (
            <div className={`absolute z-[6] flex flex-col gap-2 ${P ? "inset-x-4 items-center" : "right-4 items-end sm:right-10"}`} style={{ top: P ? P.cardTop : `${lb + 6}vh` }}>
              {s.chips.map((c, n) => {
                const k = seg(pos.t, 0.14 + n * 0.16, 0.24 + n * 0.16) * outK;
                return <span key={n} className="border-l border-sodium bg-ink/55 px-3.5 py-2 font-mono text-[12px] uppercase tracking-[.14em] text-sodium-hi backdrop-blur-md" style={{ opacity: k, transform: `translateX(${(1 - k) * 18}px)` }}>{c[lang]}</span>;
              })}
            </div>
          )}

          {/* portrait: cards go under the line, never over the picture */}
          {s.toast && <Toast line={s.toast} lang={lang} k={seg(pos.t, 0.16, 0.26) * seg(1 - pos.t, 0.12, 0.22)} top={P ? P.cardTop : `${lb + 6}vh`} centred={!!P} />}
          {s.receipt && <Receipt lines={s.receipt === "busan" ? RECEIPT_BUSAN : RECEIPT_CUSTOMS} lang={lang} k={seg(pos.t, 0.06, 0.18) * outK} top={P ? P.cardTop : `${lb + 6}vh`} compact={!!P} />}

          {/* trailer lines */}
          {/* portrait: big lines too sit under the picture band, not over it */}
          {s.lines && <Lines s={s} t={pos.t} out={outK} lang={lang} bottom={lb + (narrow ? 12 : 6)} top={P?.textTop} big={!!s.big && !narrow} />}

          {/* progress rail: four acts, inside the bottom letterbox */}
          <div className="absolute inset-x-0 bottom-0 z-[6] flex items-end px-4 sm:px-10" style={{ height: lb ? `${lb}vh` : 40, paddingBottom: lb ? "2.2vh" : 12 }}>
            <div className="relative flex w-full gap-1.5">
              {ACTS.map((a, n) => {
                const from = actStart[n] / TOTAL_VH, to = (actStart[n + 1] ?? TOTAL_VH) / TOTAL_VH;
                const k = cl((overall - from) / (to - from));
                return (
                  <div key={n} className="flex-1" style={{ flexGrow: to - from }}>
                    <div className="mb-1.5 hidden font-mono text-[9.5px] uppercase tracking-[.24em] sm:block" style={{ color: k > 0 && k < 1 ? "var(--bone)" : "var(--mist)" }}>{a.n} {a.title[lang]}</div>
                    <div className="h-px bg-bone/15"><div className="h-full bg-sodium" style={{ width: `${k * 100}%`, boxShadow: k > 0 && k < 1 ? "0 0 10px var(--sodium)" : "none" }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {!s.open && !s.end && (
            <button onClick={auto ? stopAuto : startAuto} className="absolute right-4 z-[7] font-mono text-[10.5px] uppercase tracking-[.22em] text-bone-2 hover:text-bone sm:right-10" style={{ bottom: lb ? `${lb + 2.4}vh` : 52 }}>
              {auto ? UI.stop[lang] : UI.watch[lang]}
            </button>
          )}
        </div>
      </div>

      <section id="proof" className="relative bg-ink">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-28 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.4em] text-sodium">{UI.proofKicker[lang]}</div>
          <h2 className="mt-5 font-display text-[clamp(34px,5vw,64px)] font-medium leading-[1.02]">{UI.proofTitle[lang]}</h2>
          <p className="mt-4 text-[17px] text-bone-2">{UI.proofSub[lang]}</p>
        </div>
        {garage ? <GarageStudio data={garage} lang={lang} embedded /> : <GarageScene report={report} lang={lang} />}
        {garage && <div className="pb-16 pt-6 text-center"><a href={`/garage/${garage.carId}${lang === "ru" ? "?lang=ru" : ""}`} className="font-mono text-[11px] uppercase tracking-[.22em] text-bone-2 hover:text-sodium">{UI.allGarages[lang]} →</a></div>}
      </section>
    </div>
  );
}

/** How a layer looks: current scene (Ken Burns), incoming scene (by its transition), or hidden. */
const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function layerStyle(x: Scene, role: "cur" | "inc" | "off", t: number, e: number, how: Scene["in"] = "dissolve") {
  const grade = "contrast(1.07) saturate(.9)";
  if (REDUCED) { // plain crossfade, no push-in, zoom or blur
    const op = role === "cur" ? 1 : role === "inc" ? e : 0;
    return { opacity: op, z: role === "inc" ? 2 : 1, style: { opacity: op, filter: grade } as React.CSSProperties };
  }
  const kb = 1.02 + 0.05 * t; // slow push-in
  if (role === "off") return { opacity: 0, z: 0, style: { opacity: 0 } as React.CSSProperties };
  if (role === "cur") {
    // the outgoing picture reacts to the transition it hands over to
    let scale = kb, bright = 1, blur = 0, op = 1;
    if (how === "zoom") { scale = kb * (1 + 0.55 * e * e); blur = 10 * e; op = 1 - e * e; }
    else if (how === "dissolve") { scale = kb * (1 + 0.04 * e); bright = 1 - 0.35 * e; }
    else if (how === "dip") { op = 1 - cl(e * 1.8); }
    else if (how === "wipe") { bright = 1 - 0.25 * e; }
    return { opacity: op, z: 1, style: { opacity: op, transform: `scale(${scale})`, filter: `${grade} brightness(${bright}) ${blur ? `blur(${blur}px)` : ""}` } as React.CSSProperties };
  }
  // incoming
  if (how === "wipe") return { opacity: 1, z: 2, style: { clipPath: `inset(0 ${(1 - e) * 100}% 0 0)`, transform: "scale(1.02)", filter: grade } as React.CSSProperties };
  if (how === "zoom") return { opacity: e, z: 2, style: { opacity: e, transform: `scale(${1.18 - 0.16 * e})`, filter: grade } as React.CSSProperties };
  if (how === "dip") { const k = cl((e - 0.45) / 0.55); return { opacity: k, z: 2, style: { opacity: k, transform: "scale(1.02)", filter: grade } as React.CSSProperties }; }
  return { opacity: e, z: 2, style: { opacity: e, transform: `scale(${1.08 - 0.06 * e})`, filter: `${grade} blur(${(1 - e) * 8}px)` } as React.CSSProperties };
}

function PlayButton({ on, onClick, lang }: { on: boolean; onClick: () => void; lang: Lang }) {
  return (
    <button onClick={onClick} aria-label={on ? UI.stop[lang] : UI.watch[lang]} className="group flex items-center gap-4 rounded-full border border-bone/30 bg-ink/30 py-2 pl-2 pr-6 backdrop-blur-md transition-colors hover:border-sodium">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-sodium text-ink shadow-[0_0_40px_rgba(238,166,90,.45)]">
        {on ? <svg width="12" height="14" viewBox="0 0 12 14"><rect width="4" height="14" fill="currentColor" /><rect x="8" width="4" height="14" fill="currentColor" /></svg>
          : <svg width="13" height="15" viewBox="0 0 13 15"><path d="M0 0 13 7.5 0 15Z" fill="currentColor" /></svg>}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[.28em] text-bone">{on ? UI.stop[lang] : UI.watch[lang]}</span>
    </button>
  );
}

function ActCard({ s, t, out, lang }: { s: Scene; t: number; out: number; lang: Lang }) {
  const c = s.card!;
  const a = ease(seg(t, 0.05, 0.4)), line = ease(seg(t, 0.12, 0.6));
  return (
    <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center px-6 text-center" style={{ opacity: out }}>
      <div className="font-mono text-[11px] uppercase tracking-[.55em] text-sodium" style={{ opacity: a }}>{c.n}</div>
      <h2 className="mt-6 font-display text-[clamp(46px,8vw,120px)] font-medium italic leading-[.95]" style={{ opacity: a, filter: `blur(${(1 - a) * 10}px)`, transform: `translateY(${(1 - a) * 18}px) scale(${1 + 0.04 * t})`, letterSpacing: `${0.01 + 0.02 * t}em` }}>{c.title[lang]}</h2>
      <div className="mt-8 h-px bg-sodium" style={{ width: `${line * 22}vw`, boxShadow: "0 0 14px var(--sodium)" }} />
      {c.sub && <p className="mt-6 max-w-[680px] font-display text-[clamp(22px,2.3vw,34px)] italic text-bone/85" style={{ opacity: ease(seg(t, 0.3, 0.6)) }}>{c.sub[lang]}</p>}
    </div>
  );
}

function EndCard({ t, lang }: { t: number; lang: Lang }) {
  const a = ease(seg(t, 0.05, 0.35)), b = ease(seg(t, 0.25, 0.55)), c = ease(seg(t, 0.4, 0.7));
  return (
    <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[clamp(52px,10vw,150px)] font-medium uppercase leading-none tracking-[.14em]" style={{ opacity: a, filter: `blur(${(1 - a) * 12}px)` }}>Hanbridge</div>
      <div className="mt-5 font-display text-[clamp(22px,2.6vw,38px)] italic text-sodium-hi" style={{ opacity: b }}>{UI.endLine[lang]}</div>
      <p className="mt-6 max-w-[640px] font-mono text-[11.5px] uppercase leading-relaxed tracking-[.2em] text-bone-2" style={{ opacity: b }}>{UI.endFacts[lang]}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3" style={{ opacity: c, transform: `translateY(${(1 - c) * 10}px)` }}>
        <a href="#proof" className="rounded-full bg-sodium px-6 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[.22em] text-ink shadow-[0_0_40px_rgba(238,166,90,.35)]">{UI.seeProof[lang]}</a>
        <a href={`/inspect/new${lang === "ru" ? "?lang=ru" : ""}`} className="rounded-full border border-bone/30 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[.22em] text-bone hover:border-sodium">{UI.checkOwn[lang]}</a>
      </div>
    </div>
  );
}

/** Trailer lines: one after another; each line's words arrive from blur, then the line leaves. */
function Lines({ s, t, out, lang, bottom, top, big }: { s: Scene; t: number; out: number; lang: Lang; bottom: number; top?: number; big: boolean }) {
  const lines = s.lines!;
  const span = 0.9 / lines.length;
  const idx = Math.min(lines.length - 1, Math.floor(cl((t - 0.04) / 0.9) * lines.length));
  const local = cl((t - 0.04 - idx * span) / span);
  const leave = idx === lines.length - 1 ? out : seg(1 - local, 0, 0.14);
  const words = lines[idx][lang].split(" ");
  return (
    <div className={`absolute inset-x-0 z-[6] flex justify-center px-5 ${big ? "top-0 items-center" : ""}`} style={big ? { bottom: "26vh" } : top !== undefined ? { top } : { bottom: `${bottom}vh` }}>
      <p key={`${s.id}-${idx}`} className={`max-w-[1100px] text-center font-display font-medium leading-[1.06] ${big ? "text-[clamp(40px,6.4vw,104px)]" : "text-[clamp(28px,3.5vw,54px)]"}`}
        style={{ opacity: leave, textShadow: "0 2px 30px rgba(0,0,0,.75), 0 1px 3px rgba(0,0,0,.6)" }}>
        {words.map((w, n) => {
          const k = ease(seg(local, 0.02 + (n / words.length) * 0.28, 0.12 + (n / words.length) * 0.28));
          return <span key={n} className="inline-block whitespace-pre" style={{ opacity: k, filter: `blur(${(1 - k) * 8}px)`, transform: `translateY(${(1 - k) * 10}px)` }}>{w}{n < words.length - 1 ? " " : ""}</span>;
        })}
      </p>
    </div>
  );
}

function Payee({ l, lang, inline }: { l: Line; lang: Lang; inline?: boolean }) {
  return (
    <span className="shrink-0 text-right">
      <span className={l.by === "zero" ? "font-mono text-[15px] text-ok" : "font-mono text-[11px] uppercase tracking-[.12em] text-bone"}>{l.by === "zero" ? "0" : `→ ${l.payee[lang]}`}</span>
      {/* portrait receipt: who issues the invoice goes on the same line, so five lines fit under the picture */}
      {l.by !== "zero" && <span className={`font-mono text-[9.5px] uppercase tracking-[.16em] text-mist ${inline ? "ml-2" : "mt-0.5 block"}`}>{l.by === "you" ? UI.byYou[lang] : UI.byInvoice[lang]}</span>}
    </span>
  );
}

const panel = "absolute right-4 z-[6] w-[min(340px,calc(100vw-32px))] border border-bone/12 bg-ink/70 backdrop-blur-xl sm:right-10";
/** portrait: the card spans the screen width (16 px gutters), centred, up to 400 px */
const centre = { left: 16, right: 16, width: "auto", maxWidth: 400, marginInline: "auto" } as const;
/** portrait: px a scene's card takes under its line — measured on the rendered cards at 390 px (scripts/film4/portrait-shots.mjs) */
const CARD = { receiptHead: 66, row: 32, toast: 94, toastNote: 120, chip: 42 };
const cardRoom = (x: Scene) =>
  x.receipt ? CARD.receiptHead + CARD.row * (x.receipt === "busan" ? RECEIPT_BUSAN : RECEIPT_CUSTOMS).length
    : x.toast ? (x.toast.by === "zero" && SHOW_VAT_NOTE ? CARD.toastNote : CARD.toast)
      : x.chips ? CARD.chip * x.chips.length : 0;

function Toast({ line, lang, k, top, centred }: { line: Line; lang: Lang; k: number; top: number | string; centred?: boolean }) {
  return (
    <div className={`${panel} p-4`} style={{ ...(centred ? centre : {}), top, opacity: k, transform: centred ? `translateY(${(1 - k) * 10}px)` : `translateX(${(1 - k) * 24}px)` }}>
      <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[.26em] text-sodium">+ {UI.ledger[lang]}</div>
      <div className="flex items-start justify-between gap-3 text-[14px]"><span className="text-bone">{line.item[lang]}</span><Payee l={line} lang={lang} /></div>
      {line.by === "zero" && SHOW_VAT_NOTE && <p className="mt-3 border-t border-bone/10 pt-3 text-[12px] leading-snug text-bone-2">{UI.zeroNote[lang]}</p>}
    </div>
  );
}

function Receipt({ lines, lang, k, top, compact }: { lines: Line[]; lang: Lang; k: number; top: number | string; compact?: boolean }) {
  return (
    <div className={`${panel} ${compact ? "px-4 py-3" : "p-5"}`} style={{ ...(compact ? centre : {}), top, opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
      <div className="mb-3 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[.26em] text-mist"><span className="text-sodium">{UI.ledger[lang]}</span><span>{String(lines.length).padStart(2, "0")}</span></div>
      {lines.map((l, n) => (
        <div key={n} className={`flex items-start justify-between gap-3 border-t border-bone/10 first-of-type:border-0 ${compact ? "py-1.5 text-[12px]" : "py-2.5 text-[13.5px]"}`} style={{ opacity: cl(k * lines.length - n) }}>
          <span className="text-bone">{l.item[lang]}</span><Payee l={l} lang={lang} inline={compact} />
        </div>
      ))}
    </div>
  );
}
