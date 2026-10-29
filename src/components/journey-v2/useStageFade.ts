// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Soft block transitions: a block overlaps the previous one by LEAD_VH and crossfades in over FADE_VH of scroll with a short dip to dark
// @created: 2026-10-30
"use client";
import { useEffect, type CSSProperties, type RefObject } from "react";

/** The next sticky stage pins FADE_VH before the previous one releases (100vh would be a plain slide). */
export const FADE_VH = 18; // ≈0.5 s of scroll at ~3 s per 100vh
export const LEAD_VH = 100 + FADE_VH;
const DIP = 0.45; // max darkening of each stage while they cross

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** Section style for a block that overlaps the previous one (total page height unchanged: margin and height cancel). */
export function leadStyle(heightCss: string, lead: boolean): CSSProperties {
  return lead ? { marginTop: `-${LEAD_VH}vh`, height: `calc(${heightCss} + ${LEAD_VH}vh)` } : { height: `calc(${heightCss})` };
}

/**
 * lead: fade this stage in once it pins (it sits invisible above the previous stage while its section scrolls in);
 * exit: darken this stage over its last FADE_VH of pinned scroll (the next block crossfades in on top).
 */
export function useStageFade(sectionRef: RefObject<HTMLElement | null>, stageRef: RefObject<HTMLElement | null>, veilRef: RefObject<HTMLElement | null>, lead: boolean, exit: number) {
  useEffect(() => {
    if (!lead && !exit) return;
    let raf = 0;
    const run = () => {
      const el = sectionRef.current, stage = stageRef.current, veil = veilRef.current;
      if (!el || !stage) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight, o = (vh * FADE_VH) / 100;
      const fin = lead ? smooth(-r.top / o) : 1;
      const fout = exit ? smooth(1 - (r.bottom - vh) / o) : 0;
      stage.style.opacity = fin >= 0.999 ? "" : fin.toFixed(3);
      stage.style.pointerEvents = fin < 0.99 ? "none" : "";
      if (veil) veil.style.opacity = Math.max(DIP * (1 - fin), exit * fout).toFixed(3);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [sectionRef, stageRef, veilRef, lead, exit]);
}
