# ТЗ-01 — Каркас, Meta-клиент, схема отчёта, эксперт на Muse Spark

Сначала прочитай AGENTS.md. Выполни задание целиком, без промежуточных вопросов; если что-то не работает — зафиксируй в отчёте и иди дальше.

## Цель
Рабочий каркас продукта: Next.js-приложение, единый клиент Meta API, zod-схемы осмотра/отчёта, эксперт на `muse-spark-1.3` (структурированный разбор + чат по отчёту), проверка поддержки tool calling. Деплой в Vercel Preview.

## Что сделать
1. Инициализировать Next.js 15 + TS strict + Tailwind + ESLint. `.gitignore` с `.env*`, `.env.example` с пустыми `META_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`.
2. `src/lib/meta/client.ts` — `metaFetch(path, init, {timeoutMs, retries:1})`: Bearer из env, AbortController, лог `{model, path, ms, status}` без тела. Ошибки — типизированный `MetaApiError`.
3. `src/lib/meta/spark.ts`:
   - `sparkChat({messages, tools?, json?})` — всегда `reasoning_effort:"low"`, `max_tokens: 2000`; пустой/`null` content при отсутствии tool_calls → retry 1 раз → `MetaApiError("empty_content")`.
   - `sparkJson<T>(schema: ZodType<T>, messages)` — просит строго JSON, парсит (вырезает ```json```), валидирует zod, при невалидном — 1 повтор с текстом ошибки валидации.
   - Поддержка картинок в messages (content-части `image_url` с data URL / https).
4. `src/lib/schema/` — zod: `Media {id, kind: photo|video_frame|audio|auction_sheet, url, takenAt?}`, `Evidence {type: frame|mask|transcript|gauge|auction_sheet, mediaId, box?, maskRef?, quote?, tStart?, tEnd?, gaugeMicrons?, panel?}`, `Finding {id, panel, kind: scratch|dent|rust|repaint|putty|panel_replaced|mechanical|other, severity: low|medium|high|critical, description_en, description_ru, confidence, evidence: Evidence[] (min 1), verified: boolean, verifierNote?}`, `Verdict {decision: BUY|NEGOTIATE|WALK_AWAY, reasons_en[], reasons_ru[], confidence, handoff: boolean}`, `Report {id, vehicle {make, model, year?, mileageKm?, vin?}, findings[], verdict, paintReadings[], costEstimate {status: ok|manager_quote_required, ...}, trace: AgentStep[], createdAt}`.
5. `src/lib/domain/paint.ts` — детерминированная классификация толщиномера (≤150 / 151–220 / >220) → Finding с evidence типа `gauge`. Юнит-тесты (vitest) на границы 150/151/220/221.
6. Эксперт: `POST /api/expert/analyze` — вход: vehicle + paintReadings + до 6 URL фото → `sparkJson(FindingsDraft)`; `POST /api/expert/chat` — вход: reportId + история, отвечает только по данным отчёта, язык = язык вопроса (EN/RU), на вопросы о цене растаможки отвечает «менеджер посчитает» без цифр.
7. `scripts/smoke/spark.mjs` — 3 живых запроса: (a) текст, (b) JSON по схеме, (c) **tool calling**: передать `tools:[{type:"function", function:{name:"get_paint_status", parameters:{...}}}]` и проверить, вернулись ли `tool_calls`. Результат (поддерживается/нет) записать в отчёт — от него зависит ТЗ-05.
8. Минимальная главная `/` — заголовок, одна фраза о продукте, кнопка «New inspection» (пока заглушка). Тёмная тема, без мокапов из старого проекта.
9. `README.md`: что это, стек, Meta-модели, раздел `## Built during the hackathon` (пустой список коммитов, будет заполняться), `## Pre-hackathon` — «ничего, весь код в этом репо написан после 26.10.2026».

## Критерии готовности
- tsc / build / lint / vitest — зелёные, сырой вывод в docs/reports/tz-01.md.
- `node --check scripts/smoke/spark.mjs` ок; smoke прогнан, вывод (3 кейса) в отчёте, явно: «tool calling: YES/NO» + сырой фрагмент ответа.
- `curl -X POST localhost:3000/api/expert/analyze` с демо-замерами MINI возвращает валидный по zod JSON (вывод в отчёте).
- `curl /api/expert/chat` на RU-вопрос «сколько будет растаможка?» → ответ без цифр.
- `git grep -n "META_API_KEY="` находит только `.env.example` (пустое значение).
- Vercel Preview URL в отчёте (prod — только после «делай»).
