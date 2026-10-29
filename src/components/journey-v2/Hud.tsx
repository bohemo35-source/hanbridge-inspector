// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 HUD: stage rail (click = smooth scroll), caption zone, RU/EN, always-visible CTA
// @created: 2026-10-29
"use client";
import type { Lang } from "./copy";
import { HUD_LABELS, FINALE } from "./copy";
import { HUD_ORDER, startProgressOf } from "./blocks";

export function scrollToBlock(blockId: string) {
  const totalVh = document.documentElement.scrollHeight - window.innerHeight;
  const y = startProgressOf(blockId) * totalVh + window.innerHeight * 0.05;
  window.scrollTo({ top: y, behavior: "smooth" });
}

export default function Hud({ lang, activeKey, caption, reportId }: { lang: Lang; activeKey: string; caption: string; reportId?: string }) {
  return (
    <>
      <nav aria-label="Journey stages" className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex" data-testid="journey-hud">
        {HUD_ORDER.map((s) => (
          <button key={s.key} onClick={() => scrollToBlock(s.blockId)} data-hud-stage={s.key}
            className={`rounded-full border px-3 py-1 text-left text-[11px] backdrop-blur-md transition ${s.key === activeKey ? "border-amber-300 bg-amber-300/90 font-semibold text-zinc-950" : "border-white/20 bg-black/45 text-zinc-200 hover:bg-black/65"}`}>
            {HUD_LABELS[s.key][lang]}
          </button>
        ))}
      </nav>
      <nav aria-label="Journey stages" className="fixed inset-x-0 top-0 z-40 flex gap-1 overflow-x-auto p-2 sm:hidden">
        {HUD_ORDER.map((s) => (
          <button key={s.key} onClick={() => scrollToBlock(s.blockId)} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] backdrop-blur-md ${s.key === activeKey ? "border-amber-300 bg-amber-300/90 font-semibold text-zinc-950" : "border-white/20 bg-black/45 text-zinc-200"}`}>{HUD_LABELS[s.key][lang]}</button>
        ))}
      </nav>
      <div className="pointer-events-none fixed bottom-5 left-5 z-40 max-w-md sm:bottom-8 sm:left-8" data-testid="journey-caption">
        <p className="rounded-xl bg-black/35 px-3 py-2 text-lg font-medium leading-snug text-white backdrop-blur-sm sm:text-2xl">{caption}</p>
        <p className="mt-2 px-3 text-xs text-zinc-300">{FINALE.totalNote[lang]}</p>
      </div>
      <div className="fixed bottom-5 right-4 z-40 flex items-center gap-2 sm:bottom-8 sm:right-6">
        <a href={lang === "ru" ? "/" : "/?lang=ru"} className="rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-md" aria-label="Language">{lang === "ru" ? "RU → EN" : "EN → RU"}</a>
        <a href="/cars" className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg">{FINALE.pickCar[lang]}</a>
        {reportId && <a href={`/r/${reportId}`} className="hidden rounded-full border border-white/25 bg-black/50 px-3 py-2 text-xs text-white backdrop-blur-md md:block">{FINALE.demoReport[lang]}</a>}
      </div>
    </>
  );
}
