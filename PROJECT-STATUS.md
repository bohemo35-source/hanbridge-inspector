# PROJECT-STATUS — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: живой статус и точка продолжения · @created: 2026-10-28 -->

## Сделано
- ТЗ-01 (Spark-эксперт), ТЗ-02 (SAM+дефекты) — в `main`.
- ТЗ-06 (3D-карта кузова, `buildCar`) — влита; отчёт `docs/reports/tz-06.md`.
- ТЗ-08 — в `main`: сцена пути (7 этапов), фоны Muse Image в `public/journey/`, `getShippingStatus`, hero на `/`, `/lab/journey`. Отчёт `docs/reports/tz-08.md`.
- ТЗ-09 (ветка `tz-09`, не запушена, ждёт ревью): 2.5D фото-плейты на весь вьюпорт + туман по низу фото, передний план только активного этапа, rim/контактная тень/bloom, 3 бита на этап (`beatAt`), `stageContent.ts` RU/EN со сроками компании, proof-миниатюры MINI с замозаиченными номерами (`public/journey/proof/`), 1400vh скролл. Отчёт `docs/reports/tz-09.md`.

## Состояние
`tsc` 0, `lint` 0, `vitest` 73 passed, `build` OK (после ТЗ-04). Сцена: 33 214 треугольников / бюджет 250 000. FPS на реальном GPU не мерян. `BLOB_READ_WRITE_TOKEN` в `.env.local` пустой — Blob-ветки работают только на Vercel.

- ТЗ-04 (ветка `tz-04`, не запушена, ждёт ревью): `makeListingPhoto` — номер из `segmentImage` (blur σ30 + плашка HANBRIDGE +8%), Muse Image фон с diff-гардом маски авто (порог 10), hero на отчёт (Blob/локальный кэш), `/lab/image`. На демо фон edits отброшен (diff 24.10 / 20.97 > 10 — API маску не принимает, без маски перерисовывает авто) → честный фолбэк. Отчёт `docs/reports/tz-04.md`.

## Следующие шаги
1. Ревью `tz-09` и `tz-04` → пуш/PR (делает ревьюер).
2. ТЗ-05: агент + `/r/:id`, подключить `<InspectionMap>` (ТЗ-06) и `<JourneyScene compact currentStage reportSummary>` (ТЗ-08/09), роут `/cars` (кнопка hero уже ведёт туда), `makeListingPhoto` + `getOrCreateHeroImage` в сборку отчёта (listing — не evidence).
3. На Preview: полный скролл `/lab/journey` (~50–60 с) для видео, замер FPS на телефоне.

## Передача в новую сессию
Читать `CONTEXT.md` + этот файл + новое ТЗ из `docs/tz/`. Ветка: `tz-09` (3 коммита + финальный с отчётом). Локальный сервер в песочнице не слушает порты — нужен `--sandbox-network enabled` или эскалация; скриншоты: `CHROMIUM_PATH=~/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/journey/capture.mjs http://localhost:3100`.
