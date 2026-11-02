// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Hero bridge: lazy-loaded three.js bridge (click to take apart into 6 groups), HTML labels that follow the groups and link to the sections; static SVG silhouette without WebGL2 or with reduced motion
// @created: 2026-11-02
"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { Projection } from "./bridge";

type Lang = "en" | "ru";
type Group = { name: string; note: string; href: string };

const T = {
  en: { explode: "Take the bridge apart", assemble: "Put it back together", hint: "Click a part of the bridge or a label to open a section", aria: "3D bridge: take it apart to see the six parts of Hanbridge" },
  ru: { explode: "Разобрать мост", assemble: "Собрать", hint: "Кликните часть моста или подпись, чтобы открыть раздел", aria: "3D-мост: разберите его, чтобы увидеть шесть частей Hanbridge" },
} as const;

/** group index = assembly group from the geometry (0..5); labels are shown only when the bridge is apart */
function groupsFor(lang: Lang, reportHref: string): Group[] {
  const q = lang === "ru" ? "?lang=ru" : "";
  const ru = lang === "ru";
  return [
    { name: ru ? "Осмотр" : "Inspect", note: ru ? "живой прогон агента" : "live agent run", href: `/inspect/kia-sportage${q}` },
    { name: ru ? "Доказательства" : "Evidence", note: ru ? "отчёт с доказательствами" : "report with proof", href: `${reportHref}${q}` },
    { name: ru ? "Гараж" : "Garage", note: ru ? "3D-гараж авто" : "3D garage of the car", href: `/garage/kia-sportage${q}` },
    { name: ru ? "Путь" : "Journey", note: ru ? "фильм о рейсе" : "the film of the trip", href: `/${q}#journey` },
    { name: ru ? "Своё авто" : "Your car", note: ru ? "загрузить фото" : "upload your photos", href: `/inspect/new${q}` },
    { name: ru ? "Честный чек" : "Open receipt", note: ru ? "один инвойс, ноль комиссии" : "one invoice, zero commission", href: `/${q}#journey` },
  ];
}

/** no-WebGL / reduced-motion fallback and the placeholder while three.js loads: the bridge as a line drawing */
function BridgeSilhouette({ className }: { className: string }) {
  const cables: ReactElement[] = [];
  for (const px of [190, 410]) {
    for (let i = 0; i < 12; i++) {
      const dx = -150 + i * 27 + (i >= 6 ? 14 : 0);
      cables.push(<line key={`${px}-${i}`} x1={px} y1={62} x2={px + dx * 0.9} y2={218} stroke="#efe9df" strokeOpacity={0.28} strokeWidth={0.8} />);
    }
  }
  const deck: ReactElement[] = [];
  for (let i = 0; i < 24; i++) deck.push(<line key={i} x1={40 + i * 11} y1={218} x2={40 + (i + 1) * 11 - 1.5} y2={218} stroke="#eea65a" strokeWidth={2.2} strokeOpacity={0.9} />);
  return (
    <svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
      <line x1="0" y1="262" x2="600" y2="262" stroke="#efe9df" strokeOpacity={0.12} />
      {cables}
      {[190, 410].map((px) => (
        <g key={px}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={px - 7} y={218 - 22 - i * 30} width={14} height={22} fill="#15181b" stroke="#8d949b" strokeOpacity={0.6} />
          ))}
        </g>
      ))}
      {deck}
    </svg>
  );
}

export default function BridgeHero({ lang, reportHref }: { lang: Lang; reportHref: string }) {
  const router = useRouter();
  const t = T[lang];
  const groups = groupsFor(lang, reportHref);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const host = useRef<HTMLDivElement>(null);
  const labelEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const handle = useRef<{ setExploded(on: boolean): void; dispose(): void } | null>(null);
  const [mode, setMode] = useState<"static" | "loading" | "live">("static");
  const [exploded, setExploded] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!host.current) return;
    let canWebgl = false;
    try {
      const probe = document.createElement("canvas");
      canWebgl = !!probe.getContext("webgl2");
      probe.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { canWebgl = false; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canWebgl || reduce) return; // the silhouette stays
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    let alive = true;
    setMode("loading");
    // after first paint: the headline and buttons are already on screen, three.js comes in afterwards
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const id = idle(() => {
      import("./bridge").then(({ createBridge }) => {
        if (!alive || !host.current) return;
        handle.current = createBridge(host.current, {
          mobile,
          onGroupHover: (g) => setHover(g),
          onGroupClick: (g) => {
            const href = groupsRef.current[g]?.href;
            if (href) router.push(href);
          },
          onExplodedChange: (on) => setExploded(on),
          onFrame: (project: (g: number) => Projection | null) => {
            labelEls.current.forEach((el, i) => {
              if (!el) return;
              const p = project(i);
              if (!p) return;
              el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
              el.style.visibility = p.visible ? "visible" : "hidden";
            });
          },
        });
        setMode("live");
      }).catch(() => setMode("static"));
    });
    return () => {
      alive = false;
      if (typeof id === "number" && "cancelIdleCallback" in window) (window as Window & { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id);
      handle.current?.dispose();
      handle.current = null;
    };
  }, [router]);

  return (
    <div className="relative h-[46svh] min-h-[300px] w-full select-none md:h-auto md:min-h-[520px]">
      <BridgeSilhouette className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${mode === "live" ? "opacity-0" : "opacity-100"}`} />
      <div ref={host} role="img" aria-label={t.aria} className="absolute inset-0 z-[1] touch-pan-y" style={{ maskImage: "radial-gradient(75% 70% at 50% 50%, #000 55%, transparent 100%)", WebkitMaskImage: "radial-gradient(75% 70% at 50% 50%, #000 55%, transparent 100%)" }} /* the bay dissolves into the page: no hard black box */ />
      {mode === "live" && (
        <>
          <div className={`pointer-events-none absolute inset-0 z-[2] transition-opacity duration-500 ${exploded ? "opacity-100" : "opacity-0"}`}>
            {groups.map((g, i) => (
              <Link
                key={g.href + i}
                ref={(el: HTMLAnchorElement | null) => { labelEls.current[i] = el; }}
                href={g.href}
                tabIndex={exploded ? 0 : -1}
                aria-hidden={!exploded}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`absolute left-0 top-0 whitespace-nowrap border bg-ink/80 px-2 py-1.5 md:px-3 md:py-2 backdrop-blur-sm transition-colors ${exploded ? "pointer-events-auto" : "pointer-events-none"} ${hover === i ? "border-sodium text-sodium-hi" : "border-bone/25 text-bone hover:border-sodium"}`}
              >
                <span className="block font-mono text-[11px] uppercase tracking-[.16em]">{g.name}</span>
                <span className="hidden font-mono text-[10.5px] uppercase tracking-[.12em] text-bone-2 md:block">{g.note}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handle.current?.setExploded(!exploded)}
            className="absolute bottom-4 left-4 z-[3] rounded-full border border-sodium/60 bg-ink/75 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] text-sodium-hi transition-colors hover:border-sodium"
          >
            {exploded ? t.assemble : t.explode}
          </button>
          <p className="pointer-events-none absolute bottom-5 right-4 hidden md:block z-[3] max-w-[280px] text-right font-mono text-[11px] uppercase tracking-[.14em] text-bone-2">{t.hint}</p>
        </>
      )}
      {mode === "static" && (
        <nav className="absolute bottom-3 left-0 right-0 z-[2] flex flex-wrap justify-center gap-x-4 gap-y-2 px-4 font-mono text-[11px] uppercase tracking-[.16em] text-bone-2">
          {groups.map((g) => (
            <Link key={g.href + g.name} href={g.href} className="hover:text-bone">{g.name}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}
