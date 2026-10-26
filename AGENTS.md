# AGENTS.md — Hanbridge Inspector (Meta Global AI Developer Hackathon)

Ты — Muse Code. Этот файл читается перед КАЖДЫМ ТЗ из docs/tz/.

## Продукт
Hanbridge Inspector — ИИ-агент, который ведёт весь осмотр б/у авто в Корее для покупателя из СНГ/Центральной Азии:
медиа осмотра → находки с доказательствами → проверка находок → вердикт BUY / NEGOTIATE / WALK AWAY → ссылка на отчёт /r/:id + чат по отчёту (EN/RU).
Это НЕ «анализатор картинок» и НЕ «RAG»: ценность в оркестрации, проверяемости каждой находки и передаче менеджеру при низкой уверенности.

## Жёсткие правила хакатона
1. Весь код пишется с нуля в этом репо. Запрещено копировать код/ассеты из ~/Developer/Landing_Exportal_muse, Hanbridge_3D_lab и любых старых репо.
2. Репо публичный. Секреты только в env (`META_API_KEY`, `BLOB_READ_WRITE_TOKEN`, …). `.env*` в `.gitignore`. Ключи не логировать, не отдавать на клиент, не писать в отчёты.
3. Только ассеты с правами: свои фото Артура из demo-data/, сгенерированное Muse Image, собственный SVG.
4. Никаких выдуманных цифр по растаможке/стоимости. Нет данных → `status: "manager_quote_required"`.
5. Коммиты маленькие и осмысленные: `feat(sam): ...`, `fix(agent): ...`. Каждое ТЗ = ветка `tz-0N` → PR в main.

## Стек
Next.js 15 (App Router) + TypeScript strict + Tailwind, деплой Vercel. Хранилище: Vercel Blob (медиа + JSON отчётов). Валидация: zod. Обработка изображений: sharp.
Лимит тела запроса Vercel ≈ 4.5 МБ → фото/видео/WAV грузить напрямую с клиента в Blob (`@vercel/blob/client` upload), на сервер передавать URL.
Роуты с вызовами Meta: `export const runtime = "nodejs"; export const maxDuration = 60;`

## Meta Model API (проверено 21–23.10)
База `https://api.meta.ai/v1`, `Authorization: Bearer ${META_API_KEY}`.
- `muse-spark-1.3` — POST /chat/completions. ВСЕГДА `reasoning_effort: "low"`, `max_tokens >= 1500` (при меньших приходит `content: null`). Пустой content = ошибка → retry 1 раз → фолбэк.
- `sam-3.1` — POST /responses, `input_text` + `input_image` (data URL работает). Ответ — спец-токены в `output[0].content[0].text`: `<|box;x1;y1;x2;y2;w;h|>` и `<|mask;x;y;data=W,H,…|>`. Формат маски: https://dev.meta.ai/docs/sam/reading-segmentation
- `muse-voice-transcribe-1.0` — POST /asr/transcribe, multipart: `request` (JSON `{model, audioEncoding:"WAV", mode:"PUSH_TO_TALK"}`) + `audio` (WAV ≤ 10 мин). TTS у Meta нет.
- `muse-image-1.0` — POST /images/generations `{model, prompt, n}` → `data[0].b64_json` (~23 с); правки — /images/edits.
Все вызовы — только через `src/lib/meta/*` (единый клиент: таймаут, 1 retry, лог длительности и model id без тела и ключа).

## Доменные правила
- Толщиномер (мкм): ≤150 заводская краска; 151–220 перекрас; >220 шпатлёвка/ремонт.
- Каждая находка (`Finding`) обязана иметь хотя бы одно доказательство (`Evidence`): кадр + box/маска, цитата из голосовой заметки с таймкодом, замер толщиномера или строка аукционного листа. Находка без evidence в отчёт не попадает.
- `confidence` 0..1. Итоговая уверенность < 0.6 или критическая находка с confidence < 0.7 → `handoff_to_manager`.

## Структура (целевая)
```
src/app/            страницы и route handlers
src/lib/meta/       клиенты Meta API (spark.ts, sam.ts, asr.ts, image.ts, client.ts)
src/lib/agent/      оркестратор, инструменты, verifier
src/lib/schema/     zod-схемы (Inspection, Finding, Evidence, Report)
src/lib/store/      Blob-хранилище
scripts/smoke/      живые smoke-скрипты на каждую модель
demo-data/          реальные фото/видео/замеры MINI (кладёт Артур)
docs/tz/            ТЗ
docs/reports/       отчёты Muse после каждого ТЗ
```

## Definition of Done для любого ТЗ
1. `npx tsc --noEmit` — 0 ошибок. `npm run build` — успешно. `npm run lint` — 0 ошибок.
2. Для каждого изменённого .js/.mjs скрипта — `node --check <file>`.
3. Smoke-скрипт этого ТЗ прогнан живым запросом, вывод (без ключа) сохранён.
4. Отчёт `docs/reports/tz-0N.md`: что сделано, список файлов, СЫРОЙ вывод tsc/build/smoke/curl, что не работает. Не пересказ — вывод команд.
5. Не трогать файлы вне задачи. Если без этого никак — объяснить в отчёте.
6. Не публиковать, не пушить в main, не деплоить в прод без явного «делай» от Артура.
