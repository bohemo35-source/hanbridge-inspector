# ТЗ-05 — Агент-оркестратор, verifier, отчёт /r/:id, прогон на реальном MINI

Перед стартом в `main` должны быть ТЗ-02..04 и PR #1 (ТЗ-06, 3D-карта; ТЗ-07 — если готово). Прочитай AGENTS.md и docs/reports/tz-01..06.md. Tool calling у Spark проверен: **YES** (нативные `tool_calls`), JSON-режим не нужен. Выполни задание целиком; проблемы фиксируй в отчёте.

## Цель
Агент на Muse Spark сам ведёт осмотр: решает, какие инструменты вызвать и в каком порядке, собирает находки с доказательствами, отдельным проходом проверяет каждую (verifiable agent), выносит вердикт или передаёт менеджеру. Клиент получает ссылку /r/:id с отчётом, картой, трассой агента и чатом.

## Инструменты агента
`segment_image`, `transcribe_note`, `read_auction_sheet`, `analyze_paint_readings`, `find_defects`, `read_gauge_video`, `make_listing_photo`, `get_shipping_status`, `estimate_landed_cost`, `handoff_to_manager`, `finalize_report`.
- `read_auction_sheet({mediaId})` — Spark vision по фото корейского аукционного листа → `{grade, mileageKm, year, repairMarks: [{panel, code, meaning_en, meaning_ru}], rawKoreanLines[]}`; каждая отметка → evidence `auction_sheet` с дословной строкой.
- `analyze_paint_readings` — из ТЗ-01 (детерминированно).
- `get_shipping_status` — мок с фикстурой `src/lib/agent/fixtures/shipping.json`, явно помечен `source: "demo_fixture"`.
- `estimate_landed_cost` — ВСЕГДА `{status:"manager_quote_required"}` (никаких цифр растаможки в демо).
- `handoff_to_manager({reason})` — ставит `verdict.handoff = true`, причина в отчёт.

## Что сделать
1. `src/lib/agent/orchestrator.ts`:
   - Цикл `sparkChat(tools)` → выполнить tool_calls (независимые — параллельно) → вернуть результаты как `role:"tool"` → до `finalize_report` или 16 шагов. Агент сам решает порядок; доступные медиа машины передаются в первом сообщении (какие есть: фото, видео, голос, листы, отчёт инспектора).
   - Каждый шаг → `AgentStep {i, tool, argsSummary, why, ms, ok, outputSummary}` в `trace`. В system-промпте: «каждое утверждение — только с evidence; нет evidence — нет находки».
2. `src/lib/agent/verifier.ts` — отдельный проход по каждой находке: Spark получает ТОЛЬКО находку + её evidence (вырезанный по боксу кадр с маской, цитату, замер, строку листа) и отвечает `{supported: boolean, confidence, note}`. Не подтверждено → `verified:false`, находка уходит в раздел «Unconfirmed» и не влияет на вердикт. Противоречие источников (толщиномер ≤150, а голос «перекрас») → пометка `conflict`.
3. Вердикт: детерминированные правила поверх подтверждённых находок (critical → WALK_AWAY; high или ≥3 medium → NEGOTIATE; иначе BUY) + текстовое обоснование от Spark. Правила handoff из AGENTS.md.
4. Стриминг прогресса: `POST /api/inspections/:id/run` → SSE-события шагов; UI `/inspect/:id` показывает трассу «вживую» (иконка инструмента, why, время). Это ключевой кадр видео.
5. Отчёт `/r/:id` (публичный, без логина, `noindex`): шапка авто + вердикт крупно; **3D-карта** `<InspectionMap report={report} lang={lang} mediaUrl={(id) => url} />` из ТЗ-06 (`mediaUrl` → URL оригинального кадра в Blob; `report.vehicle.bodyType/doors` выставлять через `guessBodyType(make, model)`); список подтверждённых находок — у каждой миниатюра кадра с маской / цитата с таймкодом (клик → проигрывание аудио с tStart) / замер / строка листа, confidence; раздел Unconfirmed; listing-фото; блок «Agent trace»; чат с экспертом (ТЗ-01) по этому отчёту. Переключатель EN/RU. OG-картинка для шеринга.
6. Хранение: отчёт JSON в Blob по `reports/{id}.json`, id — nanoid(10).
7. Flow `/inspect/new`: данные авто → загрузка медиа (ТЗ-02/03) → ввод замеров толщиномера (13 полей по панелям) → «Run agent».
8. Каталог: `scripts/e2e/run-cars.mjs [carId…]` — полный прогон агента по каждой машине из `demo-data/<carId>/` (MINI + до 4 машин), загрузка оригиналов в Blob, отчёт в Blob; печатает trace, находки (всего/подтверждено/отклонено), вердикт, URL отчёта, время. Страница `/cars` — список отчётов (фото, марка/модель, вердикт, ссылка на `/r/:id`).
9. README: обновить «Built during the hackathon» ссылками на PR/коммиты ТЗ-01..05, схема архитектуры (mermaid), какие Meta-модели где используются.

## Критерии готовности
- tsc / build / lint / vitest зелёные; сырой вывод в docs/reports/tz-05.md.
- `node --check scripts/e2e/run-cars.mjs`; прогон по всем машинам из demo-data, полный вывод в отчёте; `/cars` показывает все отчёты.
- У MINI находки минимум из фото (SAM+Spark) и толщиномера (видео `paint_gauge.mp4`); голос и аукционный лист — только если есть у машины, иначе агент пишет в trace «источник отсутствует».
- Тест verifier: подсунуть находку с чужим кадром → `verified:false`.
- Тест handoff: уверенность 0.5 → `handoff:true`.
- `/r/:id` открывается в инкогнито на Vercel Preview; скриншоты десктоп + мобильный в `docs/reports/assets/`.
- Время полного прогона ≤ 90 с (если больше — где узкое место, по trace).
