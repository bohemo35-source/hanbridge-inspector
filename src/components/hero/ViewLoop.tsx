// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: A muted looping video that plays only while it is on screen: off screen it is paused, so it neither decodes nor
//           restarts its loop (a seek every 7.6 s) while the visitor watches the film below
// @created: 2026-11-04
"use client";
import { useEffect, useRef } from "react";

export default function ViewLoop({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} className={className} />;
}
