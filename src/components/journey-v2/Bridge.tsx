// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Bridge between 3D blocks: full-screen Muse Image with slow push-in + parallax and glass stage cards
// @created: 2026-10-29
"use client";
import { useEffect, useRef } from "react";
import { STAGE_CONTENT, CONTENT_LABELS, type Lang } from "@/components/journey-3d/stageContent";
import type { StageId } from "@/components/journey-3d/route";
import { STAGE_LABELS } from "@/components/journey-3d/route";
import { EXTRA_CARDS } from "./copy";

export default function Bridge({ id, image, stage, heightVh, mobileScale, lang }: { id: string; image: string; stage: StageId; heightVh: number; mobileScale: number; lang: Lang }) {
  const ref = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current, img = imgRef.current;
        if (!el || !img) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        img.style.transform = `scale(${1.06 + p * 0.14}) translateY(${(p - 0.5) * -36}px)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  const c = STAGE_CONTENT[stage];
  const extras = EXTRA_CARDS[id] ?? [];
  const rows: Array<[string, string]> = [
    [CONTENT_LABELS.what[lang], c.what[lang]], [CONTENT_LABELS.docs[lang], c.docs[lang]],
    [CONTENT_LABELS.owner[lang], c.owner[lang]], [CONTENT_LABELS.clientSees[lang], c.clientSees[lang]], [CONTENT_LABELS.typical[lang], c.typical[lang]],
  ];
  return (
    <section ref={ref} data-journey-block={id} className="relative w-full" style={{ height: `calc(${heightVh}vh * ${mobileScale})` }}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#07090d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={image} alt="" className="absolute inset-0 h-full w-full object-cover will-change-transform" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
        {id === "bridge-customs" && <div className="absolute left-1/2 top-[22%] -translate-x-1/2 rotate-[-6deg] rounded-lg border-4 border-emerald-300/90 px-6 py-2 text-3xl font-black uppercase tracking-widest text-emerald-300/90" style={{ animation: "jv2-stamp 1s ease both" }}>Cleared</div>}
        <style>{`@keyframes jv2-stamp{from{opacity:0;transform:translateX(-50%) scale(1.6) rotate(-6deg)}to{opacity:1;transform:translateX(-50%) scale(1) rotate(-6deg)}}`}</style>
        <div className="absolute inset-x-0 bottom-0 mx-auto grid w-full max-w-5xl gap-3 p-5 sm:grid-cols-2 sm:p-8">
          <article className="rounded-2xl border border-white/20 bg-black/45 p-5 text-zinc-100 backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/90">{STAGE_LABELS[stage][lang]}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {rows.map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-28 shrink-0 text-zinc-400">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </article>
          {extras.map((e) => (
            <article key={e.title.en} className="rounded-2xl border border-white/20 bg-black/45 p-5 text-zinc-100 backdrop-blur-md">
              <h3 className="font-semibold text-amber-100">{e.title[lang]}</h3>
              <p className="mt-2 text-sm text-zinc-200">{e.body[lang]}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
