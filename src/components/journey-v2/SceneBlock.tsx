// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: One 3D block: mounts a WebGL scene only near the viewport (max 2 canvases), fully disposes when far
// @created: 2026-10-29
"use client";
import { useEffect, useRef } from "react";
import { mountScene, acquireCanvas, releaseCanvas, type SceneBuilder, type Mounted } from "./sceneKit";
import { loadCarTemplate, cloneCar } from "./useCar";
import { buildSeoul } from "./scenes/SeoulScene";
import { buildPort } from "./scenes/PortScene";
import { buildVladivostok } from "./scenes/VladivostokScene";
import { buildRoad } from "./scenes/RoadScene";
import { buildFinale } from "./scenes/FinaleScene";

const BUILDERS: Record<string, { build: SceneBuilder; env?: string }> = {
  seoul: { build: buildSeoul },
  port: { build: buildPort },
  vladivostok: { build: buildVladivostok },
  road: { build: buildRoad },
  finale: { build: buildFinale },
};

export default function SceneBlock({ sceneId, blockId, heightVh, mobileScale, onProgress }: { sceneId: string; blockId?: string; heightVh: number; mobileScale: number; onProgress?: (blockId: string, local: number) => void }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<Mounted | null>(null);
  const localRef = useRef(0);

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
        mountedRef.current = mountScene(host, cfg.build, car);
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

  const poster = sceneId === "seoul" ? "/journey-v2/env-seoul-night.jpg" : sceneId === "port" ? "/journey-v2/env-port-night.jpg" : sceneId === "vladivostok" ? "/journey-v2/env-vladivostok-dawn.jpg" : sceneId === "finale" ? "/journey-v2/env-golden-hour.jpg" : "/journey-v2/tex-terrain-forest.jpg";
  return (
    <section ref={outerRef} data-journey-block={blockId ?? sceneId} className="relative w-full" style={{ height: `calc(${heightVh}vh * ${mobileScale})` }}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#07090d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div ref={hostRef} data-testid={`scene-${sceneId}`} className="absolute inset-0" />
      </div>
    </section>
  );
}
