# @agent:   muse-code
# @project: hanbridge-inspector
# @purpose: Report for TZ-10b (garage v2: new car model + live environment)
# @created: 2026-10-29

# Отчёт ТЗ-10b — Гараж v2

Ветка `tz-10`, коммит `cb5bf60` (+ коммит с этим отчётом). Не пушилось.

## Что сделано

- **Модель v2.** Сцена грузит обе модели из `public/models/`: герой `car-v2.glb` (PBR, свои текстуры, `envMapIntensity 1.25`) для битов 0, 1 и конца бита 5; `car-v2-parts.glb` (22 детали) для битов 2–4. Обе нормализуются одной формулой (длина по X → 4.4 м, колёса на полу, центр по X/Z), но каждая — по своему bbox: у GLB свои node-scale (герой 1.90, детали 0.37/0.08…), поэтому единый transform героя детали ужимал в ~3 раза (поймано на скриншотах, исправлено).
- **Кроссфейд.** `heroWeight(progress)` в `parts.ts`: герой в битах 0–1, фейд в детали за первые 12% бита 2, детали в битах 3–4, обратный фейд в героя на local 0.62–0.85 бита 5 (после сборки). Цвет краски деталей = средний цвет базовой текстуры героя: отрисовка в canvas 16×16, усреднение без очень тёмных/светлых пикселей (`samplePaint` в `GarageScene.tsx`), фолбэк — проп `paint`.
- **Карта деталей v2.** `PartDef.panel` → `panels: PanelId[]` по таблице ТЗ (22/22 деталей). Общие детали: `tripo_part_15` = оба передних крыла, `tripo_part_3` = оба задних крыла + багажник, `21` с бампером, `14` с задней частью, `19/20` с задним бампером, `18/10` с передними дверями, колёса `4/5/1/2`, днище `6/8` вниз 0.3 м. Метки общих деталей — раздельные: `panelLabelOffset` (левая — у левого края детали, правая — у правого, багажник — у заднего торца). Все 13 panel id покрыты.
- **Окружение (Muse Image, один прогон `scripts/garage/generate-assets.mjs`).** `env-garage.jpg` → `scene.environment` через PMREM (`EquirectangularReflectionMapping`) + приглушённая сфера r=42 на дальний фон. `floor-epoxy.jpg` (repeat 6×4, roughness 0.62) поверх ослабленного Reflector (opacity 0.94, тёмный color). `wall-panel.jpg` на 3 стены. Промпты, модель, дата, время и размеры — в `public/garage/prompts.json`.
- **Геометрия кодом.** Потолок: балки + 6 линейных светильников в корпусах; задняя стена: 5 шкафов с ящиками и ручками, стойка из 4 шин, верстак, компрессор (красный бак), стойка OBD с экраном-графиком без цифр (canvas); светящаяся полоса и 3 значка без текста (стрелка/галочка/ключ, canvas); жёлтая разметка зоны подъёмника, решётка водостока, contact shadow (радиальный градиент); подъёмник: жёлтые торцы, резиновые накладки, гидроцилиндр вдоль платформы. Конусы дымки убраны до opacity 0.0035. Над потолком LED/конусы скрываются (как раньше).
- **Камера.** Радиусы битов 0/1/5 уменьшены (6.6/6.1/6.3 м): машина ~40–55% ширины кадра, ракурсы 3/4 и низкие сохранены. 404 в консоли capture — те же, что в ТЗ-10 (не модели: `data-parts=22`).

## Ассеты Muse Image (сырой вывод генерации)

```
$ node --check scripts/garage/generate-assets.mjs && node scripts/garage/generate-assets.mjs
env-garage.jpg saved in 28977ms bytes=188080 q=82
floor-epoxy.jpg saved in 25256ms bytes=161076 q=82
wall-panel.jpg saved in 18744ms bytes=83371 q=82
prompts.json saved
```

| Файл | Байт | Время |
|---|---|---|
| `env-garage.jpg` | 188 080 | 28 977 мс |
| `floor-epoxy.jpg` | 161 076 | 25 256 мс |
| `wall-panel.jpg` | 83 371 | 18 744 мс |

Все ≤ 1 МБ, JPEG q82.

## Сырой вывод проверок

```
$ npx tsc --noEmit
TSC:0

$ npm run lint
✖ 4 problems (0 errors, 4 warnings)   # те же старые предупреждения в ReportView.tsx, не garage

$ npx vitest run
 Test Files  10 passed (10)
      Tests  93 passed (93)            # было 90; garage: 15 тестов (карта v2, panels[], кроссфейд, раздельные метки/замеры)

$ node --check scripts/garage/generate-assets.mjs && node --check scripts/garage/capture.mjs
NODECHECK:ok

$ npm run build
 ✓ Compiled successfully in 2.2s
├ ƒ /lab/garage                          1.49 kB         104 kB

$ node scripts/garage/capture.mjs http://localhost:3100   (Mac, Chrome, GPU --use-angle=metal)
tz10b-beat0 triangles: 487598 parts: 22 fps: 60.0 eco: null
tz10b-beat1 … tz10b-beat5               fps: 60.0
tz10b-debug-parts                       fps: 60.0
tz10b-mobile-beat2 / -beat3 (390×844)   fps: 60.0
fallback cards: 6
page errors: 404 (как в ТЗ-10, не модели)
```

Треугольники: 487 598 = герой + детали суммарно (в кадре одновременно видна одна модель; кроссфейд — обе на стыке). FPS — `data-fps` сцены, headless Chrome на M-серии, как в ТЗ-10.

## Скриншоты (просмотрены)

`docs/reports/assets/tz10b-beat0..5.png`, `tz10b-debug-parts.png`, `tz10b-mobile-beat2.png`, `tz10b-mobile-beat3.png`, `tz10b-fallback.png`.

- Бит 0/1: герой без «волн» v1, в кузове и стёклах — блики LED и тёплого света, машина 40–55% кадра.
- Бит 2: детали разлетаются по карте v2, краска деталей совпадает с героем (светло-серый сэмпл текстуры).
- Бит 3 (сверху): все метки читаются; у переднего крыла две раздельные метки (75/75 мкм по бортам детали `15`), капот 332 мкм «шпатлёвка/ремонт · ✓ подтверждено». По задней части в отчёте MINI отдельные замеры задних крыльев/багажника в кадр не попали как отдельные подписи — метки ставятся только по фактическим `paintReadings` (выдуманных нет).
- Бит 5 (центр кадра): собранные детали; герой возвращается кроссфейдом к концу бита (local 0.62–0.85).
- Пол с текстурой и жёлтой разметкой, за боксом — панорама-сфера, не пустота.

## Файлы

```
src/components/garage-3d/parts.ts        (карта v2, panels[], heroWeight, panelLabelOffset, readingsByPart -> массивы)
src/components/garage-3d/GarageScene.tsx (герой+детали, кроссфейд, сэмпл краски, env PMREM/сфера, детали окружения, камера)
scripts/garage/generate-assets.mjs       (новый, Muse Image, один прогон)
scripts/garage/capture.mjs               (префикс tz10b)
public/garage/{env-garage,floor-epoxy,wall-panel}.jpg, prompts.json (новые)
tests/garage-parts.test.ts               (обновлены под v2 + новые кейсы)
docs/reports/assets/tz10b-*.png          (скриншоты)
```

Старые `hero-car*.glb` не удалены и в сцене не используются.

## Что не получилось / ограничения

- Детали v2 без текстур: на крупных планах бита 2 видна фактура генерации Tripo (краска плоская, сэмплированная с героя). Это свойство исходной модели, не сцены.
- Гидроцилиндр подъёмника: первая версия рендерилась торчащей диагональной «трубой» перед машиной — заменён на короткий цилиндр вдоль платформы.
- Задняя часть (`tripo_part_3`): раздельные метки крыльев/багажника работают, но в демо-отчёте MINI нет отдельных замеров на все три панели, поэтому на скриншоте бита 3 по ней видна одна подпись.
