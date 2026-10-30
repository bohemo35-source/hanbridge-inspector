// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film journey script v2 ("the bridge of trust"): scene order, copy (EN/RU), HUD route stop, receipt lines
// @created: 2026-10-31
export type Lang = "en" | "ru";
type T = { en: string; ru: string };

export type ReceiptLine = { item: T; payee: T; by: "invoice" | "you" | "zero" };
export type FilmScene = {
  id: string;            // clip file: /film/<id>.mp4 (+ .jpg poster)
  vh: number;            // scroll length of the scene
  place: T;              // top-right label
  stop: number;          // index in ROUTE (HUD golden line)
  chapter?: T;           // small amber label
  title?: T;             // big serif line
  sub?: T;               // one short paragraph
  insured?: boolean;     // shield is lit from here on
  receipt?: ReceiptLine[]; // lines appended to the open receipt at this scene
  panel?: "steps";       // replace receipt with inspection steps
  hero?: boolean;        // brand title layout
  cta?: boolean;
};

export const ROUTE: T[] = [
  { en: "Seoul", ru: "Сеул" }, { en: "Inspection", ru: "Осмотр" }, { en: "Busan", ru: "Пусан" },
  { en: "Sea", ru: "Море" }, { en: "Vladivostok", ru: "Владивосток" }, { en: "Customs", ru: "Таможня" }, { en: "Home", ru: "Дом" },
];

export const SCENES: FilmScene[] = [
  { id: "bridge-a", vh: 170, hero: true, stop: 0, place: { en: "Seoul · Han River", ru: "Сеул · река Хан" },
    title: { en: "Hanbridge Auto", ru: "Hanbridge Auto" }, sub: { en: "The bridge between you and your car.", ru: "Мост между вами и вашим автомобилем." } },
  { id: "bridge-b", vh: 140, stop: 0, place: { en: "Seoul · Han River", ru: "Сеул · река Хан" },
    chapter: { en: "Why a bridge", ru: "Почему мост" },
    title: { en: "You can't touch a car\n8,000 km away.", ru: "Машину за 8 000 км\nне потрогать." },
    sub: { en: "So trust has to be built — step by step, in the open.", ru: "Значит, доверие нужно построить — шаг за шагом, открыто." } },
  { id: "bridge-c", vh: 140, stop: 0, place: { en: "Seoul · Han River", ru: "Сеул · река Хан" },
    chapter: { en: "Why a bridge", ru: "Почему мост" },
    title: { en: "A bridge of trust.", ru: "Мост доверия." },
    sub: { en: "Open prices. Every step visible. Insured all the way. No reseller in between.", ru: "Открытые цены. Каждый шаг виден. Страховка на всём пути. Без перекупщиков." } },
  { id: "onbridge", vh: 150, stop: 0, insured: true, place: { en: "Seoul", ru: "Сеул" },
    chapter: { en: "01 · Purchase", ru: "01 · Выкуп" },
    title: { en: "Bought at the listed price.", ru: "Выкуплен по цене площадки." },
    sub: { en: "Exactly the price on the Korean platform, plus its standard fee. From this moment the car is insured.", ru: "Ровно цена на корейской площадке плюс её стандартная комиссия. С этой минуты машина застрахована." },
    receipt: [{ item: { en: "Car, listed price", ru: "Авто, цена площадки" }, payee: { en: "seller", ru: "продавцу" }, by: "invoice" },
              { item: { en: "Platform fee", ru: "Комиссия площадки" }, payee: { en: "standard", ru: "стандарт" }, by: "invoice" }] },
  { id: "service", vh: 130, stop: 1, insured: true, panel: "steps", place: { en: "Inspection center", ru: "Инспекционный центр" },
    chapter: { en: "02 · Inspection", ru: "02 · Осмотр" },
    title: { en: "Before it ships,\nwe inspect it.", ru: "Перед отправкой —\nосмотр." },
    sub: { en: "Photos, paint gauge on every panel, voice notes.", ru: "Фото, толщиномер на каждой панели, голосовые заметки." } },
  { id: "inspect", vh: 150, stop: 1, insured: true, panel: "steps", place: { en: "Inspection center", ru: "Инспекционный центр" },
    chapter: { en: "02 · Inspection", ru: "02 · Осмотр" },
    title: { en: "Every panel, measured.", ru: "Каждая панель измерена." },
    sub: { en: "Meta Muse Spark turns photos, gauge readings and voice notes into one report. You approve it — or walk away.", ru: "Meta Muse Spark собирает фото, замеры и голос в один отчёт. Вы одобряете — или отказываетесь." } },
  { id: "carrier", vh: 130, stop: 1, insured: true, place: { en: "Korea · highway", ru: "Корея · трасса" },
    chapter: { en: "03 · Export", ru: "03 · Экспорт" },
    title: { en: "Deregistered.\nDocuments ready.", ru: "Снят с учёта.\nДокументы готовы." },
    sub: { en: "On a car carrier to the port — insured.", ru: "На автовозе в порт — застрахован." },
    receipt: [{ item: { en: "Car carrier, documents", ru: "Автовоз, документы" }, payee: { en: "Korea costs", ru: "расходы в Корее" }, by: "invoice" }] },
  { id: "port", vh: 150, stop: 2, insured: true, place: { en: "Busan port", ru: "Порт Пусан" },
    chapter: { en: "04 · Busan", ru: "04 · Пусан" },
    title: { en: "One invoice in Korea.", ru: "Один инвойс в Корее." },
    sub: { en: "Car, platform fee and Korea costs. Freight at the carrier's real tariff — check it on their site.", ru: "Авто, комиссия площадки и расходы по Корее. Фрахт по реальному тарифу перевозчика — проверьте на его сайте." },
    receipt: [{ item: { en: "Sea freight", ru: "Морской фрахт" }, payee: { en: "carrier tariff", ru: "тариф перевозчика" }, by: "invoice" }] },
  { id: "sea", vh: 130, stop: 3, insured: true, place: { en: "Sea of Japan", ru: "Японское море" },
    chapter: { en: "05 · At sea", ru: "05 · В море" },
    title: { en: "You see where it is.\nEvery day.", ru: "Вы видите, где машина.\nКаждый день." },
    sub: { en: "Status in your portal and in Telegram — no calls, no guessing.", ru: "Статус в кабинете и в Telegram — без звонков и догадок." } },
  { id: "vladivostok", vh: 140, stop: 4, insured: true, place: { en: "Vladivostok", ru: "Владивосток" },
    chapter: { en: "06 · Arrival", ru: "06 · Прибытие" },
    title: { en: "Same car.\nSame condition.", ru: "Та же машина.\nТо же состояние." },
    sub: { en: "Unloaded and compared with the inspection, panel by panel.", ru: "Выгружена и сверена с осмотром, панель за панелью." } },
  { id: "svh", vh: 120, stop: 4, insured: true, place: { en: "Vladivostok · bonded yard", ru: "Владивосток · СВХ" },
    chapter: { en: "06 · Arrival", ru: "06 · Прибытие" },
    title: { en: "Bonded storage.", ru: "Склад временного хранения." },
    sub: { en: "The car waits for clearance under customs supervision. Still insured.", ru: "Машина ждёт оформления под таможенным контролем. Застрахована." } },
  { id: "customs", vh: 150, stop: 5, insured: true, place: { en: "Customs", ru: "Таможня" },
    chapter: { en: "07 · Customs", ru: "07 · Таможня" },
    title: { en: "Customs — in your name.", ru: "Таможня — на ваше имя." },
    sub: { en: "The receipt comes to you. You pay duty, recycling fee and processing fee yourself, in your bank app.", ru: "Квитанция приходит вам. Пошлину, утильсбор и сбор за оформление вы платите сами, в приложении банка." },
    receipt: [{ item: { en: "Duty · recycling · processing", ru: "Пошлина · утильсбор · оформление" }, payee: { en: "customs", ru: "таможне" }, by: "you" }] },
  { id: "truck-ru", vh: 140, stop: 6, insured: true, place: { en: "On the road", ru: "В пути" },
    chapter: { en: "08 · Last mile", ru: "08 · Последняя миля" },
    title: { en: "Your carrier.\nYour choice.", ru: "Ваш перевозчик.\nВаш выбор." },
    sub: { en: "Car carrier or rail to your city. Pay them directly — or pick your own.", ru: "Автовоз или ЖД до вашего города. Платите напрямую — или выберите своего." },
    receipt: [{ item: { en: "Delivery to your city", ru: "Доставка до города" }, payee: { en: "carrier", ru: "перевозчику" }, by: "you" }] },
  { id: "handover", vh: 170, stop: 6, insured: true, cta: true, place: { en: "Home", ru: "Дом" },
    chapter: { en: "That's the bridge", ru: "Это и есть мост" },
    title: { en: "Track every mile yourself.", ru: "Контролируйте весь путь сами." },
    sub: { en: "Getting your car is now simple and clear — as it should be.", ru: "Получить свою машину теперь просто и понятно — как и должно быть." },
    receipt: [{ item: { en: "Hanbridge commission", ru: "Комиссия Hanbridge" }, payee: { en: "none", ru: "нет" }, by: "zero" }] },
];

export const UI = {
  receipt: { en: "Open receipt", ru: "Открытый чек" },
  byInvoice: { en: "Korea invoice", ru: "инвойс в Корее" },
  byYou: { en: "paid by you", ru: "платите вы" },
  insured: { en: "Insured", ru: "Застрахован" },
  scroll: { en: "Scroll to cross", ru: "Листайте, чтобы перейти" },
  cta: { en: "Cross the bridge", ru: "Перейти мост" },
  seeInspection: { en: "See how we inspect it ↓", ru: "Как мы осматриваем ↓" },
  zeroNote: { en: "We earn from Korea's export VAT refund — not from you.", ru: "Мы зарабатываем на возврате экспортного НДС в Корее — не на вас." },
  steps: [
    { en: "Photos", ru: "Фото" }, { en: "Paint gauge", ru: "Толщиномер" },
    { en: "AI report · Muse Spark", ru: "AI-отчёт · Muse Spark" }, { en: "Your approval", ru: "Ваше одобрение" },
  ],
  stepsTitle: { en: "Inspection", ru: "Осмотр" },
  garageTitle: { en: "Open the car. Panel by panel.", ru: "Откройте машину. Панель за панелью." },
  garageSub: { en: "The real report on a 3D model — every finding on its panel.", ru: "Настоящий отчёт на 3D-модели — каждая находка на своей панели." },
};
