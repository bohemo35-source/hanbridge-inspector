# PROJECT-STATUS — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: живой статус и точка продолжения · @created: 2026-10-28 -->

## Сделано
- ТЗ-01 (Spark-эксперт), ТЗ-02 (SAM+дефекты) — в `main`.
- ТЗ-06 (3D-карта кузова, `buildCar`) — влита; отчёт `docs/reports/tz-06.md`.
- ТЗ-08 (ветка `tz-08`, не запушена, ждёт ревью): сцена пути Корея→РФ/СНГ (7 этапов), 7 фонов Muse Image в `public/journey/` (1.1 МБ), `getShippingStatus`, hero на `/`, `/lab/journey`, 47/47 тестов, build зелёный. Отчёт `docs/reports/tz-08.md`.

## Состояние
`tsc` 0, `lint` 0, `vitest` 47 passed, `build` OK. Сцена: 33 646 треугольников / бюджет 250 000. FPS на реальном GPU не мерян.

## Следующие шаги
1. Ревью `tz-08` → пуш/PR (делает ревьюер).
2. ТЗ-05: агент + `/r/:id`, подключить `<InspectionMap>` (ТЗ-06) и `<JourneyScene compact currentStage>` (ТЗ-08), роут `/cars` (кнопка hero уже ведёт туда).
3. На Preview: полный скролл `/lab/journey` (~25 с) для видео, замер FPS на телефоне.

## Передача в новую сессию
Читать `CONTEXT.md` + этот файл + новое ТЗ из `docs/tz/`. Ветка: `tz-08` (3 коммита + финальный с отчётом). Локальный сервер в песочнице не слушает порты — нужен `--sandbox-network enabled` или эскалация; скриншоты: `CHROMIUM_PATH=~/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/journey/capture.mjs http://localhost:3100`.
