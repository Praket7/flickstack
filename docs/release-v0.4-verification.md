# FlickSmith v0.4.0 Professional Motion Engine — Release Verification

Date: 2026-10-09  
Branch: `feature/flicksmith-v0.4-professional-motion-engine`

## Release claim

v0.4 converts the v0.3 professional-motion architecture from a predominantly descriptive model into a project-backed authoring and native rendering system. The acceptance target is premium software/product motion work with editable provenance, rather than a transition pack or flattened AI-generated scene pipeline.

## Passing evidence in the conversation runner

- Strict root TypeScript typecheck: **PASS**.
- Full Node/FFmpeg/editor/security/release suite after Task 19: **297/297 PASS**.
- Premium/native acceptance subset: **6/6 PASS**.
- `git diff --check`: **PASS** at the Task 19 gate.
- v0.4 premium acceptance fixture: **48 seconds at 30 fps, 1920×1080**, with one-source landscape and portrait layout variants.
- Generated visual provenance: **100% editable native FlickSmith layers/components** in the acceptance project; zero generated PNG, HTML screenshot, or pre-rendered visual-scene proxy assets.
- Motion QC fixture: zero blocking issues, mean occupancy gate ≥45%, active-pair gate ≥50%, three independent motion groups in non-end shots, and a 60-frame resolved end-card hold against the 45-frame minimum.
- Legacy v0.2/v0.3 TypeScript migrations, editing, audio, FFmpeg compatibility, security and recovery tests remain in the full suite.

## Native rendering status

### CPU reference — implemented

The deterministic native CPU reference renderer accepts render-core vector and shaped-text primitives, composites in scene-linear premultiplied RGBA, and supplies golden/parity truth for the native pipeline.

### Typography — implemented source

The native typography crate uses **Parley**, **HarfRust** and **Skrifa**-class text infrastructure rather than the old approximate `fontSize × 0.6` shaper. Layout preserves glyph IDs, cluster ranges, bidi state, font index, variation coordinates and the resolved font bytes required by render-core.

### GPU composition — implemented source

The v0.4 `wgpu` path performs real device work: it creates render textures and pipelines, records command buffers, performs ordered premultiplied-alpha layer composition, submits work to the GPU queue and reads back the actual framebuffer.

The current implementation is intentionally described as **hybrid primitive raster + GPU composition**. Vector and shaped-text primitives are raster-staged per layer by the deterministic CPU reference renderer before GPU composition. **Full GPU vector rasterization is not claimed as PASS.**

### FFmpeg boundary — implemented contract

For v3 native motion, FFmpeg is retained for media decode/encode/audio/mux responsibilities. It is not the semantic visual compositor for generated motion scenes. Legacy v2 projects retain the compatibility FFmpeg visual path.

## Professional authoring status

Studio source now includes project-backed Layer Tree, Inspector, Timeline/Dope Sheet, value/speed Curve Editor, independent-dimension Bezier timing, roving spatial keys, 2.5D viewer gizmos, direct mask/camera editing, compositing Node Graph, procedural controls and tracking controls. Edits route through revision-safe canonical v3 operations rather than a separate mock UI state.

## Procedural and tracking status

- Replicators support deterministic grid/radial/path distributions, index context, falloffs and time offsets.
- Particle generation is deterministic with hard instance budgets.
- Optional native **OpenCV** point and planar solver source is implemented with confidence/error diagnostics and stabilization derivation.
- Builds without OpenCV expose tracking as unavailable rather than fabricating solver output.

## Rust / native compile gate

This conversation runner does not contain Cargo, rustc or rustfmt, and outbound DNS is blocked. Therefore it cannot honestly provide local Rust compiler evidence.

A dedicated **GitHub Actions Rust verification** workflow is part of this release and is required to run:

- `cargo fmt --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo test -p flick-tracking-opencv --features opencv-backend` with system OpenCV
- macOS and Windows Tauri package builds and smoke tests

Until that GitHub Actions run is green, Rust/native compilation remains **pending**, not implied by the passing TypeScript source-contract tests.

## Hardware GPU performance/parity

**Hardware GPU verification is pending.** The local runner exposes no trustworthy native GPU/Rust execution path. No FPS, latency, CPU/GPU RMSE, or power-efficiency number is fabricated. GPU hardware claims require a verified adapter run; source-level implementation alone is not a benchmark.

The release tolerance target remains RGB RMSE ≤0.02 and alpha RMSE ≤0.005 for GPU-supported benchmark scenes with zero-frame timing error.

## Packaging

macOS and Windows packaging are release gates in GitHub Actions. Linux remains a development/CI target unless separately promoted. A platform is not described as package-verified until its native bundle build and smoke test are green.

## Capability boundaries

- Native OpenFX execution: **disabled** until an isolated trusted plugin host exists.
- Real OCIO/ACES pixel transforms: **not claimed** without a verified non-stub OCIO backend.
- Full GPU vector/glyph rasterization: **not claimed** in v0.4; current path is hybrid primitive raster + GPU composition.
- Blender-class mesh modeling/ray tracing/character animation: non-goal.
- Full AAF/FCPXML interchange, distributed rendering and multi-user collaboration: non-goals for v0.4.

## Release conclusion

The TypeScript/editor/QC/acceptance side of v0.4 is green in this runner. Final native release readiness depends on the GitHub Actions Rust/OpenCV/package gates described above. This document must be updated with the resulting workflow evidence before the branch is described as fully native-release verified.
