// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Tool-first landing hero: one-line pitch, Meta models on view, demo cars with real agent reports (instant) + live agent run
// @created: 2026-11-01
// @updated: 2026-11-02 claude-code — film v4 type and palette (display serif, mono labels, sodium accent)
// @updated: 2026-11-03 claude-code — «How it was before»: real buyer chats (names/plates blurred) above «Who does what»
// @updated: 2026-11-03 claude-code — «How the agent worked — up to 16 steps»: the real step log of the hero car's report + a muted loop from the jury video
// @updated: 2026-11-02 claude-code — first screen: 3D bridge on the right (desktop) / under the buttons (mobile); text and buttons stay in the flow above it
import Link from "next/link";
import type { Report } from "@/lib/schema";
import { CARS, carMedia } from "@/lib/agent/catalog";
import BridgeHero from "@/components/bridge-hero/BridgeHero";
import { TOOL_MODEL } from "@/lib/agent/toolModels";

type Lang = "en" | "ru";

const T = {
  en: {
    kicker: "HANBRIDGE INSPECTOR · AGENT ON META MODELS",
    h1: "A used car in Korea, inspected by an AI agent. Every finding backed by evidence.",
    sub: "The agent reads the walk-around photos, paint-gauge video, the inspector's voice note and the diagnostic report, checks each finding in a second independent pass, and returns BUY / NEGOTIATE / WALK AWAY — with a link the buyer can click through to the frame or the voice quote.",
    who: "For car exporters and dealers: one verifiable link per car instead of 40 photos in a chat.",
    open: "Open report",
    garage: "3D garage",
    live: "Watch the agent live (~1.5 min)",
    findings: "findings",
    verified: "verified",
    before: "How it was before",
    beforeSub: "Real chats with our buyers (names and plates hidden). Every car meant dozens of messages, forwarded photo albums and a plain-text report nobody could check.",
    beforeCap: ["«When does it ship?» — every day", "Prices and rates, message by message", "Photo albums forwarded, car after car", "The inspection report as plain text"],
    models: "Who does what",
    steps: "How the agent worked — up to 16 steps",
    stepsSub: "A real run on the Kia Sportage. Muse Spark plans up to 16 tool steps; then every finding goes to an independent verifier. Log entries of this run:",
    fullLog: "Open this report",
    film: "Watch the film ↓",
    noReport: "No report yet — run the agent",
    own: "Check your own car →",
    price: "How it is paid: when we source the car for you, the first inspection is free. Each extra inspection is $100 — most buyers need only one, because we check the car's history before sending an inspector.",
  },
  ru: {
    kicker: "HANBRIDGE INSPECTOR · АГЕНТ НА МОДЕЛЯХ META",
    h1: "Авто с пробегом в Корее, осмотренное ИИ-агентом. У каждой находки есть доказательство.",
    sub: "Агент читает фото обхода, видео толщиномера, голосовую заметку инспектора и диагностику, перепроверяет каждую находку отдельным проходом и выдаёт BUY / NEGOTIATE / WALK AWAY — со ссылкой, где покупатель кликает до кадра или цитаты.",
    who: "Для экспортёров и дилеров: одна проверяемая ссылка на авто вместо 40 фото в чате.",
    open: "Открыть отчёт",
    garage: "3D-гараж",
    live: "Смотреть агента вживую (~1,5 мин)",
    findings: "находок",
    verified: "подтверждено",
    before: "Как было до",
    beforeSub: "Настоящие переписки с нашими покупателями (имена и номера скрыты). На каждую машину — десятки сообщений, пересланные альбомы фото и текстовый отчёт, который никак не проверить.",
    beforeCap: ["«Когда отправка?» — каждый день", "Цены и курс — сообщение за сообщением", "Альбомы фото пересылкой, машина за машиной", "Отчёт осмотра простым текстом"],
    models: "Кто что делает",
    steps: "Как работал агент — до 16 шагов",
    stepsSub: "Настоящий прогон по Kia Sportage. Muse Spark планирует до 16 шагов с инструментами, затем каждая находка идёт на независимую проверку. Записей в журнале этого прогона:",
    fullLog: "Открыть этот отчёт",
    film: "Смотреть фильм ↓",
    noReport: "Отчёта ещё нет — запустите агента",
    own: "Проверить своё авто →",
    price: "Как это оплачивается: если мы подбираем авто для вас, первый осмотр бесплатно. Каждый следующий — $100. Обычно хватает одного: до выезда инспектора мы проверяем историю авто.",
  },
} as const;

const MODELS: { name: string; role_en: string; role_ru: string }[] = [
  { name: "Muse Spark", role_en: "plans the inspection, calls tools, writes the verdict", role_ru: "ведёт осмотр, вызывает инструменты, пишет вердикт" },
  { name: "SAM 3.1", role_en: "segments the car, panels and plates", role_ru: "выделяет авто, панели и номера" },
  { name: "Muse Voice Transcribe", role_en: "turns the inspector's voice into findings", role_ru: "превращает голос инспектора в находки" },
  { name: "Muse Image", role_en: "clean listing photo, plate hidden", role_ru: "чистое фото для объявления без номера" },
  { name: "Muse Glimmer", role_en: "open-weight photo triage on our GPU", role_ru: "open-weight разбор фото на нашем GPU" },
  { name: "Muse Spark Open", role_en: "independent verifier (Baseten)", role_ru: "независимая проверка находок (Baseten)" },
];

const ruFindings = (n: number) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "находка" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "находки" : "находок"; };
const verdictColor = (d?: string) => (d === "BUY" ? "#86cfa2" : d === "WALK_AWAY" ? "#e2574c" : "#eea65a");

export default function Hero({ reports, lang }: { reports: Report[]; lang: Lang }) {
  const t = T[lang];
  const newest = new Map<string, Report>();
  for (const r of reports) if (r.carId && !newest.has(r.carId)) newest.set(r.carId, r);
  // only cars whose inspection media exist (local demo-data or Blob): a card must be runnable live
  const cars = CARS.filter((c) => carMedia(c.carId).photos.length > 0).map((c) => ({ car: c, report: newest.get(c.carId) }))
    // Kia Sportage (Arthur's own inspection) is the hero car: always first
    .sort((a, b) => Number(b.car.carId === "kia-sportage") - Number(a.car.carId === "kia-sportage") || Number(!!b.report) - Number(!!a.report));
  const q = lang === "ru" ? "?lang=ru" : "";
  // the bridge's "Evidence" label: the hero car's report, else any report, else the car's garage
  const evidence = reports.find((r) => r.carId === "kia-sportage") ?? reports[0];
  const reportHref = evidence ? `/r/${evidence.id}` : "/garage/kia-sportage";

  return (
    <section className="relative overflow-hidden bg-ink text-bone">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 60% at 85% 0%, rgba(238,166,90,.10), transparent 60%), radial-gradient(60% 50% at 0% 100%, rgba(140,199,207,.07), transparent 60%)" }} />
      <div className="relative mx-auto max-w-[1220px] px-5 pb-14 pt-8 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bone/10 pb-5">
          <div className="flex items-center gap-4">
            <span className="font-display text-[17px] font-semibold uppercase tracking-[.42em]">Hanbridge</span>
            <span className="hidden font-mono text-[10.5px] uppercase tracking-[.2em] text-mist sm:inline">{t.kicker}</span>
          </div>
          <nav className="flex gap-4 font-mono text-[11px] uppercase tracking-[.2em]">
            <Link href="/" className={lang === "en" ? "text-bone" : "text-mist hover:text-bone"}>EN</Link>
            <Link href="/?lang=ru" className={lang === "ru" ? "text-bone" : "text-mist hover:text-bone"}>RU</Link>
          </nav>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2 md:items-center md:gap-10">
          <div className="md:col-start-1 md:row-start-1">
            <h1 className="max-w-[980px] font-display text-[clamp(34px,4.9vw,68px)] font-medium leading-[.98] tracking-[-.01em]">{t.h1}</h1>
            <p className="mt-6 max-w-[780px] text-[17px] leading-relaxed text-bone-2">{t.sub}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={`/inspect/new${q}`} className="rounded-full bg-sodium px-6 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[.2em] text-ink shadow-[0_0_40px_rgba(238,166,90,.3)] transition-transform hover:-translate-y-px">{t.own}</Link>
              <a href="#journey" className="font-mono text-[11px] uppercase tracking-[.2em] text-bone-2 hover:text-bone">{t.film}</a>
            </div>
          </div>
          <div className="md:col-start-2 md:row-span-2 md:row-start-1 md:self-stretch">
            <BridgeHero lang={lang} reportHref={reportHref} />
          </div>
          <p className="max-w-[780px] border-l border-sodium/50 pl-4 text-[14px] leading-relaxed text-bone-2 md:col-start-1 md:row-start-2"><span className="text-sodium-hi">{t.who}</span> {t.price}</p>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {cars.map(({ car, report }) => (
            <article key={car.carId} className="group flex flex-col overflow-hidden rounded-[6px] border border-bone/10 bg-ink-2 transition-colors hover:border-sodium/50">
              <div className="relative aspect-[16/10] overflow-hidden bg-ink-3">
                {/* clean card: the original inspection photo with the plate covered (public/cards, scripts/film4/make-cards.mts) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/cards/${car.carId}.jpg`} alt={`${car.make} ${car.model}`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                {report && <span className="absolute left-3 top-3 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.18em]" style={{ color: verdictColor(report.verdict.decision), borderColor: verdictColor(report.verdict.decision), background: "rgba(6,7,8,.72)" }}>{report.verdict.decision.replace("_", " ")}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <b className="font-display text-[22px] font-medium leading-tight">{car.year} {car.make} {car.model}</b>
                {report ? (
                  <span className="font-mono text-[11px] uppercase tracking-[.12em] text-mist">
                    {report.findings.length} {lang === "ru" ? ruFindings(report.findings.length) : report.findings.length === 1 ? "finding" : t.findings} · {report.findings.filter((f) => f.verified).length} {t.verified}
                  </span>
                ) : <span className="text-[13px] text-mist">{t.noReport}</span>}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {report && <a href={`/r/${report.id}${q}`} className="rounded-full bg-bone px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] text-ink hover:bg-sodium-hi">{t.open}</a>}
                  <a href={`/garage/${car.carId}${q}`} className="rounded-full border border-sodium/60 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] text-sodium-hi hover:border-sodium">{t.garage}</a>
                  <a href={`/inspect/${car.carId}${q}`} className="rounded-full border border-bone/25 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[.16em] text-bone hover:border-sodium">{t.live}</a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <h2 className="mb-2 mt-12 font-mono text-[11px] uppercase tracking-[.3em] text-sodium">{t.before}</h2>
        <p className="mb-4 max-w-3xl text-[14px] text-bone-2">{t.beforeSub}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["ship", 2, 5, 8].map((n, k) => (
            <figure key={n} className="overflow-hidden rounded-[6px] border border-bone/10 bg-ink-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/landing/before-${n}.jpg`} alt={t.beforeCap[k]} loading="lazy" className="aspect-[368/620] w-full object-cover object-top opacity-90" />
              <figcaption className="px-3 py-2 font-mono text-[10.5px] uppercase leading-snug tracking-[.1em] text-bone-2">{t.beforeCap[k]}</figcaption>
            </figure>
          ))}
        </div>

        <h2 className="mb-4 mt-12 font-mono text-[11px] uppercase tracking-[.3em] text-sodium">{t.models}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-px overflow-hidden rounded-[6px] border border-bone/10 bg-bone/10">
          {MODELS.map((m) => (
            <div key={m.name} className="bg-ink-2 px-4 py-3.5">
              <div className="font-mono text-[11px] uppercase tracking-[.14em] text-bone">{m.name}</div>
              <div className="mt-1 text-[13.5px] text-bone-2">{lang === "ru" ? m.role_ru : m.role_en}</div>
            </div>
          ))}
        </div>

        {evidence && evidence.trace.length > 0 && (
          <>
            <h2 className="mb-2 mt-12 font-mono text-[11px] uppercase tracking-[.3em] text-sodium">{t.steps}</h2>
            <p className="mb-4 max-w-3xl text-[14px] text-bone-2">{t.stepsSub} {evidence.trace.length} · {evidence.verdict.decision.replace("_", " ")}</p>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <video src="/landing/agent-steps.mp4" poster="/landing/agent-steps.jpg" muted autoPlay loop playsInline preload="metadata" aria-label={t.steps}
                className="w-full self-start rounded-[6px] border border-bone/10 bg-ink-2" />
              <ol className="max-h-[440px] overflow-y-auto rounded-[6px] border border-bone/10 bg-ink-2 px-4 py-3">
                {evidence.trace.map((s, i) => (
                  <li key={i} className="flex gap-3 border-b border-bone/[.06] py-2 last:border-0">
                    <span className="w-6 shrink-0 pt-px font-mono text-[10.5px] text-mist">{String(s.i ?? i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`font-mono text-[12px] ${s.ok === false ? "text-bad" : "text-bone"}`}>{s.tool}</span>
                        {(s.model || TOOL_MODEL[s.tool]) && <span className="rounded-[2px] border border-signal/40 px-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-signal">{s.model ?? TOOL_MODEL[s.tool]}</span>}
                        <span className="font-mono text-[10px] text-mist">{((s.ms ?? 0) / 1000).toFixed(1)} s</span>
                      </div>
                      {s.outputSummary && <p className="mt-0.5 break-words font-mono text-[10.5px] leading-snug text-mist">{s.outputSummary.slice(0, 140)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <a href={`${reportHref}${q}`} className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[.2em] text-bone-2 hover:text-sodium">{t.fullLog} →</a>
          </>
        )}
      </div>
    </section>
  );
}
