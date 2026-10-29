# CONTEXT — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: долгоживущий контекст проекта · @created: 2026-10-28 · @updated: 2026-10-30 claude-code -->

ИИ-осмотр б/у авто в Корее для СНГ/ЦА: медиа → находки с доказательствами → verifier → вердикт BUY/NEGOTIATE/WALK AWAY → публичный отчёт `/r/:id` + чат. Хакатон Meta Global AI Developer.

## Стек и правила
Next.js 15 + TS strict + Tailwind, Vercel Blob, zod, sharp. Meta API только через `src/lib/meta/*` (muse-spark-1.3, sam-3.1, transcribe, muse-image-1.0; open-weight — Baseten `meta-models/muse-spark-open-1026`). Секреты только в env. Подробности, доменные правила (толщиномер ≤150/151–220/>220, evidence обязателен, handoff <0.6) и запреты (код с нуля, без цифр растаможки) — в `AGENTS.md`.

## Ключевые точки входа
- `src/lib/schema` — Inspection/Finding/Evidence/Report; `src/lib/domain/panels.ts` — 13 панелей.
- `src/components/damage-map-3d/buildCar.ts` — параметрическая машина (ТЗ-06), импорт запрещён копировать.
- `src/components/journey-3d/` — сцена пути (ТЗ-08/09): `route.ts` (7 этапов, `beatAt` — 3 бита/этап), `stageContent.ts` (тексты RU/EN), `scenery.ts`, `JourneyScene.tsx` (2.5D: фото-плейты `public/journey/` + минимальный передний план; proof — `public/journey/proof/`).
- `src/lib/agent/tools/` — segment, defects, shipping (`getShippingStatus`, фикстура), listing (ТЗ-04: `makeListingPhoto` — номер из `segmentImage`, diff-гард авто; `getOrCreateHeroImage`; listing никогда не evidence), `src/lib/meta/image.ts` (generations/edits; edits маску не принимает).
- ТЗ-05: `src/lib/agent/orchestrator.ts` (Spark tool calling, ≤16 шагов, SSE `POST /api/inspections/:carId/run`, страница `/inspect/:carId`), `src/lib/agent/verifier.ts` (open-weight Baseten `src/lib/meta/sparkOpen.ts`, fallback Spark; модель в trace), инструменты `tools/{diagnostic,inspector}.ts`, каталог `src/lib/agent/catalog.ts`, store Blob/`data/reports/`, страницы `/r/:id` (noindex, OG), `/cars`; прогон: `node scripts/e2e/run-cars.mjs [carId…]`.
- Лабы: `/lab/3d`, `/lab/journey` (production 404).
- Главная `/` — journey v2 (`src/components/journey-v2/`): `blocks.ts` (BLOCKS/PLATES, vh), `SceneBlock` + `sceneKit` (WebGL ≤2 канваса, HDRI `setHdri`), `scenes/PlateScene.ts` (плейт Muse Image + 3D-машина: кадр плейта через `setViewOffset`, HDRI из `public/hdri/` CC0, мокрое зеркало, пятна фар, AO; отладка `?debug=plate&envrot=&envint=&exp=&key=&rim=&fxoff=`), `scenes/RoadScene.tsx` (аэрофото `public/journey-v2/aerial-*.jpg` + карта), `Bridge.tsx`, `FilmGrade.tsx` (виньетка/тон/зерно), `useStageFade.ts` (кроссфейд блоков: `LEAD_VH` 118 = margin −118vh + height +118vh). Гараж — `src/components/garage-3d/GarageScene.tsx` (+ `/lab/garage?beat=N`).
- Скриншоты: `node scripts/journey-v2/capture.mjs http://localhost:3100` (env `ONLY/AT/PREFIX/SUFFIX/OUT_DIR/QUERY/TRANS/SKIP_*`), `node scripts/garage/capture.mjs http://localhost:3100 <фильтр>`; нужен системный Chrome (GPU) и выход из песочницы (localhost).

## Команды
`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. Каждое ТЗ: ветка `tz-0N`, отчёт `docs/reports/tz-0N.md` с сырым выводом, без пуша в main без «делай».
