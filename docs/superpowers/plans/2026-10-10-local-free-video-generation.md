# Local-Free Video Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully local/free-first hybrid image-to-video pipeline that routes simple shots to deterministic FlickStack motion, complex shots to localhost open-source video workers, and rejects malformed product/brand generations before they enter projects.

**Architecture:** Extend the generation provider contract with typed video capabilities and request requirements, implement local image/video providers, add candidate scoring and product/brand fidelity QC, then add shot routing that chooses deterministic 2D, layered 2.5D, or local video synthesis. Heavy CV inference remains outside the TypeScript core behind local worker contracts; the core owns orchestration, thresholds, provenance, and acceptance.

**Tech Stack:** TypeScript, Node 22, node:test, existing FlickStack generation/generated-scenes/QC packages, local HTTP or command workers.

**Spec:** `docs/design/local-free-video-generation.md`

## Global Constraints

- Fully functional without paid APIs.
- Do not bundle model weights in the repository.
- Default local HTTP execution is localhost-only unless explicitly configured otherwise.
- Preserve deterministic native compositing for exact logos, legal text, typography, and layout.
- Do not claim local generation exceeds commercial systems without benchmark evidence.
- Existing `npm run typecheck`, `npm test`, integration tests, native tests, and smoke gates remain green.

## Review Focus

- A video request requiring a last frame must not route to a provider that only supports first-frame I2V.
- A local provider must reject non-localhost endpoints by default so a local profile cannot silently transmit assets remotely.
- Product fidelity gates must reject a candidate when any required invariant is below its blocking threshold, even if its aggregate/aesthetic score is high.
- A single-photo large-orbit request must route to local video synthesis or reject, never masquerade as exact deterministic parallax.
- Existing image generation providers and current tests must remain source-compatible.

---

### Task 1: Typed video capabilities and provider fitness routing
- [x] Add typed video generation capabilities and requirements.
- [x] Prefer free/local eligible providers while preserving explicit selection.
- [x] Enforce first/last/reference/duration/resolution/camera/mask/extension/audio capabilities.

### Task 2: Fully local image/video generation adapters
- [x] Add localhost local image-edit provider for anchor creation.
- [x] Add capability-discovering local video HTTP provider.
- [x] Add direct local command video provider with output sandboxing.
- [x] Keep HTTP workers localhost-only by default with explicit `allowRemote` opt-in.

### Task 3: Product identity package and perceptual QC
- [x] Add product identity package and locked invariant thresholds.
- [x] Add OCR/logo/silhouette/color/segmentation/temporal/flicker/camera/occupancy scoring.
- [x] Add local identity-builder/analyzer HTTP contract.

### Task 4: Anchor workflow and hybrid-local shot routing
- [x] Add sparse scene-aware/largest-gap anchor planning.
- [x] Build local image-edit anchor requests and typed first/last/reference I2V requests.
- [x] Route deterministic 2D, layered 2.5D, local video, and unsupported shots honestly.
- [x] Block exact hidden-surface geometry from insufficient references.

### Task 5: Candidate ranking and guarded acceptance
- [x] Add generation-specific QC.
- [x] Rank multiple candidates with product fidelity weighted most heavily.
- [x] Import only approved candidates through normal generation acceptance/provenance.
- [x] Reject the batch when no candidate passes.

### Task 6: Deterministic brand finishing
- [x] Plan protected region/logo/text restoration.
- [x] Compile exact brand graphics and copy into locked V3 layers.
- [x] Mark exact finish layers `generatedByModel: false`.

### Task 7: Hardware profiles and developer documentation
- [x] Add CPU/low-VRAM/standard-GPU/high-VRAM behavior and candidate caps.
- [x] Document HTTP and command worker protocols.
- [x] Document fully local product-ad workflow and model-license caveats.

### Task 8: Final verification and integration
- [x] TypeScript typecheck passed.
- [x] Full Node test suite passed.
- [x] Integration suite passed.
- [x] Clean-environment smoke gate passed.
- [x] Rust format, clippy, and tests passed.
- [x] OpenCV tracking verification passed.
- [x] macOS desktop package build and smoke passed.
- [x] Windows desktop package build and smoke passed.
- [x] Final branch comparison inspected before merge.
