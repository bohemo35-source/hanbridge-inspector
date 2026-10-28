# PROJECT-STATUS — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: живой статус и точка продолжения · @created: 2026-10-28 -->

## Сделано
- ТЗ-01 (Spark-эксперт), ТЗ-02 (SAM+дефекты) — в `main`.
- ТЗ-06 (3D-карта кузова, `buildCar`) — влита; отчёт `docs/reports/tz-06.md`.
- ТЗ-08 — в `main`: сцена пути (7 этапов), фоны Muse Image в `public/journey/`, `getShippingStatus`, hero на `/`, `/lab/journey`. Отчёт `docs/reports/tz-08.md`.
- ТЗ-09 (ветка `tz-09`, не запушена, ждёт ревью): 2.5D фото-плейты на весь вьюпорт + туман по низу фото, передний план только активного этапа, rim/контактная тень/bloom, 3 бита на этап (`beatAt`), `stageContent.ts` RU/EN со сроками компании, proof-миниатюры MINI с замозаиченными номерами (`public/journey/proof/`), 1400vh скролл. Отчёт `docs/reports/tz-09.md`.

## Состояние
`tsc` 0, `lint` 0, `vitest` 50 passed, `build` OK. Сцена: 33 214 треугольников / бюджет 250 000. FPS на реальном GPU не мерян.

## Следующие шаги
1. Ревью `tz-09` → пуш/PR (делает ревьюер).
2. ТЗ-05: агент + `/r/:id`, подключить `<InspectionMap>` (ТЗ-06) и `<JourneyScene compact currentStage reportSummary>` (ТЗ-08/09), роут `/cars` (кнопка hero уже ведёт туда).
3. На Preview: полный скролл `/lab/journey` (~50–60 с) для видео, замер FPS на телефоне.

## Передача в новую сессию
Читать `CONTEXT.md` + этот файл + новое ТЗ из `docs/tz/`. Ветка: `tz-09` (3 коммита + финальный с отчётом). Локальный сервер в песочнице не слушает порты — нужен `--sandbox-network enabled` или эскалация; скриншоты: `CHROMIUM_PATH=~/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/journey/capture.mjs http://localhost:3100`.
