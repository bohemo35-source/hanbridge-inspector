// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Per-stage client-facing copy (RU/EN) for journey beats: what happens, documents, owner, client view, typical duration
// @created: 2026-10-29
import type { StageId } from "./route";

export type Lang = "ru" | "en";
export type Localized = Record<Lang, string>;

export interface StageContent {
  what: Localized;
  docs: Localized;
  owner: Localized;
  clientSees: Localized;
  /** Typical duration — company-provided, do not rephrase the figures. */
  typical: Localized;
}

export const STAGE_CONTENT: Record<StageId, StageContent> = {
  inspection: {
    what: {
      ru: "Менеджер подбирает варианты и присылает клиенту; клиент выбирает машину. Инспектор осматривает её по чек-листу: кузов, толщиномер, OBD-диагностика, салон, ходовая — с фото и видео.",
      en: "The manager shortlists cars and sends options to the client; the client picks one. The inspector checks it against a checklist — body, paint gauge, OBD diagnostics, interior, running gear — with photo and video.",
    },
    docs: {
      ru: "Отчёт осмотра с вердиктом уходит клиенту в тот же день. После решения клиента — бронь; на оплату 10 дней (чем раньше оплата, тем раньше машина на площадке).",
      en: "The inspection report with a verdict reaches the client the same day. After the client's decision the car is booked; payment is due within 10 days (the earlier the payment, the earlier the car is on site).",
    },
    owner: { ru: "Менеджер Hanbridge и инспектор в Корее", en: "Hanbridge manager and the inspector in Korea" },
    clientSees: {
      ru: "Варианты машин, затем полный отчёт осмотра с фото, видео и вердиктом.",
      en: "Car options, then the full inspection report with photos, video and a verdict.",
    },
    typical: { ru: "в день выбора (если до 16:00), иначе на следующий день", en: "on the day you choose (if before 16:00), otherwise the next day" },
  },
  korea_road: {
    what: {
      ru: "Оформляются экспортные документы, машина снимается с учёта (말소) и готовится к отправке, затем перегоняется в порт.",
      en: "Export documents are issued, the car is deregistered (말소) and prepared for shipment, then driven to the port.",
    },
    docs: { ru: "Экспортные документы, отметка о снятии с учёта (말소)", en: "Export documents, deregistration (말소) record" },
    owner: { ru: "Менеджер Hanbridge в Корее", en: "Hanbridge manager in Korea" },
    clientSees: { ru: "Этап «Дорога и мост» и подтверждение, что машина выехала в порт.", en: "The “Road & bridge” stage and confirmation the car is on its way to the port." },
    typical: { ru: "1–2 рабочих дня", en: "1–2 business days" },
  },
  port_busan: {
    what: {
      ru: "Машина принимается на терминале порта, её состояние фиксируется на фото, затем — погрузка на судно.",
      en: "The car is received at the port terminal, its condition is photo-documented, then it is loaded onto the vessel.",
    },
    docs: { ru: "Приёмочный акт терминала, коносамент (B/L)", en: "Terminal receipt, bill of lading (B/L)" },
    owner: { ru: "Портовый терминал и менеджер Hanbridge", en: "Port terminal and the Hanbridge manager" },
    clientSees: { ru: "Отметку о приёмке и фотофиксацию состояния перед погрузкой.", en: "Receipt confirmation and condition photos before loading." },
    typical: { ru: "до 7 дней от выкупа до погрузки — суда уходят 2 раза в неделю", en: "up to 7 days from purchase to loading — vessels sail twice a week" },
  },
  sea: {
    what: {
      ru: "Морской переход из порта отправки до Владивостока.",
      en: "The sea crossing from the departure port to Vladivostok.",
    },
    docs: { ru: "Коносамент (B/L) сопровождает груз", en: "The bill of lading (B/L) travels with the cargo" },
    owner: { ru: "Судоходная линия", en: "Shipping line" },
    clientSees: { ru: "Этап «Море» — машина в пути во Владивосток.", en: "The “Sea crossing” stage — the car is on its way to Vladivostok." },
    typical: { ru: "1–2 дня", en: "1–2 days" },
  },
  vladivostok: {
    what: {
      ru: "Выгрузка во Владивостоке, осмотр машины после доставки и фото прибытия.",
      en: "Unloading in Vladivostok, a post-delivery check and arrival photos.",
    },
    docs: { ru: "Документы о прибытии и выгрузке", en: "Arrival and unloading documents" },
    owner: { ru: "Порт Владивостока и менеджер Hanbridge", en: "Vladivostok port and the Hanbridge manager" },
    clientSees: { ru: "Фото прибытия машины во Владивосток.", en: "Arrival photos of the car in Vladivostok." },
    typical: { ru: "выгрузка и таможня в среднем 10 дней", en: "unloading and customs take about 10 days on average" },
  },
  customs: {
    what: {
      ru: "Брокер подаёт документы и таможенную декларацию; после выпуска машина получает отметку «Cleared».",
      en: "The broker files the documents and the customs declaration; once released, the car is marked “Cleared”.",
    },
    docs: { ru: "СБКТС/ЭПТС, таможенная декларация", en: "SBKTS/EPTS, customs declaration" },
    owner: { ru: "Таможенный брокер", en: "Customs broker" },
    clientSees: { ru: "Отметку «Cleared» после выпуска таможней.", en: "The “Cleared” mark after customs release." },
    typical: { ru: "выгрузка и таможня в среднем 10 дней", en: "unloading and customs take about 10 days on average" },
  },
  delivery: {
    what: {
      ru: "Машина едет автовозом или по ЖД до города клиента либо ждёт самовывоза; в конце — передача ключей и документов.",
      en: "The car travels by car carrier or rail to the client's city, or waits for pickup; finally, keys and documents are handed over.",
    },
    docs: { ru: "Пакет документов на машину передаётся клиенту вместе с ключами", en: "The car's document pack is handed to the client together with the keys" },
    owner: { ru: "Перевозчик и менеджер Hanbridge", en: "Carrier and the Hanbridge manager" },
    clientSees: { ru: "Финальный этап и передачу ключей и документов.", en: "The final stage and the handover of keys and documents." },
    typical: { ru: "до Москвы ~9 000 км, 12–14 дней", en: "to Moscow ~9,000 km, 12–14 days" },
  },
};

export const TOTAL_TIME: Localized = {
  ru: "После оплаты до Москвы — примерно 4–5 недель",
  en: "After payment, to Moscow in about 4–5 weeks",
};

export const CONTENT_LABELS: Record<"what" | "docs" | "owner" | "clientSees" | "typical", Localized> = {
  what: { ru: "Что происходит", en: "What happens" },
  docs: { ru: "Документы", en: "Documents" },
  owner: { ru: "Кто отвечает", en: "Who is responsible" },
  clientSees: { ru: "Что видит клиент", en: "What you see" },
  typical: { ru: "Обычно", en: "Typically" },
};
