# PROJECT-STATUS — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: живой статус и точка продолжения · @created: 2026-10-28 · @updated: 2026-10-30 claude-code -->

## Сделано
- ТЗ-01 (Spark-эксперт), ТЗ-02 (SAM+дефекты) — в `main`.
- ТЗ-06 (3D-карта кузова, `buildCar`) — влита; отчёт `docs/reports/tz-06.md`.
- ТЗ-08 — в `main`: сцена пути (7 этапов), фоны Muse Image в `public/journey/`, `getShippingStatus`, hero на `/`, `/lab/journey`. Отчёт `docs/reports/tz-08.md`.
- ТЗ-09 (ветка `tz-09`, не запушена, ждёт ревью): 2.5D фото-плейты на весь вьюпорт + туман по низу фото, передний план только активного этапа, rim/контактная тень/bloom, 3 бита на этап (`beatAt`), `stageContent.ts` RU/EN со сроками компании, proof-миниатюры MINI с замозаиченными номерами (`public/journey/proof/`), 1400vh скролл. Отчёт `docs/reports/tz-09.md`.

## Состояние
`tsc` 0, `lint` 0, `vitest` 73 passed, `build` OK (после ТЗ-04). Сцена: 33 214 треугольников / бюджет 250 000. FPS на реальном GPU не мерян. `BLOB_READ_WRITE_TOKEN` в `.env.local` пустой — Blob-ветки работают только на Vercel.

- ТЗ-04 (ветка `tz-04`, не запушена, ждёт ревью): `makeListingPhoto` — номер из `segmentImage` (blur σ30 + плашка HANBRIDGE +8%), Muse Image фон с diff-гардом маски авто (порог 10), hero на отчёт (Blob/локальный кэш), `/lab/image`. На демо фон edits отброшен (diff 24.10 / 20.97 > 10 — API маску не принимает, без маски перерисовывает авто) → честный фолбэк. Отчёт `docs/reports/tz-04.md`.

## ТЗ-05 (ветка `tz-05`, не запушена, ждёт ревью)
Агент-оркестратор (Spark tool calling ≤16 шагов), verifier на open-weight `muse-spark-open-1026` (Baseten, `src/lib/meta/sparkOpen.ts`), детерминированный вердикт + handoff, `/r/:id` (3D-карта + JourneyScene compact + чат + OG), `/cars`, `/inspect/:carId` SSE. Прогон по всем 5 машинам: MINI NEGOTIATE 0.86 (4/4 verified), BMW 530i BUY (OBD 29 систем, 0 ошибок), Audi BUY (3/3), Kia BUY (1/4, 3 в Unconfirmed), BMW X3 BUY conf 0.5 → handoff (0 находок). Отчёт `docs/reports/tz-05.md`, скриншоты `docs/reports/assets/tz05-*`.

## Следующие шаги
1. Ревью `tz-05` → пуш/PR (делает ревьюер); на Preview проверить `/r/:id` в инкогнито.
2. Известные дыры ТЗ-05: голос без замеров у X3/Audi/Kia (выбор видео), X3 «заменённая дверь» не стала находкой, прогон 73–151 с (gauge-video 72 с — главное узкое место).
3. На Preview: полный скролл `/lab/journey` (~50–60 с) для видео, замер FPS на телефоне.

## Передача в новую сессию
Читать `CONTEXT.md` + этот файл + новое ТЗ из `docs/tz/`. Ветка: `tz-09` (3 коммита + финальный с отчётом). Локальный сервер в песочнице не слушает порты — нужен `--sandbox-network enabled` или эскалация; скриншоты: `CHROMIUM_PATH=~/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/journey/capture.mjs http://localhost:3100`.

## ТЗ-11 (ветка `tz-11`, не запушена, ждёт ревью)
Journey v2 на `/`: цепочка коротких 3D-сцен (Сеул, Пусан, Владивосток, дорога сверху, вручение) + мосты Muse Image + `GarageScene` блоком (без изменений) + реальные отзывы из `public/reviews/manifest.json` (3 шт., положил ревьюер) + финал. HUD этапов, RU/EN, фолбэк-лента. Ассеты: `public/journey-v2/` (12 Muse Image, ≤1 МБ). Проверки: tsc 0, lint 0 err, vitest 99, build OK (в worktree — `.next` основной копии делит живой dev :3100, чужие процессы не трогать), скриншоты `docs/reports/assets/tz11-*`, FPS 60, страница 4150vh ≈ 2:05 скролла (цель 2:45 — высот из ТЗ не хватило). Отчёт `docs/reports/tz-11.md`.
Следующий шаг: ревью → решить, наращивать ли высоты блоков до 2:45 и чинить рампу порта; запись полного скролла Артуром.

## ТЗ-13 (ветка `tz-13`, не запушена, ждёт ревью) — визуальная доводка (Claude Code)
Плейты: исправлен растянутый кроп фона (16/9 vs реальные 3:2; mobile был растянут ×3) → `setViewOffset` + фокус на полосе; HDRI CC0 на машине; мокрое отражение (desktop), пятна/конусы фар, стопы, AO, дождь (Сеул), плёночный грейд. Гараж: autoshop HDRI, софтбокс + контровые, металлик деталей с тёмными изнанками, размытый Reflector. Дорога: 4 аэрофото Muse Image (15–19 с/кадр) + тёмная карта со светящимися маршрутами. Переходы: кроссфейд 18vh с затемнением; HUD по DOM. Проверки: tsc 0, lint 0 err (4 старых warn), vitest 104, build OK (в worktree), FPS 60 на всех блоках (Mac Chrome; mobile-вьюпорт 390×844). Отчёт `docs/reports/tz-13.md`, пары `docs/reports/assets/tz13-*`.
Не сделано: motion blur машины (бюджет треугольников), зеркало на mobile; rim в плейтах выключен (бликует в стекле).
Следующий шаг: ревью владельца по скриншотам → мерж `tz-13`; запись полного скролла; проверка на физическом телефоне (FPS, мобильный кроп всех 4 плейтов).
Передача: читать `CONTEXT.md` + этот файл + новое ТЗ. Dev-сервер :3100 (не мой) — `npm run build` только во временном `git worktree` с симлинком `node_modules`.
