# Changelog

## [0.5.0-dev] - 2026-10-09

### v0.5b — Generative Provider Runtime & Provenance

- Added provider-neutral generation contracts and deterministic capability routing without silent provider fallback.
- Added durable generation jobs backed by the existing scheduler, with idempotent submission, cancellation, staged output, explicit discard, budget limits, commercial-rights requirements, and sanitized provider errors.
- Added content-addressed generated assets with explicit acceptance into canonical v3 project state, immutable generation provenance, and SHA-256 deduplication.
- Added v3 generation records and layered generated-scene records with duplicate/reference/finite-value/credential validation.
- Added MCP lifecycle tools for provider discovery, generation submission/status/cancellation, explicit acceptance, staged discard, and provenance-record removal. Staging operations do not mutate the canonical project revision.
- Added an OpenAI Responses image-generation adapter with environment-sourced credentials, image/edit requests, optional reference-image resolution, transparent-output parameters, streamed partial-image handling, response metadata, cancellation, and no persisted API keys.
- Added self-review regression gates for registry lookup, provider capability metadata, unit/cost budgets, commercial-rights policy, reference inputs, provider metadata, and streaming behavior.

### Verification boundary

- Provider tests use deterministic fixtures and mocked HTTP. CI never requires or spends a live model API credential.
- Generated output is not part of canonical project state until an explicit revision-safe acceptance operation succeeds.
- Rights metadata is recorded rather than inferred. Workflows that require confirmed commercial rights fail when a provider does not explicitly provide them.
- Model/provider availability is capability-gated and never silently substituted.

## [0.4.0] - 2026-10-09

### Added

- Versioned native render program/runtime path and semantic scene bridge from evaluated v3 motion layers into render-core vector, shaped-text, procedural and particle primitives.
- Parley/HarfRust/Skrifa-backed native typography with retained resolved-font bytes and glyph/cluster provenance for render-core.
- Deterministic scene-linear premultiplied CPU reference rendering and real `wgpu` device composition/readback.
- Project-backed Studio Layer Tree, Inspector, Timeline/Dope Sheet, value/speed Curve Editor, spatial paths, 2.5D canvas gizmos, mask/camera authoring, and compositing Node Graph.
- Procedural replicators, index context, falloffs and particles with deterministic hard budgets.
- Optional native OpenCV point/planar tracking solver with confidence/error diagnostics and explicit unavailable capability when the backend is not linked.
- Temporal Motion QC for static ratio, motion density, cut-only energy, dead space, occupancy, readability, safe spacing, single-plane motion, focal competition and end-card hold.
- A 48-second brand-neutral premium acceptance project made entirely from editable native FlickSmith visual layers, including landscape and portrait variants.
- Dedicated v0.4 native verification CI for Rust formatting/clippy/tests, optional OpenCV, and macOS/Windows Tauri package smoke.

### Changed

- Base release identity is now v0.4.0.
- v3 final rendering routes through the native render contract; FFmpeg remains responsible for media decode/encode/mux rather than visual composition.
- GPU rendering no longer returns a full-scene CPU frame while claiming a device path. v0.4 performs actual device composition of per-layer primitive rasters.
- Studio workspaces are backed by canonical project edits instead of the original hard-coded demonstration panels.

### Verification boundary

- The conversation runner verifies the TypeScript/editor/QC/acceptance suite and source contracts, but has no local Rust toolchain. Rust/OpenCV/native-package compilation is therefore a GitHub Actions release gate.
- GPU composition is real device work; vector/text rasterization is still hybrid CPU-reference staging in v0.4 and is not described as full GPU vector rasterization.
- Hardware GPU performance is reported only from a runner with a verified adapter.

## [0.3.0] - 2026-10-08

### Added

- Project schema v3 and deterministic v2→v3 migration for structured motion compositions, reusable components, rigs, tracking records, audio analyses, responsive tokens, and motion styles.
- Generic animated properties with professional curve types, velocity sampling, motion-style presets, deterministic behaviors, a bounded expression language, and published rig controls.
- Unicode-aware typography/layout foundations, selectors/text animators, vector geometry, masks/mattes, 2.5D camera projection, motion-blur sampling, shared-element transitions, compositing DAGs, and tracking adapters.
- Audio beat/downbeat/envelope signals and semantic sound-cue materialization for audio-driven animation.
- Professional editable motion-component library spanning typography, product UI, data, annotation, and brand scenes.
- RenderGraph v3 motion nodes and range-aware invalidation/QC routing.
- Design QC with structural typography, layout, readability, collision, continuity, camera, safe-area, and blank-output checks with exact repair ranges.
- Agent Director artifacts for creative briefs, motion grammar, storyboards, shots, sound plans, and scene receipts.
- Studio Edit/Motion/Graph/Audio/Director workspace state and v3 typed motion controllers with conflict-safe revision handling.
- OTIO v3 motion metadata plus safe structured SVG/Lottie import foundations and explicit color/OpenFX capability declarations.
- Synthetic premium motion acceptance, parity, release, and security suites plus a measured scene-graph benchmark harness.

### Changed

- Base release identity is now v0.3.0.
- Motion is compiled into the canonical RenderGraph instead of being treated as a baked side channel.
- Professional authoring and agent workflows share the same v3 typed/reversible operation layer and checkpoint semantics.

### Verified in this release runner

- Deterministic v1→v2→v3 migration and v3 schema validation.
- Motion-property curves, responsive layout, Unicode selectors, vectors, expressions, behaviors, rigs, scene evaluation, audio signals, transition/camera/tracking foundations, RenderGraph v3, Design QC, Director artifacts, Studio operations, and structured interchange safety.
- Synthetic premium motion acceptance and RenderGraph timing/invalidation parity.
- Existing v0.2 editing, FFmpeg, audio, multicam, perception, recovery, desktop-source, MCP, security, runtime-dependency, and integration regression suites.
- CPU scene-graph evaluation benchmark with environment metadata in `benchmarks/motion-v03/current.json`.

### Capability-gated / environment-blocked

- Real WebGPU hardware preview FPS remains blocked in this runner; the benchmark records `null` instead of fabricating performance.
- Native Rust/Tauri package compilation remains blocked because Cargo/Rust is unavailable in this runner.
- Native OpenFX execution is disabled until a process-isolated trusted plugin host exists.
- OCIO/ACES is declarative metadata/intent only; native color transforms are not claimed.
- Full object/surface/3D-camera tracking, broad third-party plugin parity, and full 3D scene rendering are not claimed by v0.3.

## [0.2.0] - 2026-10-08

### Added

- Project schema v2 with deterministic v1 migration and embedded-audio preservation.
- Canonical renderer-neutral RenderGraph, nested-composition validation, range invalidation, and renderer capability diagnostics.
- Professional FFmpeg reference rendering for overlapping layers, nested compositions, transforms, opacity, rectangle masks, cross-dissolves, non-normal blend modes, typed color effects, within-clip speed ramps, audio buses/processors, and sidechain ducking.
- GPU preview architecture with scheduling, LRU caches, adaptive quality, device-loss recovery, professional CPU-preview parity, WebGPU/WGSL source, native `wgpu` bridge source, and renderer-equivalence metrics.
- Multicam audio sync, drift correction, reversible angle programs, and materialization.
- Local visual evidence store, deterministic local embedding baseline, Tesseract OCR adapter, active perception, spatial Semantic Locks, and spatial coverage debt.
- Durable SQLite jobs, crash recovery, atomic project saves, revision-safe desktop/UI edits, professional Studio controllers, canonical loopback MCP project sessions, and correctness-first professional audio preview.
- Tauri 2 desktop source, cross-platform package CI, native `--smoke` hook, package manifest, and package evidence reporting.
- Security controls for credential-shaped project fields, restricted subprocesses, local-root imports, and Wikimedia HTTPS host validation.

### Changed

- Base release identity is now v0.2.0.
- FFmpeg remains an external/system-provided compatibility renderer in the desktop distribution policy; licensing is detected from the actual binary instead of assumed.
- Agent, Studio, MCP, and desktop mutations converge on canonical project/revision/checkpoint semantics rather than separate UI state.

### Verified in the release runner

- TypeScript typecheck and the complete Node/FFmpeg test suite.
- v1→v2 render compatibility including embedded audio.
- Ten professional v0.2 end-to-end scenarios.
- FFmpeg/preview normal-alpha equivalence under declared tolerance.
- Real process-kill job/project recovery.
- Real local Tesseract OCR plus local embedding/provenance invalidation.
- MCP/security/runtime dependency audit and desktop frontend/package-manifest smoke evidence.

### Environment-blocked verification

- Real WebGPU hardware performance: the release runner cannot initialize a trustworthy WebGPU adapter, so performance metrics remain null/blocked rather than synthetic.
- Native Rust/Tauri compilation and installer launch: the release runner has no Cargo/Rust toolchain. CI/source/smoke contracts are present, but a locally built native artifact is not claimed from this environment.