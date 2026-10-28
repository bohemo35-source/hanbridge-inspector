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
- `sam-3.1` — POST /responses, body `{model:"sam-3.1", input:[{role:"user", content:[{type:"input_text",text:"<concept>"},{type:"input_image",image_url:"data:image/jpeg;base64,…"}]}]}`, ~2–3 с. Ответ в `output[0].content[0].text` (проверено 27.10 на фото MINI): префикс `<0f>0`, затем по каждому экземпляру `<|box;x1=991;y1=193;x2=1025;y2=201;w=1280;h=720|><|mask;x=0;y=0;data=H,W,<encoded>|>` — пары key=value, координаты в пикселях отправленного изображения (w,h = его размер); `data` начинается с высоты и ширины маски (= размер бокса), дальше закодированные пиксели относительно бокса. Алгоритм декодирования: https://dev.meta.ai/docs/sam/reading-segmentation. Пустой ответ = 0 экземпляров. SAM хорошо находит предметы (`car`, `license plate`, `wheel`, панели), а `scratch`/`dent` на тестовом фото дали 0 — дефекты ищет Spark по вырезкам, SAM даёт геометрию.
- `muse-voice-transcribe-1.0` — POST /asr/transcribe, multipart: `request` (JSON `{model, audioEncoding:"WAV", mode:"PUSH_TO_TALK"}`) + `audio` (WAV ≤ 10 мин). TTS у Meta нет.
- `muse-image-1.0` — POST /images/generations `{model, prompt, n}` → `data[0].b64_json` (~23 с); правки — /images/edits.
**Open-weight (Baseten, кредиты хакатона $100 + до 2M TPM):** `muse-spark-open-1026` (точное имя модели `meta-models/muse-spark-open-1026`, другие ключ не принимает), база `https://inference.baseten.co/v1`, OpenAI-совместимый `/chat/completions`, `Authorization: Bearer ${BASETEN_API_KEY}`. Модель всегда рассуждает (читать reasoning отдельно от content — docs.baseten.co/inference/model-apis/reasoning), поддерживает vision. Клиент — `src/lib/meta/sparkOpen.ts`, через тот же `metaFetch`-подобный обёрточный слой.
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
demo-data/<car>/    реальные осмотры (photos/, video/, sheets/, inspector_report_ru.txt, paint.json); не в git
docs/tz/            ТЗ
docs/reports/       отчёты Muse после каждого ТЗ
```

## Экономия лимита Muse (обязательно)
- Не запускай субагентов и «double check»/verify-проходы: проверку делает ревьюер (Claude).
- Не перечитывай большие файлы целиком без нужды; `package-lock.json`, `node_modules`, `.next`, `demo-data` не читать.
- `npm install` — один раз в начале. `next build` — один раз в конце. Между ними хватает `tsc --noEmit` и `vitest`.
- Живые запросы к Meta API — только в smoke-скриптах, по одному прогону.
- Не можешь починить за 2 попытки — запиши в отчёт и иди дальше.

## Definition of Done для любого ТЗ
1. `npx tsc --noEmit` — 0 ошибок. `npm run build` — успешно. `npm run lint` — 0 ошибок.
2. Для каждого изменённого .js/.mjs скрипта — `node --check <file>`.
3. Smoke-скрипт этого ТЗ прогнан живым запросом, вывод (без ключа) сохранён.
4. Отчёт `docs/reports/tz-0N.md`: что сделано, список файлов, СЫРОЙ вывод tsc/build/smoke/curl, что не работает. Не пересказ — вывод команд.
5. Не трогать файлы вне задачи. Если без этого никак — объяснить в отчёте.
6. Не публиковать, не пушить в main, не деплоить в прод без явного «делай» от Артура.
