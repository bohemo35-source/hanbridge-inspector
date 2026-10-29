// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film look over a journey block (3D plate or bridge): vignette, soft-light tint, animated grain — one picture, car + photo
// @created: 2026-10-30
"use client";

// static fractal noise tile (SVG feTurbulence), moved in steps for a film-grain flicker
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

export default function FilmGrade({ tint, tintOpacity = 0.16, vignette = 0.5 }: { tint?: string; tintOpacity?: number; vignette?: number }) {
  return (
    <>
      <style>{`@keyframes jv2-grain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}100%{transform:translate(1%,3%)}}
        .jv2-grain{animation:jv2-grain .5s steps(4) infinite}
        @media (prefers-reduced-motion: reduce){.jv2-grain{animation:none}}`}</style>
      {tint && <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: tint, opacity: tintOpacity }} />}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 75% 70% at 50% 46%, transparent 52%, rgba(0,0,0,${vignette}) 100%)` }} />
      <div aria-hidden className="pointer-events-none absolute -inset-[6%] overflow-hidden">
        <div className="jv2-grain absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      </div>
    </>
  );
}
