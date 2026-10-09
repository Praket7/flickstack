# v0.5c Generated Scene Acceptance

This acceptance scenario gates FlickSmith's editable generated-scene path.

The deterministic fixture starts with an accepted still and generated intermediate assets, then assembles them into ordinary v3 image layers plus a native camera. Depth evidence produces bounded Z placement and parallax. Motion remains editable through normal v3 keyframes and camera operations. The release gate does not require image-to-video generation.

The integration test at `tests/integration/generated-scene-acceptance.test.ts` verifies that the resulting project:

- contains native editable image layers and an active camera
- has independent motion on multiple layers and depth-derived Z separation
- preserves generation provenance for every generated scene asset
- contains no flattened generated-video dependency
- survives canonical v3 serialization and reload
- passes generated-scene QC without blocking findings

Hidden-region repair is separately gated by the generated-scene occlusion tests. Clean plates are submitted through the transactional generation runtime and are not attached until accepted assets exist. Generated-scene attachment also rejects dangling source, layer, depth, mask, and clean-plate asset references.

Native rendering remains capability-gated. The regular CI suite verifies the TypeScript/editor/MCP/generated-scene acceptance path, while the repository's `native-v04` workflow on `main` verifies the Rust/native render workspace and package smoke gates on supported runners.
