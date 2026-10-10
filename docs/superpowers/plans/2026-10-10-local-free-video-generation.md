# Local-Free Video Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully local/free-first hybrid image-to-video pipeline that routes simple shots to deterministic FlickStack motion, complex shots to localhost open-source video workers, and rejects malformed product/brand generations before they enter projects.

**Architecture:** Extend the generation provider contract with typed video capabilities and request requirements, implement a localhost Wan-compatible HTTP provider, add candidate scoring and product/brand fidelity QC, then add shot routing that chooses deterministic 2D, layered 2.5D, or local video synthesis. Heavy CV inference remains outside the TypeScript core behind localhost contracts; the core owns orchestration, thresholds, provenance, and acceptance.

**Tech Stack:** TypeScript, Node 22, node:test, existing FlickStack generation/generated-scenes/QC packages, HTTP localhost workers.

**Spec:** `docs/design/local-free-video-generation.md`

## Global Constraints

- Fully functional without paid APIs.
- Do not bundle model weights in the repository.
- Default local provider execution is `local` and localhost-only unless explicitly configured otherwise.
- Preserve deterministic native compositing for exact logos, legal text, typography, and layout.
- Do not claim local generation exceeds commercial systems without benchmark evidence.
- Existing `npm run typecheck`, `npm test`, and smoke CI must remain green.

## Review Focus

- A video request requiring a last frame must not route to a provider that only supports first-frame I2V.
- A local provider must reject non-localhost endpoints by default so a "local" profile cannot silently transmit assets remotely.
- Product fidelity gates must reject a candidate when any required invariant is below its blocking threshold, even if its aggregate score is high.
- A single-photo large-orbit request must route to local video synthesis or reject, never masquerade as exact deterministic parallax.
- Existing image generation providers and current tests must remain source-compatible.

---

### Task 1: Typed video capabilities and provider fitness routing

**Files:**
- Modify: `packages/generation/src/types.ts`
- Modify: `packages/generation/src/registry.ts`
- Modify: `packages/generation/test/registry.test.ts`

**Interfaces:**
- Produces: `VideoProviderCapabilities`, `GenerationVideoRequirements`, expanded `ProviderCapabilityManifest`, and request-aware provider fitness selection.
- Consumes: existing `GenerationRequest`, `GenerationRequirements`, and `GenerationProvider` contracts.

- [ ] **Step 1: Write failing registry tests** for first/last-frame, references, duration/resolution, local execution, and choosing the best-fit video provider rather than alphabetical-first.
- [ ] **Step 2: Run CI and verify the new tests fail because typed video capabilities/routing do not exist.**
- [ ] **Step 3: Extend the capability types and implement deterministic fitness scoring.** Exact `request.provider` remains authoritative and never silently falls back.
- [ ] **Step 4: Run CI and verify typecheck + full tests pass.**
- [ ] **Step 5: Commit** `feat: add typed video provider routing`.

### Task 2: Local Wan-compatible HTTP video provider

**Files:**
- Create: `packages/generation/src/providers/local-video-http.ts`
- Modify: `packages/generation/src/index.ts`
- Create: `packages/generation/test/local-video-http.test.ts`

**Interfaces:**
- Consumes: `GenerationProvider`, typed video capabilities from Task 1, and `ResolvedGenerationInput`.
- Produces: `LocalVideoHttpProvider` with `manifest()`, `health()`, and `generate()`.

- [ ] **Step 1: Write failing tests** proving localhost-only-by-default behavior, capability discovery, first/last/reference serialization, cancellation propagation, MP4 staging, and sanitized errors.
- [ ] **Step 2: Run CI and verify failure because the provider is missing.**
- [ ] **Step 3: Implement `LocalVideoHttpProvider`.** Default endpoint `http://127.0.0.1:7861`; allow `localhost`, `127.0.0.1`, and `::1`; remote endpoints require `allowRemote:true`. Use `/capabilities`, `/health`, and `/generate` JSON contracts. Accept base64 or URL-safe returned MP4 data only through the documented response contract; never send credentials.
- [ ] **Step 4: Run CI and verify full suite passes.**
- [ ] **Step 5: Commit** `feat: add local video generation provider`.

### Task 3: Product identity package and generation QC

**Files:**
- Create: `packages/generation/src/product-fidelity.ts`
- Modify: `packages/generation/src/index.ts`
- Create: `packages/generation/test/product-fidelity.test.ts`

**Interfaces:**
- Produces: `ProductIdentityPackage`, `GenerationCandidateMeasurements`, `GenerationCandidateReport`, `evaluateGenerationCandidate()`, `rankGenerationCandidates()`, `assertGenerationCandidateAccepted()`.
- Consumes: normalized measurements produced by optional local OCR/vision workers or deterministic tests.

- [ ] **Step 1: Write failing tests** for OCR/logo/silhouette/color/segmentation/temporal/camera thresholds, required invariant failure, weighted ranking, stable tie-breaking, and missing-measurement diagnostics.
- [ ] **Step 2: Run CI and verify the tests fail because fidelity evaluation is missing.**
- [ ] **Step 3: Implement pure deterministic evaluation/ranking.** Required locked invariants are blocking; aggregate score cannot override a blocker.
- [ ] **Step 4: Run CI and verify full suite passes.**
- [ ] **Step 5: Commit** `feat: add product generation fidelity gates`.

### Task 4: Candidate acceptance gate before project import

**Files:**
- Modify: `packages/generation/src/accept.ts`
- Modify: `packages/generation/test/accept.test.ts`
- Modify: `packages/generation/src/types.ts`

**Interfaces:**
- Consumes: candidate reports from Task 3.
- Produces: optional `GenerationAcceptancePolicy` and guarded `buildGenerationAcceptance()` behavior that can require a passing candidate report.

- [ ] **Step 1: Write failing tests** showing a staged output can be rejected before copying into the asset store and that legacy callers without a policy remain compatible.
- [ ] **Step 2: Run CI and verify the new acceptance-policy test fails.**
- [ ] **Step 3: Add an optional acceptance policy/report argument with no behavior change for legacy calls.** When a product fidelity report is required and blocking, throw before filesystem acceptance.
- [ ] **Step 4: Run CI and verify full suite passes.**
- [ ] **Step 5: Commit** `feat: gate generated assets on candidate quality`.

### Task 5: Hybrid-local shot routing

**Files:**
- Create: `packages/generated-scenes/src/shot-router.ts`
- Modify: `packages/generated-scenes/src/index.ts`
- Modify: `packages/generated-scenes/src/types.ts`
- Create: `packages/generated-scenes/test/shot-router.test.ts`

**Interfaces:**
- Consumes: source asset/reference count, camera/motion intent, hidden-surface risk, hardware profile, and provider manifests.
- Produces: `routeGeneratedShot()` returning `deterministic-2d`, `layered-2.5d`, `local-video`, or `unsupported`, plus diagnostics and required capabilities.

- [ ] **Step 1: Write failing tests** for static hero, subtle push, large orbit from one image, liquid/material motion, no-local-provider, and low-VRAM routing.
- [ ] **Step 2: Run CI and verify failure because the router is missing.**
- [ ] **Step 3: Implement conservative routing.** Large novel-view or material-motion shots must never be labeled deterministic. Hardware profile can lower quality/candidate count but cannot turn an impossible deterministic shot into a fake one.
- [ ] **Step 4: Run CI and verify full suite passes.**
- [ ] **Step 5: Commit** `feat: route shots across local hybrid pipelines`.

### Task 6: Local worker protocol docs and end-to-end contract coverage

**Files:**
- Create: `docs/local-video-worker.md`
- Create: `tests/integration/local-video-generation-contract.test.ts`

**Interfaces:**
- Consumes: Task 1-5 public APIs.
- Produces: documented localhost worker contract and an integration test proving capability discovery -> routing -> candidate QC -> guarded acceptance can run without any paid provider.

- [ ] **Step 1: Write the integration test first** using an in-process fake localhost-compatible fetch implementation, with no network dependency.
- [ ] **Step 2: Run CI and verify any missing integration wiring fails.**
- [ ] **Step 3: Add only the minimal exports/docs/wiring required by the integration test.**
- [ ] **Step 4: Run `npm run typecheck`, `npm test`, and smoke CI through GitHub Actions and confirm green.**
- [ ] **Step 5: Commit** `docs: document local video worker pipeline`.

## Self-Review

Spec coverage: provider capabilities, local execution, local video worker, product identity, candidate ranking, pre-acceptance gating, conservative shot routing, deterministic brand finishing guidance, hardware profiles, and no-paid-API operation are all represented.

Type consistency: Task 2 consumes Task 1 capabilities; Task 4 consumes Task 3 reports; Task 5 consumes Task 1 manifests; Task 6 validates the full chain.

Review-focus failures are explicitly tested in Tasks 1, 2, 3, and 5.