// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v3 code inserts driven by scene progress t (0..1): route maps (Korea, sea + fan of cities, the road) and portal UI (request, selection, report, fork)
// @created: 2026-11-01
// @updated: 2026-11-02 claude-code — film v4 restyle (sodium palette, editorial cards, mono labels)
"use client";
import type { Insert, Lang } from "./story";
import MAP from "./map-data.json";
import type { Report } from "@/lib/schema";
import { panelLabel } from "@/lib/domain/panels";

const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const tr = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);

export default function InsertView({ kind, t, lang, report }: { kind: Insert; t: number; lang: Lang; report?: Report }) {
  switch (kind) {
    case "request": return <Request t={t} lang={lang} />;
    case "pick": return <Pick t={t} lang={lang} />;
    case "report": return <AgentReport t={t} lang={lang} report={report} />;
    case "fork": return <Fork t={t} lang={lang} />;
    case "mapKr": return <RouteMap mode="kr" t={t} lang={lang} />;
    case "mapFan": return <RouteMap mode="fan" t={t} lang={lang} />;
    case "mapRoad": return <RouteMap mode="road" t={t} lang={lang} />;
  }
}

/* ---------- portal UI ---------- */
const Card = ({ children, k, className = "" }: { children: React.ReactNode; k: number; className?: string }) => (
  <div className={`rounded-[6px] border border-bone/12 bg-ink/75 p-5 shadow-[0_40px_120px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-7 ${className}`}
    style={{ opacity: ease(k), transform: `translateY(${(1 - ease(k)) * 24}px) scale(${0.97 + 0.03 * ease(k)})` }}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-4 font-mono text-[10.5px] uppercase tracking-[.3em] text-sodium">{children}</div>;

function Typed({ text, k }: { text: string; k: number }) {
  const n = Math.round(text.length * cl(k));
  return <>{text.slice(0, n)}<span className="text-sodium" style={{ opacity: k > 0 && k < 1 ? 1 : 0 }}>▍</span></>;
}

function Request({ t, lang }: { t: number; lang: Lang }) {
  const rows: [string, string][] = [
    [tr(lang, "Car", "Автомобиль"), "Kia Sportage · 2021+"],
    [tr(lang, "Colour", "Цвет"), tr(lang, "White", "Белый")],
    [tr(lang, "Budget", "Бюджет"), tr(lang, "up to ₩25,000,000", "до ₩25 000 000")],
    [tr(lang, "Timing", "Сроки"), tr(lang, "within 2 months", "в течение 2 месяцев")],
  ];
  return (
    <div className="flex h-full items-center justify-center px-5">
      <Card k={seg(t, 0, 0.15)} className="w-full max-w-[460px]">
        <Label>{tr(lang, "Your request", "Ваша заявка")}</Label>
        {rows.map(([k, v], i) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-t border-white/[.07] py-3 first-of-type:border-0">
            <span className="text-sm text-mist">{k}</span>
            <span className="text-right text-base font-medium sm:text-lg"><Typed text={v} k={seg(t, 0.12 + i * 0.14, 0.24 + i * 0.14)} /></span>
          </div>
        ))}
        <div className={`mt-4 rounded-full py-3 text-center text-sm font-semibold transition-colors duration-500 ${t > 0.78 ? "bg-sodium text-zinc-950" : "bg-white/10 text-white/40"}`}>
          {t > 0.78 ? tr(lang, "Sent ✓", "Отправлено ✓") : tr(lang, "Send", "Отправить")}
        </div>
      </Card>
    </div>
  );
}

function Pick({ t, lang }: { t: number; lang: Lang }) {
  const cars = [
    { img: "/film3/s0-6.jpg", y: "2021", km: "58 000", p: "₩ 22 400 000", pos: "40% 50%" },
    { img: "/film3/s10-4.jpg", y: "2022", km: "41 000", p: "₩ 24 900 000", pos: "60% 55%" },
    { img: "/film3/s2-1.jpg", y: "2022", km: "36 000", p: "₩ 25 300 000", pos: "50% 50%" },
  ];
  const chosen = t > 0.5;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[.3em] text-sodium" style={{ opacity: seg(t, 0, 0.1) }}>{tr(lang, "Selection from your manager", "Подборка от менеджера")}</div>
      <div className="grid w-full max-w-[920px] grid-cols-3 gap-2 sm:gap-4">
        {cars.map((c, i) => {
          const on = chosen && i === 1;
          return (
            <Card key={i} k={seg(t, 0.05 + i * 0.08, 0.2 + i * 0.08)} className={`!p-2 sm:!p-3 transition-[box-shadow,border-color] duration-500 ${on ? "!border-sodium shadow-[0_0_0_2px_rgba(238,166,90,.7),0_30px_80px_rgba(0,0,0,.6)]" : chosen ? "opacity-60" : ""}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[4px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: c.pos }} />
                <span className="absolute left-2 top-2 rounded-[2px] bg-ink/70 px-2 py-0.5 text-[10px] uppercase tracking-wider">Encar</span>
                {on && <span className="absolute right-2 top-2 rounded-[2px] bg-sodium px-2 py-0.5 text-[10px] font-semibold text-zinc-950">{tr(lang, "Chosen", "Выбрано")}</span>}
              </div>
              <div className="px-1 pt-2 sm:px-2">
                <div className="text-xs font-medium sm:text-sm">Kia Sportage · {c.y}</div>
                <div className="text-[10px] text-mist sm:text-xs">{c.km} {tr(lang, "km", "км")}</div>
                <div className="mt-1 text-sm font-semibold text-sodium-hi sm:text-base">{c.p}</div>
                <div className="text-[9px] uppercase tracking-wider text-mist sm:text-[10px]">{tr(lang, "platform price", "цена площадки")}</div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="max-w-[520px] rounded-[4px] rounded-bl-sm bg-ink-3/90 px-4 py-3 text-sm backdrop-blur" style={{ opacity: seg(t, 0.55, 0.68), transform: `translateY(${(1 - seg(t, 0.55, 0.68)) * 10}px)` }}>
        <b className="text-sodium">{tr(lang, "Manager", "Менеджер")}:</b> {tr(lang, "this one has a clean history. Shall we inspect it?", "у этой чистая история. Едем смотреть?")}
      </div>
    </div>
  );
}

/** The agent at work on the real report: which Meta model did what, one real finding with its proof, the verdict. */
function AgentReport({ t, lang, report }: { t: number; lang: Lang; report?: Report }) {
  const r = report;
  const steps = r?.trace.length ?? 14;
  const readings = r?.paintReadings.length ?? 13;
  const fnd = r?.findings ?? [];
  const ver = fnd.filter((f) => f.verified).length;
  const rows: [string, string][] = [
    ["SAM 3.1", tr(lang, "car, panels and plate segmented", "машина, детали и номер выделены")],
    ["Muse Glimmer", tr(lang, "every photo indexed and described", "каждое фото описано и в индексе")],
    ["Muse Voice Transcribe", readings ? tr(lang, `inspector's voice → ${readings} readings`, `голос инспектора → ${readings} замеров`) : tr(lang, "inspector's voice → quotes with timecodes", "голос инспектора → цитаты с таймкодами")],
    ["Muse Spark", tr(lang, `${steps} agent steps · ${fnd.length} findings`, `${steps} шагов агента · находок: ${fnd.length}`)],
    ["Muse Spark Open", tr(lang, `independent check · ${ver}/${fnd.length} verified`, `независимая проверка · ${ver}/${fnd.length} подтверждено`)],
  ];
  // the strongest proof to show: a verified finding with a photo, else any finding with a photo
  const KIND: Record<string, [string, string]> = { repaint: ["Repainted", "Перекрас"], putty: ["Putty under the paint", "Шпатлёвка под краской"], panel_replaced: ["Panel replaced", "Деталь заменена"], dent: ["Dent", "Вмятина"], scratch: ["Scratch", "Царапина"], rust: ["Rust", "Ржавчина"], mechanical: ["Mechanical issue", "Механика"], other: ["Note", "Замечание"] };
  const withPhoto = (f: Report["findings"][number]) => f.evidence.find((e) => r?.mediaUrls?.[e.mediaId]);
  const f = fnd.find((x) => x.verified && withPhoto(x)) ?? fnd.find(withPhoto) ?? fnd[0];
  const ev = f ? withPhoto(f) : undefined;
  const img = ev ? r?.mediaUrls?.[ev.mediaId] : undefined;
  const quote = f?.evidence.find((e) => e.quote)?.quote;
  const microns = f?.evidence.find((e) => e.gaugeMicrons)?.gaugeMicrons;
  const dec = r?.verdict.decision ?? "BUY";
  const decColor = dec === "BUY" ? "#86cfa2" : dec === "WALK_AWAY" ? "#e2574c" : "#eea65a";
  const kR = seg(t, 0.5, 0.62), kV = seg(t, 0.7, 0.8);
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="grid w-full max-w-[1060px] items-center gap-4 sm:grid-cols-[1.05fr_1fr] sm:gap-6">
        <Card k={seg(t, 0, 0.1)}>
          <Label>{tr(lang, "Agent · Meta models", "Агент · модели Meta")} — {r ? `${r.vehicle.make} ${r.vehicle.model}` : "Kia Sportage"}</Label>
          {rows.map(([m, d], i) => {
            const k = seg(t, 0.08 + i * 0.08, 0.15 + i * 0.08);
            return (
              <div key={m} className="flex items-center gap-3 border-t border-bone/[.07] py-2.5 first-of-type:border-0" style={{ opacity: 0.25 + 0.75 * k }}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${k >= 1 ? "bg-sodium text-ink" : "border border-bone/25 text-bone/40"}`}>{k >= 1 ? "✓" : i + 1}</span>
                <span className="w-[150px] shrink-0 font-mono text-[11px] uppercase tracking-[.12em] text-bone sm:w-[190px]">{m}</span>
                <span className="text-[13px] text-bone-2">{d}</span>
              </div>
            );
          })}
        </Card>
        <div className="relative" style={{ opacity: ease(kR), transform: `translateY(${(1 - ease(kR)) * 18}px)` }}>
          <div className="overflow-hidden rounded-[6px] border border-bone/12 bg-ink/80 shadow-[0_40px_120px_rgba(0,0,0,.6)] backdrop-blur-xl">
            {img && (
              <div className="relative aspect-[16/9] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" style={{ transform: `scale(${1.04 + 0.06 * t})` }} />
                <span className="absolute left-3 top-3 bg-ink/75 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[.2em] text-sodium-hi">{tr(lang, "Proof · frame", "Доказательство · кадр")} {ev?.mediaId}</span>
              </div>
            )}
            <div className="p-4 sm:p-5">
              {f ? <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[.16em] text-sodium">{panelLabel(f.panel, lang)}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-[.16em] ${f.verified ? "text-ok" : "text-mist"}`}>{f.verified ? tr(lang, "verified", "подтверждено") : tr(lang, "unconfirmed", "не подтверждено")}</span>
                </div>
                <p className="mt-2 font-display text-[24px] font-medium leading-tight text-bone">{KIND[f.kind]?.[lang === "ru" ? 1 : 0] ?? f.kind}{microns ? ` · ${microns} µm` : ""}</p>
                {quote && <p className="mt-2 border-l border-sodium/60 pl-3 text-[13px] italic leading-snug text-bone-2">«{quote.slice(0, 110)}» <span className="not-italic text-mist">— {tr(lang, "inspector, voice note", "инспектор, голосовая заметка")}</span></p>}
              </> : <p className="text-[15px] text-bone">{tr(lang, "No defects found.", "Дефектов не найдено.")}</p>}
            </div>
          </div>
          <div className="absolute -bottom-5 -right-2 rotate-[-4deg] border-2 px-4 py-1.5 font-mono text-[18px] font-medium uppercase tracking-[.2em] sm:-right-6 sm:text-[22px]"
            style={{ color: decColor, borderColor: decColor, background: "rgba(6,7,8,.85)", opacity: kV, transform: `rotate(-4deg) scale(${1.4 - 0.4 * ease(kV)})`, boxShadow: `0 0 40px ${decColor}55` }}>
            {dec.replace("_", " ")}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fork({ t, lang }: { t: number; lang: Lang }) {
  const a = ease(seg(t, 0.1, 0.45)), b = ease(seg(t, 0.4, 0.75));
  return (
    <div className="flex h-full items-center justify-center px-3">
      <svg viewBox="0 0 800 360" className="w-full max-w-[860px] overflow-visible">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {/* branch back to selection */}
        <path d="M400 180 C 300 180 260 290 160 290 C 70 290 60 120 160 80" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="3" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - a} />
        {/* branch to purchase */}
        <path d="M400 180 C 500 180 540 80 650 80" fill="none" stroke="#eea65a" strokeWidth="4" filter="url(#glow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - b} />
        <circle cx="400" cy="180" r="12" fill="#eea65a" filter="url(#glow)" />
        <text x="400" y="225" textAnchor="middle" fill="#efe9df" fontSize="22" fontWeight="500" fontFamily="var(--nf-display), Georgia, serif" fontStyle="italic">{tr(lang, "Your decision", "Ваше решение")}</text>
        <g opacity={a}>
          <text x="160" y="58" textAnchor="middle" fill="#c8c2b8" fontSize="20">↺ {tr(lang, "Back to selection", "Снова к подбору")}</text>
          <text x="200" y="330" textAnchor="middle" fill="#c8c2b8" fontSize="20">{tr(lang, "Not happy → we keep searching", "Не устроило → ищем дальше")}</text>
        </g>
        <g opacity={b}>
          <circle cx="650" cy="80" r="9" fill="#eea65a" />
          <text x="650" y="125" textAnchor="middle" fill="#eea65a" fontSize="24" fontWeight="700">{tr(lang, "Happy → purchase", "Устроило → выкуп")}</text>
        </g>
      </svg>
    </div>
  );
}

/* ---------- route maps (equirectangular, lon 10..145, lat 30..62 → 1000×500) ---------- */
const P = (lon: number, lat: number) => [((lon - 10) / 135) * 1000, ((62 - lat) / 32) * 500] as const;
const C = {
  seoul: P(127, 37.5), busan: P(129, 35.1), vlad: P(131.9, 43.1),
  moscow: P(37.6, 55.75), minsk: P(27.6, 53.9), prague: P(14.4, 50.1), almaty: P(76.9, 43.2), tashkent: P(69.3, 41.3),
};
const NAMES: Record<keyof typeof C, [string, string]> = {
  seoul: ["Seoul", "Сеул"], busan: ["Busan", "Пусан"], vlad: ["Vladivostok", "Владивосток"], moscow: ["Moscow", "Москва"],
  minsk: ["Minsk", "Минск"], prague: ["Prague", "Прага"], almaty: ["Almaty", "Алматы"], tashkent: ["Tashkent", "Ташкент"],
};
const arc = (a: readonly number[], b: readonly number[], lift = 0.22) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return `M${a[0]} ${a[1]} Q${mx} ${my - d * lift} ${b[0]} ${b[1]}`;
};
const ROAD = [P(131.9, 43.1), P(135, 48.5), P(127.5, 50.3), P(113.5, 52), P(104.3, 52.3), P(92.9, 56), P(82.9, 55), P(73.4, 55), P(60.6, 56.8), P(49.1, 55.8), P(37.6, 55.75)];
const roadD = "M" + ROAD.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const vb = (a: number[], b: number[], k: number) => a.map((v, i) => lerp(v, b[i], k)).join(" ");

function City({ id, lang, on, size = 1, below = false }: { id: keyof typeof C; lang: Lang; on: number; size?: number; below?: boolean }) {
  const [x, y] = C[id];
  return (
    <g opacity={0.25 + 0.75 * on}>
      <circle cx={x} cy={y} r={4 * size} fill="#eea65a" />
      <circle cx={x} cy={y} r={10 * size * on} fill="none" stroke="#eea65a" strokeOpacity={0.5} strokeWidth={size} />
      <text x={x} y={below ? y + 22 * size : y - 12 * size} textAnchor="middle" fill="#efe9df" fontSize={12.5 * size} fontWeight={500} letterSpacing={2 * size}
        fontFamily="var(--nf-data), ui-monospace, monospace" style={{ paintOrder: "stroke", stroke: "#060708", strokeWidth: 4 * size, textTransform: "uppercase" }}>{NAMES[id][lang === "ru" ? 1 : 0]}</text>
    </g>
  );
}

function RouteMap({ mode, t, lang }: { mode: "kr" | "fan" | "road"; t: number; lang: Lang }) {
  const KR = [800, 330, 160, 110], SEA = [790, 230, 190, 220], WIDE = [-20, 20, 1040, 420];
  const tall = typeof window !== "undefined" && window.innerWidth < window.innerHeight ? 2.3 : 1; // portrait: bigger labels
  let view: string, s = 1;
  if (mode === "kr") { view = vb(KR, [810, 345, 140, 96], ease(t)); s = 0.16; }
  else if (mode === "fan") { const z = ease(seg(t, 0.32, 0.62)); view = vb(SEA, WIDE, z); s = lerp(0.24, tall, z); }
  else { view = WIDE.join(" "); s = tall; }
  const seoulBusan = ease(seg(t, 0.15, 0.85));
  const sea = ease(seg(t, 0.05, 0.35));
  const fan: (keyof typeof C)[] = ["moscow", "minsk", "prague", "almaty", "tashkent"];
  const road = seg(t, 0.08, 0.92);
  const carAt = ROAD[Math.min(ROAD.length - 1, Math.floor(road * (ROAD.length - 1)))];
  return (
    <div className="flex h-full items-center justify-center">
      <svg viewBox={view} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <defs><filter id="mglow"><feGaussianBlur stdDeviation={3 * s} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <defs>
          <pattern id="hbdots" width="3.4" height="3.4" patternUnits="userSpaceOnUse"><circle cx="1.7" cy="1.7" r=".62" fill="#c8c2b8" fillOpacity=".42" /></pattern>
          <radialGradient id="hbsea" cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#8cc7cf" stopOpacity=".06" /><stop offset="1" stopColor="#060708" stopOpacity="0" /></radialGradient>
        </defs>
        <rect x="-200" y="-200" width="1400" height="900" fill="url(#hbsea)" />
        {/* Natural Earth land: halftone fill + hairline coast */}
        <path d={MAP.coast} fill="url(#hbdots)" fillRule="evenodd" stroke="#efe9df" strokeOpacity={0.22} strokeWidth={0.5 * s} />
        {mode === "kr" && <>
          <path d={arc(C.seoul, C.busan, 0.15)} fill="none" stroke="#eea65a" strokeWidth={2.2 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - seoulBusan} />
          <City id="seoul" lang={lang} on={1} size={s} />
          <City id="busan" lang={lang} on={seoulBusan} size={s} below />
        </>}
        {mode === "fan" && <>
          <path d={arc(C.busan, C.vlad, -0.25)} fill="none" stroke="#eea65a" strokeWidth={2.4 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - sea} />
          {fan.map((id, i) => {
            const k = ease(seg(t, 0.5 + i * 0.08, 0.72 + i * 0.06));
            return <g key={id}>
              <path d={arc(C.vlad, C[id], 0.18)} fill="none" stroke="#eea65a" strokeOpacity={0.85} strokeWidth={2 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - k} />
              <City id={id} lang={lang} on={k} size={s} below={id === "tashkent"} />
            </g>;
          })}
          <City id="busan" lang={lang} on={1} size={s} below />
          <City id="vlad" lang={lang} on={sea} size={s} />
        </>}
        {mode === "road" && <>
          <path d={roadD} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={2 * s} strokeLinejoin="round" />
          <path d={roadD} fill="none" stroke="#eea65a" strokeWidth={3 * s} strokeLinejoin="round" filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - road} />
          <circle cx={carAt[0]} cy={carAt[1]} r={7 * s} fill="#fff" filter="url(#mglow)" />
          <City id="vlad" lang={lang} on={1} size={s} below />
          <City id="moscow" lang={lang} on={road > 0.98 ? 1 : 0.2} size={s} />
          {(["minsk", "prague", "almaty", "tashkent"] as const).map((id) => <City key={id} id={id} lang={lang} on={0.15} size={s} below={id === "tashkent"} />)}
        </>}
      </svg>
    </div>
  );
}
