# Codex Usage Promo

A 42-second, 1920×1080, 30 fps Codex product film built around a 120 BPM edit grid.

## Creative direction

- Product-led rather than abstract AI imagery.
- Reconstructed Codex interface and documented workflows instead of fake people or generic stock.
- Hard cuts and information-driven pacing instead of transition spam.
- Precise UI framing, cursor choreography, parallel-agent panels, diffs, tests, browser verification, background computer use, PR review, and a concise end card.
- Major editorial beats land on the 120 BPM grid. At 30 fps, one beat is 15 frames.
- Original procedural score and UI sound design so the artifact has no third-party music dependency.

## Narrative

1. Hook
2. Select the repo and send a clear message
3. Show multiple Codex agents working in parallel
4. Inspect the diff and passing tests
5. Verify the result in the in-app browser
6. Show background computer use and iterative visual feedback
7. Review the PR and checks
8. Rapid workflow montage
9. `From prompt. To shipped code.`

## Render

```bash
npm install
node --experimental-strip-types examples/codex-promo/render-assets.ts
node --experimental-strip-types apps/cli/src/index.ts validate --project examples/codex-promo/project.flick.json
node --experimental-strip-types apps/cli/src/index.ts render \
  --project examples/codex-promo/project.flick.json \
  --out examples/codex-promo/out/Codex_Usage_Promo_42s.mp4
node --experimental-strip-types apps/cli/src/index.ts qc \
  examples/codex-promo/out/Codex_Usage_Promo_42s.mp4 \
  --project examples/codex-promo/project.flick.json
```

The GitHub Actions workflow `.github/workflows/render-codex-promo.yml` runs the same path and uploads the MP4, project file, QC report, and render manifest as a build artifact.
