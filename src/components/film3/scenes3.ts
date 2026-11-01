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
    { en: "How do you touch a car 8,000 km away?", ru: "Как потрогать машину за 8 000 км?" },
    { en: "Sit behind the wheel, look under the hood?", ru: "Посидеть за рулём, заглянуть под капот?" }] },
  { id: "c", clip: "bridge-c", vh: 100, sec: 5, ch: 0, sub: [{ en: "That's what Hanbridge is for — an international bridge between you and your car.", ru: "Для этого есть Hanbridge — международный мост между вами и вашим автомобилем." }] },
  { id: "d", clip: "s0-4", vh: 100, sec: 5, ch: 0 },
  { id: "e", clip: "s0-5", vh: 100, sec: 5, ch: 0 },
  { id: "f", clip: "s0-6", vh: 100, sec: 5, ch: 0 },
  // 01 · request & selection
  { id: "req", insert: "request", bg: "s0-6", vh: 130, sec: 6, ch: 1, sub: [
    { en: "It starts with your wish to buy a car — and your request: budget, wishes, timing.", ru: "Всё начинается с желания купить автомобиль и вашей заявки: бюджет, пожелания, сроки." }] },
  { id: "pick", insert: "pick", bg: "s2-1", vh: 140, sec: 7, ch: 1, sub: [
    { en: "A manager picks options one by one, for every point of your request —", ru: "Менеджер подбирает варианты индивидуально, под каждый пункт заявки —" },
    { en: "with the real prices any buyer in Korea sees.", ru: "с реальными ценами, как их видит любой покупатель в Корее." }] },
  // 02 · inspection
  { id: "lift", clip: "s2-1", vh: 110, sec: 5, ch: 2, sub: [{ en: "Our expert inspects the car you chose — before you pay.", ru: "Выбранную машину проверяет наш эксперт — до оплаты." }] },
  { id: "gauge", clip: "s2-2", vh: 110, sec: 5, ch: 2, chips: [{ en: "100 µm", ru: "100 мкм" }],
    sub: [{ en: "Every part, outside and in, is checked with instruments and recorded on photo, video and in documents.", ru: "Каждый элемент снаружи и в салоне проверяется приборами и фиксируется на фото, видео и в документах." }] },
  { id: "report", insert: "report", bg: "s2-2", vh: 140, sec: 7, ch: 2, sub: [
    { en: "AI gathers the media, readings and voice notes into one report.", ru: "Медиа, замеры и голосовые заметки ИИ собирает в один отчёт." }] },
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
  { id: "bay", clip: "s7-1", vh: 110, sec: 5, ch: 7, insured: true, sub: [{ en: "At every stage of the journey the car is insured.", ru: "На каждом этапе пути машина застрахована." }] },
  { id: "ramp", clip: "s7-2", vh: 120, sec: 6, ch: 7, insured: true, chips: [{ en: "Matched to inspection", ru: "Сверено с осмотром" }, { en: "Bonded yard · 7–10 days", ru: "СВХ · 7–10 дней" }], sub: [
    { en: "We check it against the inspection report: it must be exactly as it was inspected.", ru: "Сверяем машину с отчётом осмотра: она должна быть точно в том состоянии, в каком её осмотрели." },
    { en: "Then the bonded yard — usually seven to ten days.", ru: "Дальше — склад временного хранения. Обычно семь–десять дней." }] },
  // 08 · customs
  { id: "orbit", clip: "s8-1", vh: 110, sec: 5, ch: 8, insured: true, sub: [{ en: "Customs clearance follows the law to the letter.", ru: "Таможенное оформление — строго по правилам и закону." },
    { en: "Every payment and receipt is in your name — only you can pay them.", ru: "Все платежи и квитанции — только на ваше имя, и оплатить их можете только вы." }] },
  { id: "gate", clip: "s8-2", vh: 170, sec: 9, ch: 8, insured: true, receipt: "customs", sub: [
    { en: "The receipt comes to you.", ru: "Квитанция приходит вам." },
    { en: "Duty, recycling fee and processing fee — you pay them yourself, in your bank app.", ru: "Пошлину, утильсбор и сбор за оформление вы платите сами, в приложении банка." }] },
  // 09 · road
  { id: "vload", clip: "s9-1", vh: 110, sec: 5, ch: 9, insured: true, toast: L.road, sub: [
    { en: "Then a car carrier or rail.", ru: "Дальше — автовоз или железная дорога." }] },
  { id: "hills", clip: "s9-2", vh: 110, sec: 5, ch: 9, insured: true, sub: [{ en: "You choose the carrier and pay them directly.", ru: "Перевозчика выбираете вы и платите ему напрямую." }] },
  { id: "maproad", insert: "mapRoad", bg: "s9-3", vh: 120, sec: 6, ch: 9, insured: true },
  { id: "taiga", clip: "s9-3", vh: 100, sec: 5, ch: 9, insured: true, sub: [{ en: "Its location — online,", ru: "Где машина — видно онлайн," }] },
  { id: "sunset", clip: "s9-4", vh: 100, sec: 5, ch: 9, insured: true, sub: [{ en: "every kilometre insured.", ru: "застрахован каждый километр." }] },
  // 10 · home
  { id: "street", clip: "s10-1", vh: 110, sec: 5, ch: 10, insured: true, sub: [{ en: "Meet your car.", ru: "Встречайте свой автомобиль." }] },
  { id: "unload", clip: "s10-2", vh: 110, sec: 5, ch: 10, insured: true, toast: L.zero, sub: [{ en: "No commission. No hidden payments.", ru: "Без комиссии, без скрытых платежей." }] },
  { id: "hand", clip: "s10-3", vh: 110, sec: 5, ch: 10, insured: true, sub: [{ en: "Simple and clear — as it should be.", ru: "Просто и понятно — как и должно быть." }] },
  { id: "house", clip: "s10-4", vh: 150, sec: 7, ch: 10, insured: true, cta: true, sub: [{ en: "That's the bridge between you and your car.", ru: "Это и есть мост между вами и вашим автомобилем." }] },
];

export const UI = {
  watch: { en: "▶ Watch your car's journey", ru: "▶ Смотреть путь вашего автомобиля" },
  stop: { en: "❚❚ Pause", ru: "❚❚ Пауза" },
  scroll: { en: "or scroll to cross", ru: "или листайте, чтобы перейти" },
  tagline: { en: "The bridge between you and your car.", ru: "Мост между вами и вашим автомобилем." },
  receipt: { en: "Open receipt", ru: "Открытый чек" },
  byInvoice: { en: "Korea invoice", ru: "инвойс в Корее" },
  byYou: { en: "paid by you", ru: "платите вы" },
  insured: { en: "Insured", ru: "Застрахована" },
  zeroNote: { en: "We earn from Korea's export VAT refund — not from you.", ru: "Мы зарабатываем на возврате экспортного НДС в Корее — не на вас." },
  cta: { en: "Enter the bridge", ru: "Перейти в мост" },
  seeReport: { en: "Open the report ↓", ru: "Открыть отчёт ↓" },
  proofTitle: { en: "This was a real car — its journey and real data from its report.", ru: "Это была реальная машина — её путь и настоящие данные из отчёта." },
  proofSub: { en: "Open it — panel by panel.", ru: "Откройте — панель за панелью." },
};
