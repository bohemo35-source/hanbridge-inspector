# ТЗ-06 — 3D-карта кузова: шаблоны кузовов, 13 панелей, подсветка по находкам, разборка

Статус: **выполнено Claude в ветке `tz-06`** (28.10). Этот файл описывает, что сделано и как это встраивать. Отчёт: `docs/reports/tz-06.md`.

## Цель
В отчёте `/r/:id` — живая 3D-машина в стиле студийного шоурума: тёмная сцена, тёплый ключевой свет, холодный контровой, зеркальный пол, золотая дуга-«мост». Каждая из 13 панелей окрашена по замеру толщиномера и находкам агента; клик по панели открывает её доказательства (оригинальный кадр с маской SAM, цитата голоса с таймкодом, замер, строка аукционного листа, решение verifier). «Разобрать» разводит панели в exploded view, «Собрать» — обратно.

3D — **схема кузова по шаблону типа кузова**, а не копия конкретной машины. Доказательства всегда реальные (оригинальные кадры осмотра).

## Решение по ассетам (изменено относительно первой версии ТЗ)
Вместо моделей из Rodin машина **строится кодом** (`buildCar.ts`): параметрический лофт кузова, сразу разрезанный на 13 панелей со швами, отдельно стёкла, стойки, колёса, световые полосы. Плюсы: никаких внешних ассетов и лицензий, бренд-нейтрально по построению, панели точные (не нужна нарезка в Blender), три типа кузова — это три набора параметров, ~62k треугольников, 0 байт загрузки модели.

## Что сделано (файлы)
- `src/components/damage-map-3d/bodyTemplates.ts` — параметры `sedan`, `suv`, `hatchback` (+ вариант 3-дверного хэтчбека без задних дверей).
- `src/components/damage-map-3d/buildCar.ts` — генератор: лофт кузова и greenhouse, разметка квадов по панелям (бампер/капот/крылья/двери/багажник/крыша), швы (`LineSegments` по границам панелей), внутренний тёмный «каркас», колёса, свет, векторы разлёта, `panelBoxes()` для проверок.
- `src/components/damage-map-3d/panels.ts` — 13 id панелей (как в `FINDINGS_DRAFT_SPEC`), подписи RU/EN, `panelVisual()` — цвет/сила/метка по замеру и находкам (≤150 `#4fb38a`, 151–220 `#e3a33b`, >220 `#e5544b`, только неподтверждённые находки `#9a8cf0`).
- `src/components/damage-map-3d/DamageMap3D.tsx` — сцена three.js (без R3F): OrbitControls, RoomEnvironment, Reflector, клик по панели (порог 6 px), метки над панелями с находками, облёт камеры по сфере (не сквозь машину), «Толщиномер / Разобрать / Сброс вида», `prefers-reduced-motion`, фолбэк без WebGL2 или с `?no3d=1` — сетка 13 панелей.
- `src/components/damage-map-3d/PanelEvidence.tsx` — панель «Панель NN / 13»: шкала 0–150–220–300, значение, evidence по типам, плашка Verifier. Принимает `mediaUrl(mediaId)` — сюда подставляется URL оригинального кадра из Blob.
- `src/components/damage-map-3d/InspectionMap.tsx` — готовый блок для `/r/:id`: 3D + панель доказательств + список находок с общей подсветкой. Подключается через `next/dynamic` (`ssr:false`), three грузится отдельным чанком.
- `src/components/damage-map-3d/bodyTypeMap.ts` — `guessBodyType(make, model)`: MINI → hatchback, X3/XC60 → suv, 530i/E-Class/Sonata → sedan, неизвестное → sedan с флагом `guessed`.
- `src/lib/schema/index.ts` — в `vehicle` добавлены optional `bodyType` и `doors` (единственная правка вне новой папки).
- `src/app/lab/3d/` — демо-страница на фикстуре `fixtures/demoReport.ts` (демо-данные, помечены), переключатель sedan / SUV / hatchback и RU/EN. Доступна в dev и на Vercel Preview, на production — 404.
- `src/components/damage-map-3d/damageMap3d.test.ts` — 22 теста.
- `scripts/3d/capture.mjs` — playwright-скриншоты в `docs/reports/assets/`.

## Как встроить в `/r/:id` (ТЗ-05)
```tsx
import { InspectionMap } from "@/components/damage-map-3d/InspectionMap";
// report: Report из Blob; mediaUrl — URL оригинального кадра по mediaId
<InspectionMap report={report} lang={lang} mediaUrl={(id) => mediaById[id]?.url} />
```
`report.vehicle.bodyType` выставляет форма `/inspect/new` или агент через `guessBodyType`. Если 3D не запустилось — компонент сам показывает сетку панелей; SVG `DamageMap` из ТЗ-04 можно подставить туда же.

## Критерии готовности (проверено, сырой вывод в отчёте)
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build` — зелёные.
- `node --check scripts/3d/capture.mjs` — ок.
- Скриншоты: собранная, выбранная панель с доказательствами, exploded, SUV, hatchback, мобильный, фолбэк.
- Нет сторонних моделей и кода из старых проектов.

## Что осталось (не в этом ТЗ)
- Подключение в `/r/:id` после ТЗ-05 и реальные кадры вместо заглушек в `PanelEvidence` (через `mediaUrl`).
- Замер FPS на реальном GPU (в headless SwiftShader не показателен).
- Когда ТЗ-02 добавит `src/lib/domain/panels.ts` — перевести `panels.ts` на общий список (id совпадают).
