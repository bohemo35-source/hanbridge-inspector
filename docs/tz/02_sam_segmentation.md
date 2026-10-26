# ТЗ-02 — SAM 3.1: панели, дефекты, номера + загрузка медиа

Сначала прочитай AGENTS.md. Выполни задание целиком; проблемы фиксируй в отчёте.

## Цель
Инструмент агента `segment_image`: по фото осмотра SAM 3.1 возвращает боксы/маски дефектов, панелей и номерных знаков, которые становятся `Evidence` (кадр + маска). Плюс прямая загрузка медиа в Blob и извлечение кадров из видео обхода.

## Что сделать
1. Загрузка: `src/app/api/upload/route.ts` (handleUpload из `@vercel/blob/client`) + компонент `MediaUploader` (drag&drop, фото/видео/WAV, прогресс). Файлы идут клиент → Blob напрямую. Типы и лимиты: фото ≤ 15 МБ, видео ≤ 200 МБ, WAV ≤ 50 МБ.
2. Кадры из видео: на клиенте (`<video>` + canvas), каждые 2 с, максимум 20 кадров, JPEG 0.85, ширина ≤ 1600 px → загрузка в Blob как `video_frame` с `takenAt` = секунда видео.
3. `src/lib/meta/sam.ts`:
   - `samSegment(imageUrlOrDataUrl, prompt)` — POST /responses c `input_text` + `input_image`. Перед отправкой — sharp: ресайз до ≤ 1600 px по длинной стороне, JPEG.
   - Парсер спец-токенов `<|box;x1;y1;x2;y2;w;h|>` и `<|mask;x;y;data=W,H,…|>` строго по https://dev.meta.ai/docs/sam/reading-segmentation → `{boxes: Box[], masks: Mask[]}`. Координаты нормализовать к исходному размеру изображения.
   - Маску сохранять в Blob как PNG (белое на прозрачном) → `maskRef` = URL.
4. Инструмент `segment_image({mediaId, targets})`, `targets` ⊂ `["scratch","dent","rust","license_plate","panel"]`; по одному SAM-запросу на target, параллельно (≤ 3 одновременно). Результат: `Detection {target, box, maskRef, area, mediaId}`.
5. Привязка к панели: для `panel` — промпты по списку панелей (front_bumper, hood, front_left_fender, … rear_bumper, roof, всего ≤ 13); дефект относится к панели с максимальным пересечением боксов (IoU/покрытие). Если панель не найдена — `panel:"unknown"`.
6. Отладочная страница `/lab/sam` (только dev, `notFound()` в prod): загрузить фото → оверлей боксов и масок разными цветами, подписи target + область.
7. `scripts/smoke/sam.mjs` — живой запрос на фото из `demo-data/photos/` (первое по алфавиту), печатает число боксов/масок по каждому target и сохраняет оверлей в `docs/reports/assets/sam-smoke.png`.
8. Юнит-тесты парсера на зафиксированных сырых строках ответа SAM (сохранить 2–3 реальных ответа в `tests/fixtures/sam/` без персональных данных).

## Критерии готовности
- tsc / build / lint / vitest зелёные; сырой вывод в docs/reports/tz-02.md.
- `node --check scripts/smoke/sam.mjs`; smoke прогнан, вывод + `sam-smoke.png` в отчёте.
- Загрузка видео 30–60 с через UI → в Blob появляются кадры (список URL в отчёте).
- Номер на демо-фото найден (`license_plate` ≥ 1 бокс) — или честно «не найден» с сырым ответом SAM.
- Никаких вызовов SAM мимо `src/lib/meta/`.
