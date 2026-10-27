# ТЗ-02 — SAM 3.1 + Spark vision: машина, номер, дефекты с доказательствами

Сначала прочитай AGENTS.md (особенно «Экономия лимита Muse» и раздел про `sam-3.1` — формат ответа уже проверен живьём). Выполни целиком, без вопросов; что не вышло — в отчёт.

## Цель
Инструменты агента для фото осмотра:
1. `segment_image` — SAM 3.1 находит машину, номер, колёса (боксы + маски) → `Evidence` типа `mask`.
2. `find_defects` — Spark vision ищет дефекты на вырезке машины (SAM `car`), каждый дефект с боксом на исходном фото → `Finding` с evidence `frame`.
3. Скрипт, который прогоняет это по фото машины из `demo-data/<car>/photos/` и рисует оверлеи (картинки для видео и отчёта).

Почему так: живой тест показал — SAM уверенно находит `car` / `license plate`, но `scratch`/`dent` даёт 0. Значит SAM = геометрия и доказательства, Spark = эксперт, который смотрит на вырезку.

## Данные
- `demo-data/mini-cooper-s/photos/*.jpg` — 73 реальных фото (в git не входят). Фото с номером для smoke: `photo_243114_0.jpg` (вид сзади).
- `tests/fixtures/sam/*.txt` — реальные сырые ответы SAM (см. README там же). Тесты парсера — только на них, без запросов к API.

## Что сделать
1. `src/lib/meta/sam.ts`
   - `samSegment(image: Buffer, concept: string)` → `{ width, height, instances: SamInstance[] }`. Перед отправкой: sharp `.rotate()` (EXIF), resize inside 1280×1280, JPEG q85, data URL. Через `metaFetch` (`/responses`, timeout 30 c).
   - `parseSamText(text)` — строго по формату из AGENTS.md: `<|box;x1=…;y1=…;x2=…;y2=…;w=…;h=…|>` (key=value), опционально следом `<|mask;x=…;y=…;data=H,W,<encoded>|>`. Пустая строка → `[]`.
   - Декодирование маски по https://dev.meta.ai/docs/sam/reading-segmentation → бинарная маска H×W относительно бокса. Если за 2 попытки не получается — `mask: null, maskDecoded: false`, работаем по боксам, пишешь в отчёт. Это не блокер.
   - `scaleBox(box, from {w,h}, to {w,h})` — пересчёт в координаты исходного фото.
2. `src/lib/agent/tools/segment.ts` — `segmentImage({ carId, photoId, imagePath | imageUrl, concepts })`, concepts ⊂ `["car","license plate","wheel"]`, запросы параллельно (≤3). Выбор главного экземпляра:
   - `car`: бокс с наибольшей площадью, пересекающий центр кадра;
   - `license plate`: внутри или у нижней кромки бокса главной машины, соотношение сторон 2–6, наибольший. Остальные номера (чужие машины на фоне) отбрасываются.
   - Маски сохраняются PNG в `public/generated/<carId>/<photoId>-<concept>.png` (папка в .gitignore) → `maskRef`.
3. `src/lib/agent/tools/defects.ts` — `findDefects({ carId, photoId, image })`:
   - вырезка по боксу главной машины (+5% поля), ≤1280 px;
   - `sparkJson` с точным контрактом (по образцу `src/lib/schema/prompt.ts`): `{ view: front|rear|left|right|front_left|front_right|rear_left|rear_right|detail|interior|engine, panels_visible: Panel[], defects: [{ panel, kind, severity, box:{x1,y1,x2,y2} (в координатах вырезки), description_en, description_ru, confidence }] }`;
   - пересчёт боксов в координаты исходного фото; `Finding` с evidence `{ type:"frame", mediaId: photoId, box, panel }`, `verified:false`;
   - словарь панелей — общий `src/lib/domain/panels.ts` (13 панелей + `unknown`, как в `prompt.ts`).
4. `scripts/inspect-photos.ts` (запуск `npx tsx scripts/inspect-photos.ts <carId> [--limit N]`):
   - берёт фото из `demo-data/<carId>/photos/` (по умолчанию первые 8 по имени, `--limit`), для каждого: `segmentImage` + `findDefects`;
   - пишет `demo-data/<carId>/out/photos.json` (детекции, дефекты, view, время каждого вызова) и оверлеи `demo-data/<carId>/out/overlay/<photoId>.jpg`: бокс машины (тонкий), номер (жёлтый), дефекты (красные с подписью kind/severity), маска машины полупрозрачной заливкой если декодирована. Рисовать через sharp + SVG composite.
   - Не запускать на всех 73 фото: только `--limit 8` в отчёте.
5. Тесты (vitest, без сети): парсер на трёх фикстурах (5 боксов для plate, 11 для car, 0 для scratch; точные координаты главного номера 514,354,756,415); выбор главного номера; `scaleBox`; если маска декодируется — площадь маски > 0 и ≤ площади бокса.
6. `scripts/smoke/sam.mjs` — один живой запрос `license plate` на `photo_243114_0.jpg`, печать числа экземпляров и бокса главного номера. `node --check`.
7. `devDependencies`: добавить `tsx`. `.gitignore`: `public/generated/`, `demo-data/*/out/`.

## Не делать в этом ТЗ
Загрузку в Blob, UI-страницы, размытие номеров (ТЗ-04), агента (ТЗ-05).

## Критерии готовности
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` — зелёные; `next build` — один раз в конце, зелёный.
- `node --check scripts/smoke/sam.mjs`; smoke прогнан, сырой вывод в отчёте.
- `npx tsx scripts/inspect-photos.ts mini-cooper-s --limit 8` прогнан: в отчёте сводка по каждому фото (view, найден ли номер, число дефектов, ms) и 2–3 пути к оверлеям.
- Главный номер на `photo_243114_0.jpg` найден, чужие номера отброшены.
- Отчёт `docs/reports/tz-02.md` — сырой вывод команд + «маска декодирована: YES/NO».
- Ветка `tz-02`, коммиты по ходу, `git push -u origin tz-02`. В main не мержить.
