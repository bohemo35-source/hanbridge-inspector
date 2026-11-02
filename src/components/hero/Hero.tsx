// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Tool-first landing hero: one-line pitch, Meta models on view, demo cars with real agent reports (instant) + live agent run
// @created: 2026-11-01
import Link from "next/link";
import type { Report } from "@/lib/schema";
import { CARS, carMedia } from "@/lib/agent/catalog";

type Lang = "en" | "ru";

const T = {
  en: {
    kicker: "HANBRIDGE INSPECTOR · AGENT ON META MODELS",
    h1: "A used car in Korea, inspected by an AI agent. Every finding backed by evidence.",
    sub: "The agent reads the walk-around photos, paint-gauge video, the inspector's voice note and the diagnostic report, checks each finding in a second independent pass, and returns BUY / NEGOTIATE / WALK AWAY — with a link the buyer can click through to the frame or the voice quote.",
    who: "For car exporters and dealers: one verifiable link per car instead of 40 photos in a chat.",
    open: "Open report",
    live: "Watch the agent live (~1.5 min)",
    findings: "findings",
    verified: "verified",
    models: "Who does what",
    film: "How the car gets home ↓",
    noReport: "No report yet — run the agent",
    own: "Check your own car →",
    price: "How it is paid: when we source the car for you, the first inspection is free. Each extra inspection is $100 — most buyers need only one, because we check the car's history before sending an inspector.",
  },
  ru: {
    kicker: "HANBRIDGE INSPECTOR · АГЕНТ НА МОДЕЛЯХ META",
    h1: "Б/у машина в Корее, осмотренная ИИ-агентом. У каждой находки есть доказательство.",
    sub: "Агент читает фото обхода, видео толщиномера, голосовую заметку инспектора и диагностику, перепроверяет каждую находку отдельным проходом и выдаёт BUY / NEGOTIATE / WALK AWAY — со ссылкой, где покупатель кликает до кадра или цитаты.",
    who: "Для экспортёров и дилеров: одна проверяемая ссылка на машину вместо 40 фото в чате.",
    open: "Открыть отчёт",
    live: "Смотреть агента вживую (~1,5 мин)",
    findings: "находок",
    verified: "подтверждено",
    models: "Кто что делает",
    film: "Как машина едет домой ↓",
    noReport: "Отчёта ещё нет — запустите агента",
    own: "Проверить свою машину →",
    price: "Как это оплачивается: если мы подбираем машину для вас, первый осмотр бесплатно. Каждый следующий — $100. Обычно хватает одного: до выезда инспектора мы проверяем историю машины.",
  },
} as const;

const MODELS: { name: string; role_en: string; role_ru: string }[] = [
  { name: "Muse Spark", role_en: "plans the inspection, calls tools, writes the verdict", role_ru: "ведёт осмотр, вызывает инструменты, пишет вердикт" },
  { name: "SAM 3.1", role_en: "segments the car, panels and plates", role_ru: "выделяет машину, панели и номера" },
  { name: "Muse Voice Transcribe", role_en: "turns the inspector's voice into findings", role_ru: "превращает голос инспектора в находки" },
  { name: "Muse Image", role_en: "clean listing photo, plate hidden", role_ru: "чистое фото для объявления без номера" },
  { name: "Muse Glimmer", role_en: "open-weight photo triage on our GPU", role_ru: "open-weight разбор фото на нашем GPU" },
  { name: "Muse Spark Open", role_en: "independent verifier (Baseten)", role_ru: "независимая проверка находок (Baseten)" },
];

const ruFindings = (n: number) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "находка" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "находки" : "находок"; };
const verdictColor = (d?: string) => (d === "BUY" ? "#4fb38a" : d === "WALK_AWAY" ? "#e5544b" : "#e3a33b");

export default function Hero({ reports, lang }: { reports: Report[]; lang: Lang }) {
  const t = T[lang];
  const newest = new Map<string, Report>();
  for (const r of reports) if (r.carId && !newest.has(r.carId)) newest.set(r.carId, r);
  // only cars whose inspection media exist (local demo-data or Blob): a card must be runnable live
  const cars = CARS.filter((c) => carMedia(c.carId).photos.length > 0).map((c) => ({ car: c, report: newest.get(c.carId) })).sort((a, b) => Number(!!b.report) - Number(!!a.report));
  const q = lang === "ru" ? "?lang=ru" : "";

  return (
    <section style={{ background: "#07090e", color: "#e8ebee", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 20px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p style={{ font: "600 11px ui-monospace, monospace", letterSpacing: ".14em", color: "#8b94a1", margin: 0 }}>{t.kicker}</p>
          <nav style={{ display: "flex", gap: 10, fontSize: 13 }}>
            <Link href="/" style={{ color: lang === "en" ? "#e8ebee" : "#8b94a1" }}>EN</Link>
            <Link href="/?lang=ru" style={{ color: lang === "ru" ? "#e8ebee" : "#8b94a1" }}>RU</Link>
          </nav>
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4.4vw, 52px)", lineHeight: 1.08, margin: "18px 0 14px", maxWidth: 900, fontWeight: 750 }}>{t.h1}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: "#c9cfd6", maxWidth: 820, margin: 0 }}>{t.sub}</p>
        <p style={{ fontSize: 14, color: "#c9a46a", margin: "14px 0 0" }}>{t.who}</p>
        <p style={{ fontSize: 13, color: "#8b94a1", margin: "6px 0 0", maxWidth: 820 }}>{t.price}</p>
        <p style={{ margin: "14px 0 0" }}><Link href={`/inspect/new${q}`} style={{ display: "inline-block", padding: "9px 16px", borderRadius: 8, border: "1px solid #c9a46a", color: "#c9a46a", fontWeight: 700, fontSize: 14 }}>{t.own}</Link></p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginTop: 30 }}>
          {cars.map(({ car, report }) => (
            <article key={car.carId} style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: "16 / 10", background: "#0d1015" }}>
                {report?.listingUrl
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={report.listingUrl} alt={`${car.make} ${car.model}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : null}
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <b style={{ fontSize: 15 }}>{car.year} {car.make} {car.model}</b>
                {report ? (
                  <span style={{ fontSize: 13, color: "#8b94a1" }}>
                    <span style={{ fontWeight: 800, color: verdictColor(report.verdict.decision) }}>{report.verdict.decision.replace("_", " ")}</span>
                    {" · "}{report.findings.length} {lang === "ru" ? ruFindings(report.findings.length) : t.findings}, {report.findings.filter((f) => f.verified).length} {t.verified}
                  </span>
                ) : <span style={{ fontSize: 13, color: "#8b94a1" }}>{t.noReport}</span>}
                <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                  {report && <a href={`/r/${report.id}${q}`} style={{ background: "#c9a46a", color: "#111", fontWeight: 700, fontSize: 13, padding: "8px 12px", borderRadius: 8, textDecoration: "none" }}>{t.open}</a>}
                  <a href={`/inspect/${car.carId}${q}`} style={{ border: "1px solid #3a4250", color: "#e8ebee", fontSize: 13, padding: "8px 12px", borderRadius: 8, textDecoration: "none" }}>{t.live}</a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <h2 style={{ fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", color: "#8b94a1", margin: "34px 0 12px" }}>{t.models}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODELS.map((m) => (
            <span key={m.name} style={{ background: "#11141a", border: "1px solid #242a33", borderRadius: 999, padding: "7px 12px", fontSize: 13 }}>
              <b>{m.name}</b> <span style={{ color: "#8b94a1" }}>— {lang === "ru" ? m.role_ru : m.role_en}</span>
            </span>
          ))}
        </div>

        <p style={{ marginTop: 34, fontSize: 14 }}><a href="#journey" style={{ color: "#8b94a1" }}>{t.film}</a></p>
      </div>
    </section>
  );
}
