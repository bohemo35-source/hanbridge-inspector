# CONTEXT — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: долгоживущий контекст проекта · @created: 2026-10-28 -->

ИИ-осмотр б/у авто в Корее для СНГ/ЦА: медиа → находки с доказательствами → verifier → вердикт BUY/NEGOTIATE/WALK AWAY → публичный отчёт `/r/:id` + чат. Хакатон Meta Global AI Developer.

## Стек и правила
Next.js 15 + TS strict + Tailwind, Vercel Blob, zod, sharp. Meta API только через `src/lib/meta/*` (muse-spark-1.3, sam-3.1, transcribe, muse-image-1.0; open-weight — Baseten `meta-models/muse-spark-open-1026`). Секреты только в env. Подробности, доменные правила (толщиномер ≤150/151–220/>220, evidence обязателен, handoff <0.6) и запреты (код с нуля, без цифр растаможки) — в `AGENTS.md`.

## Ключевые точки входа
- `src/lib/schema` — Inspection/Finding/Evidence/Report; `src/lib/domain/panels.ts` — 13 панелей.
- `src/components/damage-map-3d/buildCar.ts` — параметрическая машина (ТЗ-06), импорт запрещён копировать.
- `src/components/journey-3d/` — сцена пути (ТЗ-08/09): `route.ts` (7 этапов, `beatAt` — 3 бита/этап), `stageContent.ts` (тексты RU/EN), `scenery.ts`, `JourneyScene.tsx` (2.5D: фото-плейты `public/journey/` + минимальный передний план; proof — `public/journey/proof/`).
- `src/lib/agent/tools/` — segment, defects, shipping (`getShippingStatus`, фикстура).
- Лабы: `/lab/3d`, `/lab/journey` (production 404).

## Команды
`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. Каждое ТЗ: ветка `tz-0N`, отчёт `docs/reports/tz-0N.md` с сырым выводом, без пуша в main без «делай».
