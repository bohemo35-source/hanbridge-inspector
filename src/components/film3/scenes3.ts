// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v3 script ("the bridge"): chapters, narrator subtitles (EN/RU), clips, code inserts (maps, portal UI), receipt
// @created: 2026-11-01
export type Lang = "en" | "ru";
export type T = { en: string; ru: string };

export type Insert = "request" | "pick" | "report" | "fork" | "mapKr" | "mapFan" | "mapRoad";
export type Line = { item: T; payee: T; by: "invoice" | "you" | "zero" };

export type Scene = {
  id: string;           // unique scene id
  clip?: string;        // /film3/<clip>.mp4 (+ .jpg poster)
  insert?: Insert;      // full-screen code insert over a blurred poster
  bg?: string;          // poster behind an insert
  vh: number;           // scroll length
  sec: number;          // duration in "watch" mode
  ch: number;           // chapter index (CHAPTERS / voice file nn)
  sub?: T[];            // narrator lines, shown one after another over the scene
  chips?: T[];          // short fact chips
  toast?: Line;         // one receipt line slides in
  receipt?: "busan" | "customs"; // full receipt card (only twice)
  insured?: boolean;
  hero?: boolean;
  cta?: boolean;
};

export const CHAPTERS: T[] = [
  { en: "The bridge", ru: "Мост" },
  { en: "Request & selection", ru: "Заявка и подбор" },
  { en: "Inspection", ru: "Осмотр" },
  { en: "Purchase", ru: "Выкуп" },
  { en: "Korea", ru: "Корея" },
  { en: "Busan", ru: "Пусан" },
  { en: "At sea", ru: "Море" },
  { en: "Vladivostok", ru: "Владивосток" },
  { en: "Customs", ru: "Таможня" },
  { en: "The road", ru: "Дорога" },
  { en: "Home", ru: "Дом" },
  { en: "Proof", ru: "Доказательство" },
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
  // 00 · bridge
  { id: "a", clip: "bridge-a", vh: 150, sec: 6, ch: 0, hero: true },
  { id: "b", clip: "bridge-b", vh: 120, sec: 6, ch: 0, sub: [
    { en: "You can't touch a car 8,000 km away.", ru: "Машину за восемь тысяч километров не потрогать." },
    { en: "You can't sit behind the wheel or look under the hood.", ru: "Не посидеть за рулём, не заглянуть под капот." }] },
  { id: "c", clip: "bridge-c", vh: 100, sec: 5, ch: 0, sub: [{ en: "So we built a bridge.", ru: "Поэтому мы построили мост." }] },
  { id: "d", clip: "s0-4", vh: 100, sec: 5, ch: 0 },
  { id: "e", clip: "s0-5", vh: 100, sec: 5, ch: 0 },
  { id: "f", clip: "s0-6", vh: 100, sec: 5, ch: 0 },
  // 01 · request & selection
  { id: "req", insert: "request", bg: "s0-6", vh: 130, sec: 6, ch: 1, sub: [
    { en: "It starts with your request: budget, wishes, timing.", ru: "Всё начинается с вашей заявки: бюджет, пожелания, сроки." }] },
  { id: "pick", insert: "pick", bg: "s2-1", vh: 140, sec: 7, ch: 1, sub: [
    { en: "A manager picks options on Korean platforms —", ru: "Менеджер подбирает варианты на корейских площадках —" },
    { en: "with the real prices any buyer in Korea sees.", ru: "с реальными ценами, как их видит любой покупатель в Корее." }] },
  // 02 · inspection
  { id: "lift", clip: "s2-1", vh: 110, sec: 5, ch: 2, sub: [{ en: "We inspect the car you like — before you pay.", ru: "Понравившуюся машину мы осматриваем до оплаты." }] },
  { id: "gauge", clip: "s2-2", vh: 110, sec: 5, ch: 2, chips: [{ en: "100 µm", ru: "100 мкм" }],
    sub: [{ en: "Every panel — with a paint gauge.", ru: "Каждая панель — толщиномером." }] },
  { id: "report", insert: "report", bg: "s2-2", vh: 140, sec: 7, ch: 2, sub: [
    { en: "AI turns photos, readings and voice notes into one report.", ru: "Фото, замеры и голосовые заметки ИИ собирает в один отчёт." },
    { en: "You'll see this car's findings at the end.", ru: "Находки этой машины мы покажем в конце." }] },
  { id: "fork", insert: "fork", bg: "s2-1", vh: 130, sec: 6, ch: 2, sub: [
    { en: "Something's wrong — we keep searching. You decide.", ru: "Если что-то не так — ищем дальше. Решаете вы." }] },
  // 03 · purchase
  { id: "keys", clip: "s3-1", vh: 120, sec: 6, ch: 3, insured: true, chips: [{ en: "Insured", ru: "Застрахована" }],
    toast: L.car, sub: [
    { en: "All good — we buy it at the platform price.", ru: "Вас всё устроило — выкупаем по цене площадки." },
    { en: "From this minute the car is insured.", ru: "С этой минуты машина застрахована." }] },
  // 04 · korea
  { id: "load", clip: "k4-1", vh: 110, sec: 5, ch: 4, insured: true, toast: L.kr, sub: [
    { en: "Deregistered, export documents ready —", ru: "Снимаем с учёта, готовим экспортные документы —" }] },
  { id: "hwy", clip: "s4-2", vh: 110, sec: 5, ch: 4, insured: true, sub: [{ en: "and on a car carrier to Busan port.", ru: "и на автовозе в порт Пусан." }] },
  { id: "mapkr", insert: "mapKr", bg: "s4-2", vh: 100, sec: 4, ch: 4, insured: true },
  // 05 · busan
  { id: "busan", clip: "s5-1", vh: 170, sec: 9, ch: 5, insured: true, receipt: "busan", sub: [
    { en: "In Korea you pay one invoice.", ru: "В Корее вы оплачиваете один инвойс." },
    { en: "The car, the platform's standard fee, and freight at the carrier's real tariff.", ru: "В нём машина, стандартная комиссия площадки и фрахт по реальному тарифу перевозчика." },
    { en: "Check the tariff on their site. Nothing on top.", ru: "Тариф можно проверить на его сайте. Сверху — ничего." }] },
  // 06 · sea
  { id: "sea", clip: "s6-1", vh: 140, sec: 7, ch: 6, insured: true, sub: [
    { en: "A few days at sea.", ru: "Несколько дней в море." },
    { en: "You see where the car is — in your portal and in Telegram.", ru: "Где машина — видно в личном кабинете и в телеграме." }] },
  { id: "fan", insert: "mapFan", bg: "s6-1", vh: 150, sec: 8, ch: 6, insured: true, sub: [
    { en: "From Vladivostok the roads split:", ru: "Из Владивостока дороги расходятся:" },
    { en: "Moscow, Minsk, Prague, Almaty, Tashkent.", ru: "в Москву, Минск, Прагу, Алматы, Ташкент." }] },
  // 07 · vladivostok
  { id: "bay", clip: "s7-1", vh: 110, sec: 5, ch: 7, insured: true, sub: [{ en: "The same car, in the same condition.", ru: "Та же машина, в том же состоянии." }] },
  { id: "ramp", clip: "s7-2", vh: 120, sec: 6, ch: 7, insured: true, chips: [{ en: "Matched to inspection", ru: "Сверено с осмотром" }, { en: "Bonded yard · 7–10 days", ru: "СВХ · 7–10 дней" }], sub: [
    { en: "We check it against the inspection, panel by panel.", ru: "Мы сверяем её с осмотром, панель за панелью." },
    { en: "Then the bonded yard — usually seven to ten days.", ru: "Дальше — склад временного хранения. Обычно семь–десять дней." }] },
  // 08 · customs
  { id: "orbit", clip: "s8-1", vh: 110, sec: 5, ch: 8, insured: true, sub: [{ en: "Customs is cleared in your name.", ru: "Таможня оформляется на ваше имя." }] },
  { id: "gate", clip: "s8-2", vh: 170, sec: 9, ch: 8, insured: true, receipt: "customs", sub: [
    { en: "The receipt comes to you.", ru: "Квитанция приходит вам." },
    { en: "Duty, recycling fee and processing fee — you pay them yourself, in your bank app.", ru: "Пошлину, утильсбор и сбор за оформление вы платите сами, в приложении банка." }] },
  // 09 · road
  { id: "vload", clip: "s9-1", vh: 110, sec: 5, ch: 9, insured: true, toast: L.road, sub: [
    { en: "Then a car carrier or rail.", ru: "Дальше — автовоз или железная дорога." }] },
  { id: "hills", clip: "s9-2", vh: 110, sec: 5, ch: 9, insured: true, sub: [{ en: "You choose the carrier and pay them directly.", ru: "Перевозчика выбираете вы и платите ему напрямую." }] },
  { id: "maproad", insert: "mapRoad", bg: "s9-3", vh: 120, sec: 6, ch: 9, insured: true },
  { id: "taiga", clip: "s9-3", vh: 100, sec: 5, ch: 9, insured: true, sub: [{ en: "Insured every kilometre,", ru: "Застраховано каждый километр," }] },
  { id: "sunset", clip: "s9-4", vh: 100, sec: 5, ch: 9, insured: true, sub: [{ en: "visible every day.", ru: "видно каждый день." }] },
  // 10 · home
  { id: "street", clip: "s10-1", vh: 110, sec: 5, ch: 10, insured: true, sub: [{ en: "And here it is — home.", ru: "И вот она дома." }] },
  { id: "unload", clip: "s10-2", vh: 110, sec: 5, ch: 10, insured: true, toast: L.zero, sub: [{ en: "No commission. No hidden payments.", ru: "Без комиссии, без скрытых платежей." }] },
  { id: "hand", clip: "s10-3", vh: 110, sec: 5, ch: 10, insured: true, sub: [{ en: "Simple and clear — as it should be.", ru: "Просто и понятно — как и должно быть." }] },
  { id: "house", clip: "s10-4", vh: 150, sec: 7, ch: 10, insured: true, cta: true, sub: [{ en: "That's the bridge.", ru: "Это и есть мост." }] },
];

export const UI = {
  watch: { en: "▶ Watch the film with sound", ru: "▶ Смотреть фильм со звуком" },
  stop: { en: "❚❚ Pause", ru: "❚❚ Пауза" },
  scroll: { en: "or scroll to cross", ru: "или листайте, чтобы перейти" },
  tagline: { en: "The bridge between you and your car.", ru: "Мост между вами и вашим автомобилем." },
  receipt: { en: "Open receipt", ru: "Открытый чек" },
  byInvoice: { en: "Korea invoice", ru: "инвойс в Корее" },
  byYou: { en: "paid by you", ru: "платите вы" },
  insured: { en: "Insured", ru: "Застрахована" },
  zeroNote: { en: "We earn from Korea's export VAT refund — not from you.", ru: "Мы зарабатываем на возврате экспортного НДС в Корее — не на вас." },
  cta: { en: "Cross the bridge", ru: "Перейти мост" },
  seeReport: { en: "Open this car's report ↓", ru: "Открыть отчёт этой машины ↓" },
  proofTitle: { en: "This was a real car. Here is its real report.", ru: "Это была настоящая машина. Вот её настоящий отчёт." },
  proofSub: { en: "Open it — panel by panel.", ru: "Откройте — панель за панелью." },
};
