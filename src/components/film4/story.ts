// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v4 script ("trailer", 4 acts): scenes, transitions, trailer lines EN/RU, act cards, ledger lines; business facts kept exactly as in film v3
// @created: 2026-11-02
export type Lang = "en" | "ru";
export type T = { en: string; ru: string };

export type Insert = "request" | "pick" | "report" | "fork" | "mapKr" | "mapFan" | "mapRoad";
export type Line = { item: T; payee: T; by: "invoice" | "you" | "zero" };
/** how a scene enters: blur dissolve, golden light wipe (the bridge line), zoom through the previous shot, dip to black */
export type Trans = "dissolve" | "wipe" | "zoom" | "dip";

export type Scene = {
  id: string;
  clip?: string;        // /film3/<clip>.mp4 (+ .jpg poster)
  insert?: Insert;      // full-screen code insert over a blurred poster
  bg?: string;          // poster behind an insert
  card?: { n: string; title: T; sub?: T }; // act title card on black
  open?: boolean;       // opening title over the first shot
  end?: boolean;        // end card
  vh: number;           // scroll length
  sec: number;          // duration in "watch" mode
  act: number;          // ACTS index
  in?: Trans;           // transition into this scene (default dissolve)
  lines?: T[];          // trailer lines, one after another
  big?: boolean;        // lines centred and large (title-like)
  chips?: T[];
  toast?: Line;
  receipt?: "busan" | "customs";
  insured?: boolean;
  posM?: string;        // object-position on portrait screens
};

export const ACTS: { n: string; title: T }[] = [
  { n: "I", title: { en: "The doubt", ru: "Сомнение" } },
  { n: "II", title: { en: "The proof", ru: "Доказательство" } },
  { n: "III", title: { en: "The crossing", ru: "Переправа" } },
  { n: "IV", title: { en: "Home", ru: "Дом" } },
];

const L = {
  car: { item: { en: "Car, listed price", ru: "Авто, цена площадки" }, payee: { en: "seller", ru: "продавцу" }, by: "invoice" },
  fee: { item: { en: "Platform fee", ru: "Комиссия площадки" }, payee: { en: "standard", ru: "стандарт" }, by: "invoice" },
  kr: { item: { en: "Deregistration, carrier, docs", ru: "Снятие с учёта, автовоз, документы" }, payee: { en: "Korea costs", ru: "расходы в Корее" }, by: "invoice" },
  sea: { item: { en: "Sea freight", ru: "Морской фрахт" }, payee: { en: "carrier tariff", ru: "тариф перевозчика" }, by: "invoice" },
  cus: { item: { en: "Duty · recycling · processing", ru: "Пошлина · утильсбор · оформление" }, payee: { en: "customs", ru: "таможне" }, by: "you" },
  road: { item: { en: "Delivery to your city", ru: "Доставка до города" }, payee: { en: "your carrier", ru: "вашему перевозчику" }, by: "you" },
  zero: { item: { en: "Hanbridge commission", ru: "Комиссия Hanbridge" }, payee: { en: "none", ru: "нет" }, by: "zero" },
} satisfies Record<string, Line>;
export const RECEIPT_BUSAN: Line[] = [L.car, L.fee, L.kr, L.sea];
export const RECEIPT_CUSTOMS: Line[] = [L.car, L.fee, L.kr, L.sea, L.cus];

export const SCENES: Scene[] = [
  // ── I · the doubt ──
  { id: "open", clip: "bridge-a", vh: 130, sec: 6, act: 0, open: true, posM: "38% 50%" },
  { id: "b", clip: "bridge-b", vh: 100, sec: 5, act: 0, lines: [
    { en: "Somewhere in Korea, there is a car meant for you.", ru: "Где-то в Корее есть авто, которое станет вашим." }] },
  { id: "c", clip: "bridge-c", vh: 95, sec: 5, act: 0, in: "zoom", big: true, lines: [
    { en: "Eight thousand kilometres away.", ru: "За восемь тысяч километров." }] },
  { id: "d", clip: "s0-5", vh: 110, sec: 6, act: 0, in: "wipe", lines: [
    { en: "A photo can't open the hood.", ru: "Фото не откроет капот." },
    { en: "A seller's word can't measure the paint.", ru: "Слово продавца не измерит краску." }] },
  { id: "e", clip: "s0-6", vh: 100, sec: 5, act: 0, posM: "42% 50%", lines: [
    { en: "So we built a bridge you can check.", ru: "Поэтому мы построили мост, который можно проверить." }] },

  // ── II · the proof ──
  { id: "act2", card: { n: "II", title: ACTS[1].title, sub: { en: "Proof before payment.", ru: "Доказательство — до оплаты." } /* line by Muse Wonder */ }, vh: 75, sec: 3.5, act: 1, in: "dip" },
  { id: "req", insert: "request", bg: "s0-6", vh: 115, sec: 6, act: 1, in: "dip", lines: [
    { en: "You name the car — budget, wishes, timing.", ru: "Вы называете авто — бюджет, пожелания, сроки." }] },
  { id: "pick", insert: "pick", bg: "s2-1", vh: 125, sec: 6, act: 1, lines: [
    { en: "A manager finds it, option by option —", ru: "Менеджер подбирает варианты под каждый пункт —" },
    { en: "at the real price every buyer in Korea sees.", ru: "по реальной цене, которую видит любой покупатель в Корее." }] },
  { id: "lift", clip: "s2-1", vh: 100, sec: 5, act: 1, in: "wipe", lines: [
    { en: "Then our expert looks underneath.", ru: "Потом наш эксперт заглядывает под днище." }] },
  { id: "gauge", clip: "gauge-v4", /* Muse Image still: gauge on the door, no headlight in frame */ vh: 105, sec: 5, act: 1, posM: "62% 50%", chips: [{ en: "Paint · 100 µm", ru: "ЛКП · 100 мкм" }], lines: [
    { en: "Every panel. Measured. Filmed. On the record.", ru: "Каждая деталь. Замерена. Снята. Задокументирована." }] },
  { id: "report", insert: "report", bg: "gauge-v4", vh: 130, sec: 7, act: 1, lines: [
    { en: "An AI agent on Meta models reads it all —", ru: "ИИ-агент на моделях Meta разбирает всё —" },
    { en: "and every finding points to its proof.", ru: "и у каждой находки есть доказательство." }] },
  { id: "fork", insert: "fork", bg: "s2-1", vh: 110, sec: 5, act: 1, lines: [
    { en: "Something's off? We keep searching. You decide.", ru: "Что-то не так? Ищем дальше. Решаете вы." }] },
  { id: "keys", clip: "s3-1", vh: 115, sec: 6, act: 1, in: "wipe", insured: true, toast: L.car, posM: "60% 50%", lines: [
    { en: "It passes. We buy it at the listed price.", ru: "Проверку прошло. Выкупаем по цене площадки." },
    { en: "From this minute, she is insured.", ru: "С этой минуты авто застраховано." }] },

  // ── III · the crossing ──
  { id: "act3", card: { n: "III", title: ACTS[2].title, sub: { en: "Korea · the sea · the border", ru: "Корея · море · граница" } }, vh: 75, sec: 3.5, act: 2, in: "dip", insured: true },
  // k4-1 (carrier at the port) was cut: the car on top reads silver, not our white Kia
  { id: "hwy", clip: "s4-2", vh: 125, sec: 6, act: 2, in: "dip", insured: true, toast: L.kr, posM: "35% 50%", lines: [
    { en: "Deregistered. Export papers ready.", ru: "Снято с учёта. Экспортные документы готовы." },
    { en: "Course: Busan.", ru: "Курс — Пусан." }] },
  { id: "mapkr", insert: "mapKr", bg: "s4-2", vh: 80, sec: 4, act: 2, insured: true },
  { id: "busan", clip: "s5-1", vh: 160, sec: 9, act: 2, insured: true, receipt: "busan", posM: "60% 50%", lines: [
    { en: "In Korea, you pay one invoice.", ru: "В Корее вы оплачиваете один инвойс." },
    { en: "The car, the platform fee, freight at the carrier's public tariff.", ru: "Авто, комиссия площадки и фрахт по открытому тарифу перевозчика." },
    { en: "No extra or hidden payments.", ru: "Без дополнительных и скрытых платежей." }] },
  { id: "sea", clip: "sea-v4", /* Muse Image still (closed stern ramp), push-in; the Wan clip s6-1 sailed with the ramp open */ vh: 120, sec: 6, act: 2, in: "zoom", insured: true, lines: [
    { en: "A few days at sea.", ru: "Несколько дней в море." },
    { en: "You see where she is — in your portal and in Telegram.", ru: "Где авто сейчас — видно в кабинете и в Telegram." }] },
  { id: "fan", insert: "mapFan", bg: "sea-v4", vh: 130, sec: 7, act: 2, insured: true, lines: [
    { en: "From Vladivostok, the roads split —", ru: "Из Владивостока дороги расходятся —" },
    { en: "Moscow, Minsk, Prague, Almaty, Tashkent.", ru: "в Москву, Минск, Прагу, Алматы, Ташкент." }] },
  { id: "bay", clip: "vlad-v4", /* Muse Image still: arrival under the bridge, stern ramp closed */ vh: 95, sec: 5, act: 2, in: "wipe", insured: true, big: true, lines: [
    { en: "Landfall. Vladivostok.", ru: "Берег. Владивосток." }] },
  { id: "ramp", clip: "s7-2", vh: 120, sec: 6, act: 2, insured: true, posM: "70% 50%", chips: [{ en: "Matched to inspection", ru: "Сверено с осмотром" }, { en: "Bonded yard · 7–10 days", ru: "СВХ · 7–10 дней" }], lines: [
    { en: "Checked against the inspection — exactly as she left.", ru: "Сверяем с отчётом осмотра — ровно такое, каким уехало." },
    { en: "Then the bonded yard. Usually seven to ten days.", ru: "Дальше — склад временного хранения. Обычно семь–десять дней." }] },
  { id: "orbit", clip: "s8-1", vh: 105, sec: 5, act: 2, insured: true, lines: [
    { en: "Customs, by the letter of the law.", ru: "Таможня — строго по закону." },
    { en: "Every payment and receipt in your name.", ru: "Все платежи и квитанции — на ваше имя." }] },
  { id: "gate", clip: "s8-2", vh: 150, sec: 8, act: 2, in: "wipe", insured: true, receipt: "customs", lines: [
    { en: "Duty, recycling fee, processing —", ru: "Пошлину, утильсбор и сбор за оформление" },
    { en: "you pay them yourself, in your bank app.", ru: "вы платите сами — в приложении своего банка." }] },

  // ── IV · home ──
  { id: "act4", card: { n: "IV", title: ACTS[3].title, sub: { en: "The last thousands of kilometres.", ru: "Последние тысячи километров." } }, vh: 75, sec: 3.5, act: 3, in: "dip", insured: true },
  { id: "vload", clip: "s9-1", vh: 100, sec: 5, act: 3, in: "dip", insured: true, toast: L.road, lines: [
    { en: "Car carrier or rail. Your choice.", ru: "Автовоз или железная дорога. Выбираете вы." }] },
  { id: "hills", clip: "s9-2", vh: 95, sec: 5, act: 3, insured: true, lines: [
    { en: "You pick the carrier — and pay them directly.", ru: "Перевозчика выбираете вы — и платите ему напрямую." }] },
  { id: "maproad", insert: "mapRoad", bg: "s9-3", vh: 100, sec: 5, act: 3, insured: true },
  { id: "taiga", clip: "s9-3", vh: 90, sec: 4, act: 3, in: "wipe", insured: true, lines: [
    { en: "Tracked online,", ru: "Видно онлайн," }] },
  { id: "sunset", clip: "s9-4", vh: 95, sec: 5, act: 3, insured: true, lines: [
    { en: "insured every kilometre.", ru: "застрахован каждый километр." }] },
  { id: "street", clip: "s10-1", vh: 90, sec: 4, act: 3, in: "dip", insured: true, posM: "45% 50%", lines: [
    { en: "And one morning —", ru: "И однажды утром —" }] },
  { id: "hand", clip: "s10-3", vh: 100, sec: 5, act: 3, insured: true, posM: "55% 50%", lines: [
    { en: "the keys are in your hand.", ru: "ключи у вас в руке." }] },
  { id: "house", clip: "s10-4", vh: 145, sec: 7, act: 3, in: "wipe", insured: true, toast: L.zero, posM: "40% 50%", lines: [
    { en: "Dawn finds her home.", ru: "Рассвет застаёт его у дома." }, // line by Muse Wonder
    { en: "No commission. No hidden payments.", ru: "Без комиссии. Без скрытых платежей." },
    { en: "Just proof.", ru: "Только доказательства." }] },
  { id: "end", end: true, vh: 120, sec: 6, act: 3, in: "dip", insured: true },
];

export const UI = {
  presents: { en: "The true story of one car", ru: "Реальная история одного авто" },
  watch: { en: "Play the film", ru: "Смотреть фильм" },
  stop: { en: "Pause", ru: "Пауза" },
  scroll: { en: "or scroll", ru: "или листайте" },
  tagline: { en: "The bridge between you and your car.", ru: "Мост между вами и вашим автомобилем." },
  ledger: { en: "Receipt", ru: "Чек" },
  byInvoice: { en: "Korea invoice", ru: "инвойс в Корее" },
  byYou: { en: "paid by you", ru: "платите вы" },
  insured: { en: "Insured", ru: "Застраховано" },
  zeroNote: { en: "We earn from Korea's export VAT refund — not from you.", ru: "Мы зарабатываем на возврате экспортного НДС в Корее — не на вас." },
  endLine: { en: "Trust, verified.", ru: "Доверие, которое можно проверить." },
  endFacts: { en: "One invoice in Korea · Insured at every stage · Customs in your name · Zero commission", ru: "Один инвойс в Корее · Страховка на каждом этапе · Таможня на ваше имя · Ноль комиссии" },
  seeProof: { en: "See her real report ↓", ru: "Его настоящий отчёт ↓" },
  checkOwn: { en: "Check your own car", ru: "Проверить своё авто" },
  proofKicker: { en: "Epilogue · the evidence", ru: "Эпилог · доказательства" },
  proofTitle: { en: "This was a real car. Here is her real inspection.", ru: "Это было реальное авто. Вот его настоящий осмотр." },
  proofSub: { en: "Take it apart — panel by panel. Every panel opens its real photos.", ru: "Разберите его — деталь за деталью. Каждая деталь открывает свои настоящие фото." },
  allGarages: { en: "Open the garage of every inspection", ru: "Гараж каждого осмотра" },
};
