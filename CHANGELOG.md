# Changelog

## [0.5.0] - 2026-10-10

### v0.5f — Extensibility, collaboration, and performance

- Added a permissioned extension SDK for generation providers, media providers, effects, analyzers, exporters, and QC rules without generic shell or project-write authority.
- Added SDK conformance checks and a safe QC-rule example.
- Added checkpoint/revision-anchored review threads and approvals with fresh, ancestor, stale, and missing-anchor classification.
- Added semantic SHA-256 render cache keys covering project/render revisions, assets, renderer/backend, color, fonts, effects/plugins, quality, and output format.
- Added immutable version-matched render worker contracts and scheduling.
- Added measured-hardware benchmark contracts requiring at least three samples and matching hardware/project fingerprints before regression claims.
- Added portable ChatGPT/Work/Codex plugin, setup, smoke, and usage documentation.

### v0.5e — Professional finish and human craft

- Added explicit color/HDR intent, scope primitives, interchange/conform foundations, audio automation, and a process-isolated OpenFX host boundary.
- Added a research-backed Human-Craft quality system that rejects generic AI-ad defaults including template repetition, decorative motion, transition spam, pacing monotony, weak sound, generic branding, narrative flatness, audiovisual desynchronization, continuity failures, and synthetic-evidence overuse.
- Added localized craft repair plans and a typed `craft_review` action for creative plans.
- Added chat-facing `plan_human_craft_v3` and `review_human_craft_v3` MCP tools.

### v0.5d — Creative orchestration

- Added declarative `CreativeActionPlan` contracts and a resumable executor for evidence placement, generation, generated scenes, native motion, responsive variants, QC, craft review, and localized repair.
- Upgraded coverage planning so existing evidence suppresses unnecessary generation and coverage debt carries explicit generation eligibility/reasoning.
- Added responsive/campaign variant planning and localized repair mapping.

### v0.5c — Generated Scene Assets

- Added deterministic scene strategy routing that prefers editable direct-alpha and multilayer paths before segmentation/depth fallback.
- Added provider-neutral layered-image, segmentation, depth, clean-plate, occlusion, bounded-Z, camera-safety, native assembly, parallax, and generated-scene QC foundations.
- Added MCP/Studio generated-scene lifecycle surfaces and deterministic editable-scene acceptance coverage.

### v0.5b — Generative Provider Runtime and provenance

- Added provider-neutral generation contracts, durable cancellable jobs, staged output, explicit discard, budget/rights constraints, sanitized failures, and content-addressed acceptance.
- Added immutable generation provenance and revision-safe MCP lifecycle tools.
- Added an OpenAI Responses image-generation adapter using environment-sourced credentials and no persisted API keys.

### v0.5a — Unified v3 agent runtime

- Unified professional v3 motion authoring behind revision-safe typed MCP tools with atomic persistence, checkpoints, Intent Receipts, Semantic Locks, undo/redo, path validation, credential rejection, native rendering, and diagnostics.
- Preserved the verified v0.4 native/product base while exposing the v0.5 agent layer.

### Verification boundary

- Normal CI verifies TypeScript, Node/FFmpeg integration, MCP, generation fixtures, generated scenes, creative orchestration, professional finish contracts, collaboration/cache/SDK, human-craft review, and the clean-environment ChatGPT smoke gate.
- Provider tests use fixtures/mocked HTTP and never require a paid credential.
- Native Rust/OpenCV/GPU/package gates remain capability-specific workflows. Performance claims require measured matching hardware and are never fabricated.

## [0.4.0] - 2026-10-09

### Added

- Versioned native render program/runtime, semantic scene bridge, deterministic CPU reference pixels, real `wgpu` composition, professional typography, Studio authoring surfaces, procedural motion, tracking boundaries, Motion QC, and a native premium acceptance project.
- Dedicated native verification CI for Rust formatting/clippy/tests, optional OpenCV, and macOS/Windows packaging.

### Verification boundary

- GPU composition is real device work while v0.4 vector/text primitive rasterization remains a hybrid CPU-reference staging path.
- Hardware GPU performance is reported only from a runner with a verified adapter.

## [0.3.0] - 2026-10-08

### Added

- Project schema v3, professional motion graph, typography/vector/mask/camera/compositing foundations, tracking/audio signals, reusable motion components, Design QC, Director artifacts, Studio motion workspaces, structured interchange safety, and synthetic premium acceptance coverage.

### Capability boundary

- Native Rust/Tauri, hardware WebGPU, OpenFX execution, and non-stub OCIO processing remained capability-gated in v0.3.

## [0.2.0] - 2026-10-08

### Added

- Project schema v2, renderer-neutral RenderGraph, professional FFmpeg reference rendering, GPU-preview architecture, multicam, local evidence/search, durable jobs/recovery, Tauri desktop source, security controls, and professional audio foundations.
