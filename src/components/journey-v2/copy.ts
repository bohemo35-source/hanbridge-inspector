// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Journey v2 copy RU/EN: HUD, captions, bridges extras, finale (stage texts live in journey-3d/stageContent)
// @created: 2026-10-29
import type { Lang, Localized } from "@/components/journey-3d/stageContent";
export type { Lang, Localized };

export const HUD_LABELS: Record<string, Localized> = {
  purchase: { ru: "Покупка", en: "Purchase" },
  inspection: { ru: "Осмотр", en: "Inspection" },
  documents: { ru: "Документы", en: "Documents" },
  port: { ru: "Порт", en: "Port" },
  sea: { ru: "Море", en: "Sea" },
  arrival: { ru: "Прибытие", en: "Arrival" },
  customs: { ru: "Таможня", en: "Customs" },
  delivery: { ru: "Доставка", en: "Delivery" },
};

export const CAPTIONS: Record<string, Localized> = {
  seoul: { ru: "Покупка в Корее — находим машину на аукционах и у дилеров", en: "Purchase in Korea — we find the car at auctions and dealers" },
  garage: { ru: "Осмотр в гараже: каждая находка — с доказательством", en: "Garage inspection: every finding comes with evidence" },
  port: { ru: "Порт Пусан: приёмка, фотофиксация, погрузка на судно", en: "Busan port: check-in, condition photos, loading" },
  vladivostok: { ru: "Владивосток: выгрузка и фото прибытия", en: "Vladivostok: unloading and arrival photos" },
  road: { ru: "Дорога до вашего города: маршрут рисуется по земле", en: "The road to your city: the route is drawn on the ground" },
  handover: { ru: "Ключи и документы переданы", en: "Keys and documents handed over" },
  finale: { ru: "Одна ссылка на машину — от Кореи до вашего гаража", en: "One link for the car — from Korea to your garage" },
};

export const EXTRA_CARDS: Record<string, Array<{ title: Localized; body: Localized }>> = {
  "bridge-sea": [{ title: { ru: "Документы на шаг впереди", en: "Documents one step ahead" }, body: { ru: "Пока машина в море, пакет документов уже готовится к подаче — таможня не ждёт прибытия судна.", en: "While the car is at sea, the document pack is already being prepared — customs does not wait for the vessel to arrive." } }],
  "bridge-customs": [{ title: { ru: "Cleared", en: "Cleared" }, body: { ru: "После выпуска таможней машина получает отметку «Cleared» — и едет дальше уже как ваша.", en: "Once customs releases the car it is marked “Cleared” — and travels on as yours." } }],
};

export const FINALE: { pickCar: Localized; demoReport: Localized; totalNote: Localized } = {
  pickCar: { ru: "Подобрать авто", en: "Find a car" },
  demoReport: { ru: "Демо-отчёт осмотра", en: "Demo inspection report" },
  totalNote: { ru: "После оплаты до Москвы — примерно 4–5 недель", en: "After payment, to Moscow in about 4–5 weeks" },
};
export const REVIEWS_TITLE: Localized = { ru: "Отзывы клиентов", en: "Client reviews" };
export const HANDOVER_CARD: Localized = { ru: "Ключи и документы переданы", en: "Keys and documents handed over" };
