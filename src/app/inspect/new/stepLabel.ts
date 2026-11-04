// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: /inspect/new — "now: …" line during a run. Steps reach the page only when they finish, so the label says what runs
//           AFTER the last finished step (orchestrator order: upload_video → index_photos → tool loop → finalize_report →
//           conflict_check / context_check → verifier → conflict_check → make_listing_photo → save).
// @created: 2026-11-04
export type Lang = "en" | "ru";
type L = { en: string; ru: string };

const PICK: L = { en: "Muse Spark picks the next tool", ru: "Muse Spark выбирает следующий инструмент" };
const DEFECTS: L = { en: "defect scan on each photo (SAM 3.1 + Muse Spark)", ru: "поиск дефектов на каждом фото (SAM 3.1 + Muse Spark)" };
const MEDIA: L = { en: "the rest of the video (voice / gauge screen), then paint readings", ru: "остаток видео (голос / экран толщиномера), затем разбор замеров" };
const VERIFY: L = { en: "independent verifier (Muse Spark Open) checks each finding", ru: "независимая проверка каждой находки (Muse Spark Open)" };

/** what is running now, keyed by the last FINISHED step (null = nothing finished yet) */
export const NOW_AFTER: Record<string, L> = {
  start: { en: "starting: video and photo index (Muse Glimmer; a cold GPU needs 1–3 min, after 45 s the agent goes on without the index)", ru: "старт: видео и разбор фото (Muse Glimmer; холодному GPU нужно 1–3 мин, через 45 с агент продолжит без разбора)" },
  upload_video: { en: "photo index (Muse Glimmer; a cold GPU needs 1–3 min, after 45 s the agent goes on without the index)", ru: "разбор фото (Muse Glimmer; холодному GPU нужно 1–3 мин, через 45 с агент продолжит без разбора)" },
  index_photos: DEFECTS,
  segment_image: DEFECTS,
  find_defects: { en: "defect scan on the other photos; with a video also voice and gauge screen (about 1 min)", ru: "поиск дефектов на остальных фото; с видео — ещё голос и экран толщиномера (около 1 мин)" },
  transcribe_note: MEDIA,
  read_gauge_video: MEDIA,
  read_diagnostic_report: PICK,
  read_inspector_report: PICK,
  analyze_paint_readings: { en: "paint readings done; listing photo and cost policy", ru: "замеры разобраны; фото для объявления и расчёт стоимости" },
  estimate_landed_cost: PICK,
  get_shipping_status: PICK,
  handoff_to_manager: PICK,
  recheck_panel: PICK,
  make_listing_photo: { en: "next tool or saving the report", ru: "следующий инструмент или сохранение отчёта" },
  sparkChat: { en: "Muse Spark call failed; finishing with the evidence collected so far", ru: "вызов Muse Spark не прошёл; завершаю по уже собранным данным" },
  finalize_report: { en: "voice vs gauge screen cross-check, then the verifier", ru: "сверка голоса с экраном толщиномера, затем проверка" },
  conflict_check: { en: "final cross-checks of the findings, then the listing photo", ru: "финальная сверка находок, затем фото для объявления" },
  context_check: VERIFY,
  verifier: { en: "verifier: remaining findings, then the listing photo", ru: "проверка остальных находок, затем фото для объявления" },
};
const WORKING: L = { en: "working…", ru: "работаю…" };

export function stepLabel(lastTool: string | null | undefined, lang: Lang): string {
  return (NOW_AFTER[lastTool ?? "start"] ?? WORKING)[lang];
}
