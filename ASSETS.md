# Third-party assets

Everything else in this repository was created during the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026):
- code written with Muse Code (Muse Wonder) and Claude;
- images generated with Muse Image (`muse-image-1.0`; prompts in `public/**/prompts.json`);
- 3D car model generated with the Tripo API from a Muse Image frame (paid API credits; provenance in `public/models/provenance.json`);
- client reviews are the company's own published videos.

| Asset | Path | Author / source | License |
|---|---|---|---|
| HDRI "Shanghai Bund" | `public/hdri/shanghai_bund_1k.hdr` | Poly Haven — https://polyhaven.com/a/shanghai_bund | CC0 |
| HDRI "Golden Bay" | `public/hdri/golden_bay_1k.hdr` | Poly Haven — https://polyhaven.com/a/golden_bay | CC0 |
| HDRI "Düsseldorf Bridge" | `public/hdri/dusseldorf_bridge_1k.hdr` | Poly Haven — https://polyhaven.com/a/dusseldorf_bridge | CC0 |
| HDRI "Evening Road 01" | `public/hdri/evening_road_01_1k.hdr` | Poly Haven — https://polyhaven.com/a/evening_road_01 | CC0 |
| HDRI "Autoshop 01" | `public/hdri/autoshop_01_1k.hdr`, `autoshop_01_2k.hdr` | Poly Haven — https://polyhaven.com/a/autoshop_01 | CC0 |

Own generated images added in TZ-13 (not third-party, listed for traceability):

| Asset | Path | Author / source | License |
|---|---|---|---|
| Aerial plate "coast" | `public/journey-v2/aerial-coast.jpg` | Muse Image `muse-image-1.0` (Meta), prompt in `public/journey-v2/prompts.json`, script `scripts/journey-v2/generate-aerials.mjs` | generated for this project |
| Aerial plate "forest" | `public/journey-v2/aerial-forest.jpg` | same | generated for this project |
| Aerial plate "steppe" | `public/journey-v2/aerial-steppe.jpg` | same | generated for this project |
| Aerial plate "suburb" | `public/journey-v2/aerial-suburb.jpg` | same | generated for this project |

HDRI use (TZ-13): Shanghai Bund — Seoul plate; Golden Bay — port; Düsseldorf Bridge — Vladivostok and top-down road; Evening Road 01 — handover; Autoshop 01 — garage (2k desktop, 1k phones). Reflections/lighting only; visible backgrounds stay Muse Image.

Libraries are listed in `package.json` (three.js — MIT, Next.js — MIT, etc.).

## 3D-модель (A/B-тест)
- `public/models/kia-sportage.glb` — «Kia Sportage» by karaman.arman, CC-BY 4.0, https://sketchfab.com/3d-models/kia-sportage-98a84407998a4bc6b4dee912b289f15b. Изменения: поворот (перёд → +X), материалы краски/хрома/стёкол, удалены эмблемы, meshopt-сжатие. `kia-sportage-parts.glb` — та же модель, разрезанная по островам сетки на 22 детали для разборки (`scripts/kia/build-parts.mjs`).
