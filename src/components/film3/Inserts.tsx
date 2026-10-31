// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v3 code inserts driven by scene progress t (0..1): route maps (Korea, sea + fan of cities, the road) and portal UI (request, selection, report, fork)
// @created: 2026-11-01
"use client";
import type { Insert, Lang } from "./scenes3";

const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const tr = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);

export default function InsertView({ kind, t, lang }: { kind: Insert; t: number; lang: Lang }) {
  switch (kind) {
    case "request": return <Request t={t} lang={lang} />;
    case "pick": return <Pick t={t} lang={lang} />;
    case "report": return <ReportCard t={t} lang={lang} />;
    case "fork": return <Fork t={t} lang={lang} />;
    case "mapKr": return <RouteMap mode="kr" t={t} lang={lang} />;
    case "mapFan": return <RouteMap mode="fan" t={t} lang={lang} />;
    case "mapRoad": return <RouteMap mode="road" t={t} lang={lang} />;
  }
}

/* ---------- portal UI ---------- */
const Card = ({ children, k, className = "" }: { children: React.ReactNode; k: number; className?: string }) => (
  <div className={`rounded-3xl border border-white/12 bg-[#0d1016]/80 p-5 shadow-[0_30px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-7 ${className}`}
    style={{ opacity: ease(k), transform: `translateY(${(1 - ease(k)) * 24}px) scale(${0.97 + 0.03 * ease(k)})` }}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-4 text-[11px] uppercase tracking-[.28em] text-amber-300">{children}</div>;

function Typed({ text, k }: { text: string; k: number }) {
  const n = Math.round(text.length * cl(k));
  return <>{text.slice(0, n)}<span className="text-amber-300" style={{ opacity: k > 0 && k < 1 ? 1 : 0 }}>▍</span></>;
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
            <span className="text-sm text-[#8b93a3]">{k}</span>
            <span className="text-right text-base font-medium sm:text-lg"><Typed text={v} k={seg(t, 0.12 + i * 0.14, 0.24 + i * 0.14)} /></span>
          </div>
        ))}
        <div className={`mt-4 rounded-full py-3 text-center text-sm font-semibold transition-colors duration-500 ${t > 0.78 ? "bg-amber-300 text-zinc-950" : "bg-white/10 text-white/40"}`}>
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
      <div className="text-[11px] uppercase tracking-[.28em] text-amber-300" style={{ opacity: seg(t, 0, 0.1) }}>{tr(lang, "Selection from your manager", "Подборка от менеджера")}</div>
      <div className="grid w-full max-w-[920px] grid-cols-3 gap-2 sm:gap-4">
        {cars.map((c, i) => {
          const on = chosen && i === 1;
          return (
            <Card key={i} k={seg(t, 0.05 + i * 0.08, 0.2 + i * 0.08)} className={`!p-2 sm:!p-3 transition-[box-shadow,border-color] duration-500 ${on ? "!border-amber-300 shadow-[0_0_0_2px_rgba(252,211,77,.7),0_30px_80px_rgba(0,0,0,.6)]" : chosen ? "opacity-60" : ""}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: c.pos }} />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">Encar</span>
                {on && <span className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">{tr(lang, "Chosen", "Выбрано")}</span>}
              </div>
              <div className="px-1 pt-2 sm:px-2">
                <div className="text-xs font-medium sm:text-sm">Kia Sportage · {c.y}</div>
                <div className="text-[10px] text-[#8b93a3] sm:text-xs">{c.km} {tr(lang, "km", "км")}</div>
                <div className="mt-1 text-sm font-semibold text-amber-200 sm:text-base">{c.p}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#8b93a3] sm:text-[10px]">{tr(lang, "platform price", "цена площадки")}</div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="max-w-[520px] rounded-2xl rounded-bl-sm bg-[#1b2230]/90 px-4 py-3 text-sm backdrop-blur" style={{ opacity: seg(t, 0.55, 0.68), transform: `translateY(${(1 - seg(t, 0.55, 0.68)) * 10}px)` }}>
        <b className="text-amber-300">{tr(lang, "Manager", "Менеджер")}:</b> {tr(lang, "this one has a clean history. Shall we inspect it?", "у этой чистая история. Едем смотреть?")}
      </div>
    </div>
  );
}

function ReportCard({ t, lang }: { t: number; lang: Lang }) {
  const rows = [
    tr(lang, "Body & interior photos", "Фото кузова и салона"),
    tr(lang, "Paint gauge · every panel", "Толщиномер · каждая панель"),
    tr(lang, "Inspector's voice notes", "Голосовые заметки осмотрщика"),
    tr(lang, "Summary · Meta Muse Spark", "Сводка · Meta Muse Spark"),
  ];
  return (
    <div className="flex h-full items-center justify-center px-5">
      <Card k={seg(t, 0, 0.12)} className="w-full max-w-[480px]">
        <Label>{tr(lang, "Inspection report", "Отчёт осмотра")} · Kia Sportage</Label>
        {rows.map((r, i) => {
          const k = seg(t, 0.12 + i * 0.13, 0.22 + i * 0.13);
          return (
            <div key={r} className="flex items-center gap-3 border-t border-white/[.07] py-3 first-of-type:border-0">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${k >= 1 ? "bg-amber-300 text-zinc-950" : "border border-white/20 text-white/40"}`}>{k >= 1 ? "✓" : i + 1}</span>
              <span className={k > 0 ? "text-[#eef0f4]" : "text-white/40"}>{r}</span>
              <span className="ml-auto h-1 w-16 overflow-hidden rounded bg-white/10"><span className="block h-full bg-amber-300" style={{ width: `${k * 100}%` }} /></span>
            </div>
          );
        })}
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" style={{ opacity: seg(t, 0.7, 0.82) }}>
          {tr(lang, "Report ready — sent to you for a decision.", "Отчёт готов — отправлен вам на решение.")}
        </div>
      </Card>
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
        <path d="M400 180 C 500 180 540 80 650 80" fill="none" stroke="#fcd34d" strokeWidth="4" filter="url(#glow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - b} />
        <circle cx="400" cy="180" r="12" fill="#fcd34d" filter="url(#glow)" />
        <text x="400" y="225" textAnchor="middle" fill="#eef0f4" fontSize="22" fontWeight="600">{tr(lang, "Your decision", "Ваше решение")}</text>
        <g opacity={a}>
          <text x="160" y="58" textAnchor="middle" fill="#c9ced8" fontSize="20">↺ {tr(lang, "Back to selection", "Снова к подбору")}</text>
          <text x="200" y="330" textAnchor="middle" fill="#c9ced8" fontSize="20">{tr(lang, "Not happy → we keep searching", "Не устроило → ищем дальше")}</text>
        </g>
        <g opacity={b}>
          <circle cx="650" cy="80" r="9" fill="#fcd34d" />
          <text x="650" y="125" textAnchor="middle" fill="#fcd34d" fontSize="24" fontWeight="700">{tr(lang, "Happy → purchase", "Устроило → выкуп")}</text>
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

const DOTS = (() => {
  const out: [number, number][] = [];
  for (let lon = 12; lon <= 144; lon += 3) for (let lat = 31; lat <= 61; lat += 2.4) out.push([...P(lon, lat)] as [number, number]);
  return out;
})();

function City({ id, lang, on, size = 1, below = false }: { id: keyof typeof C; lang: Lang; on: number; size?: number; below?: boolean }) {
  const [x, y] = C[id];
  return (
    <g opacity={0.25 + 0.75 * on}>
      <circle cx={x} cy={y} r={4 * size} fill="#fcd34d" />
      <circle cx={x} cy={y} r={10 * size * on} fill="none" stroke="#fcd34d" strokeOpacity={0.5} strokeWidth={size} />
      <text x={x} y={below ? y + 22 * size : y - 12 * size} textAnchor="middle" fill="#eef0f4" fontSize={15 * size} fontWeight={600}
        style={{ paintOrder: "stroke", stroke: "#07090d", strokeWidth: 4 * size }}>{NAMES[id][lang === "ru" ? 1 : 0]}</text>
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
        {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.1 * s} fill="#9aa4b6" opacity={0.28} />)}
        {mode === "kr" && <>
          <path d={arc(C.seoul, C.busan, 0.15)} fill="none" stroke="#fcd34d" strokeWidth={2.2 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - seoulBusan} />
          <City id="seoul" lang={lang} on={1} size={s} />
          <City id="busan" lang={lang} on={seoulBusan} size={s} below />
        </>}
        {mode === "fan" && <>
          <path d={arc(C.busan, C.vlad, -0.25)} fill="none" stroke="#fcd34d" strokeWidth={2.4 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - sea} />
          {fan.map((id, i) => {
            const k = ease(seg(t, 0.5 + i * 0.08, 0.72 + i * 0.06));
            return <g key={id}>
              <path d={arc(C.vlad, C[id], 0.18)} fill="none" stroke="#fcd34d" strokeOpacity={0.85} strokeWidth={2 * s} filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - k} />
              <City id={id} lang={lang} on={k} size={s} below={id === "tashkent"} />
            </g>;
          })}
          <City id="busan" lang={lang} on={1} size={s} below />
          <City id="vlad" lang={lang} on={sea} size={s} />
        </>}
        {mode === "road" && <>
          <path d={roadD} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={2 * s} strokeLinejoin="round" />
          <path d={roadD} fill="none" stroke="#fcd34d" strokeWidth={3 * s} strokeLinejoin="round" filter="url(#mglow)" strokeDasharray="1" pathLength={1} strokeDashoffset={1 - road} />
          <circle cx={carAt[0]} cy={carAt[1]} r={7 * s} fill="#fff" filter="url(#mglow)" />
          <City id="vlad" lang={lang} on={1} size={s} below />
          <City id="moscow" lang={lang} on={road > 0.98 ? 1 : 0.2} size={s} />
          {(["minsk", "prague", "almaty", "tashkent"] as const).map((id) => <City key={id} id={id} lang={lang} on={0.15} size={s} below={id === "tashkent"} />)}
        </>}
      </svg>
    </div>
  );
}
