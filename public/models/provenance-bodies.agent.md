<!-- @agent: claude-code · @project: hanbridge-inspector · @created: 2026-11-02 -->
# Body templates (body-sedan/hatchback/compact/city.glb)
Built during the hackathon: concept frame by Meta Muse Image (`muse-image-1.0`, prompts in `scripts/bodies/concepts.mjs`) → Tripo API image-to-3D `v3.1-20260211` (paid API credits, textured PBR, seed 20261102) → `scripts/bodies/optimize.mjs` (simplify to ~77k triangles, WebP 1024, meshopt). Panels are found at runtime by geometry (`classifyTriangle` in `src/components/garage-studio/scene.ts`). SUV uses the Kia Sportage model (see ASSETS.md).
