// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: One 3D block: mounts a WebGL scene only near the viewport (max 2 canvases), fully disposes when far
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (film grade overlay: vignette, tint, grain; crossfade with the previous block)
"use client";
import { useEffect, useRef } from "react";
import { mountScene, acquireCanvas, releaseCanvas, type SceneBuilder, type Mounted } from "./sceneKit";
import { loadCarTemplate, cloneCar } from "./useCar";
import { buildSeoul } from "./scenes/SeoulScene";
import { buildPort } from "./scenes/PortScene";
import { buildVladivostok } from "./scenes/VladivostokScene";
import { buildRoad } from "./scenes/RoadScene";
import { buildFinale } from "./scenes/FinaleScene";
import { makePlateScene } from "./scenes/PlateScene";
import type { PlateConfig } from "./blocks";
import FilmGrade from "./FilmGrade";
import { leadStyle, useStageFade } from "./useStageFade";

const BUILDERS: Record<string, { build: SceneBuilder; env?: string }> = {
  seoul: { build: buildSeoul },
  port: { build: buildPort },
  vladivostok: { build: buildVladivostok },
  road: { build: buildRoad },
  finale: { build: buildFinale },
};

export default function SceneBlock({ sceneId, blockId, heightVh, mobileScale, onProgress, plate, lead = false, exit = 0 }: { sceneId: string; blockId?: string; heightVh: number; mobileScale: number; onProgress?: (blockId: string, local: number) => void; plate?: PlateConfig; lead?: boolean; exit?: number }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<Mounted | null>(null);
  const localRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  useStageFade(outerRef, stageRef, veilRef, lead, exit);

  useEffect(() => {
    const outer = outerRef.current, host = hostRef.current;
    if (!outer || !host) return;
    let disposed = false;
    const cfg = BUILDERS[sceneId];
    const updateLocal = () => {
      const r = outer.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      localRef.current = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      mountedRef.current?.setProgress(localRef.current);
      onProgress?.(sceneId, localRef.current);
    };
    const tryMount = async () => {
      if (disposed || mountedRef.current || !cfg || !acquireCanvas()) return;
      try {
        const template = await loadCarTemplate();
        if (disposed || mountedRef.current) { releaseCanvas(); return; }
        const car = cloneCar(template);
        let builder = cfg.build;
        if (plate) {
          const ok = await new Promise<boolean>((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = plate.image; });
          if (ok) builder = makePlateScene(plate, new URLSearchParams(window.location.search).has("debug"));
          // on plate load error the legacy code scene stays as fallback
        }
        mountedRef.current = mountScene(host, builder, car);
        updateLocal();
      } catch { releaseCanvas(); /* poster fallback stays visible */ }
    };
    const unmount = () => { mountedRef.current?.dispose(); mountedRef.current = null; releaseCanvas(); };
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) void tryMount(); });
    }, { rootMargin: "100% 0px 100% 0px" });
    io.observe(outer);
    const ioFar = new IntersectionObserver((es) => {
      es.forEach((e) => { if (!e.isIntersecting) unmount(); });
    }, { rootMargin: "200% 0px 200% 0px" });
    ioFar.observe(outer);
    const onScroll = () => updateLocal();
    window.addEventListener("scroll", onScroll, { passive: true });
    updateLocal();
    return () => { disposed = true; io.disconnect(); ioFar.disconnect(); window.removeEventListener("scroll", onScroll); unmount(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  const poster = plate?.image ?? (sceneId === "seoul" ? "/journey-v2/env-seoul-night.jpg" : sceneId === "port" ? "/journey-v2/env-port-night.jpg" : sceneId === "vladivostok" ? "/journey-v2/env-vladivostok-dawn.jpg" : sceneId === "finale" ? "/journey-v2/env-golden-hour.jpg" : "/journey-v2/tex-terrain-forest.jpg");
  return (
    <section ref={outerRef} data-journey-block={blockId ?? sceneId} data-lead={lead ? "1" : undefined} className="relative w-full" style={leadStyle(`${heightVh}vh * ${mobileScale}`, lead)}>
      <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#07090d]" style={lead ? { opacity: 0 } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div ref={hostRef} data-testid={`scene-${sceneId}`} className="absolute inset-0" />
        <FilmGrade tint={plate?.grade} vignette={sceneId === "road" ? 0.4 : 0.5} />
        <div ref={veilRef} aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-0" />
      </div>
    </section>
  );
}
