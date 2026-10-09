# FlickSmith v0.3 Motion Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FlickSmith v0.3 Motion Core as a typed, deterministic, reversible professional motion-editing architecture layered onto the verified v0.2 editor without recreating the Codex advertisement.

**Architecture:** Editorial v2 containers remain intact while project v3 adds first-class motion compositions. A shared animation evaluator feeds typography, layout, vectors, behaviors, expressions, rigs, audio signals, transitions, render-graph compilation, QC, and Studio surfaces. Unsupported heavy native capabilities remain explicit capability-gated foundations rather than simulated implementations.

**Tech Stack:** TypeScript on Node 22, node:test, existing FlickSmith schema/timeline/render graph/FFmpeg/GPU-preview architecture, Rust/wgpu capability boundary retained but not expanded without toolchain evidence.

**Spec:** `docs/superpowers/specs/2026-10-08-flicksmith-v0.3-motion-architecture-design.md`

## Global Constraints

- Preserve every existing v0.2 test and deterministic render semantic.
- Project state stays canonical in `.flick.json`; Studio and agents mutate it only through typed operations.
- Expressions are restricted, deterministic, bounded, and never execute arbitrary JavaScript or host capabilities.
- All random/procedural behavior uses explicit deterministic seeds.
- Preview may reduce quality but never alter timing, layout, transforms, transition semantics, or audio timing.
- v1 and v2 remain readable; explicit v3 migration must not silently discard data.
- Native plugin execution remains disabled until isolation is implemented.
- No Codex advertisement recreation in this implementation phase.

## Review Focus

1. Malicious/cyclic scene inputs must fail without runaway recursion or host access; covered in Tasks 1, 4, and 13.
2. v2 migration must preserve editorial state byte-for-byte in semantic fields; covered in Task 1.
3. Responsive constraints must fail deterministically when unsatisfiable and avoid overlap in supported aspect fixtures; covered in Task 3.
4. One-frame discontinuities across shared transitions/camera motion must be detectable; covered in Tasks 7 and 9.
5. Preview/final semantic compilation must remain stable when motion features are absent; covered in Tasks 8 and 13.

---

### Task 1: Project v3 schema, parser, validation, and v2→v3 migration

**Files:**
- Create: `packages/schema/src/v3/project.ts`
- Create: `packages/schema/src/v3/parse.ts`
- Create: `packages/schema/src/migrations/v2-to-v3.ts`
- Create: `packages/schema/test/v3-migration.test.ts`
- Modify: `packages/schema/src/index.ts`

**Interfaces:**
- Produces `FlickProjectV3`, `MotionComposition`, `MotionLayer`, `AnimatedProperty<T>`, rig/component/audio/tracking/style records, `parseProjectV3`, `parseAnyProjectV3`, `serializeProjectV3`, `migrateV2ToV3`.
- Preserves v2 structures through structural cloning; later tasks import all v3 motion types from this package.

- [ ] Write migration/validation tests first: deterministic migration, preserved editorial fields, duplicate/missing/cycle rejection, non-finite values, discrete interpolation rejection.
- [ ] Run the v3 migration test and confirm RED because v3 modules do not exist.
- [ ] Implement v3 types, parser/validator, compatibility metadata, and deterministic migration.
- [ ] Run v3 tests and full `npm test`; keep 144 legacy tests green.
- [ ] Commit `feat(schema): add v3 motion project model`.

### Task 2: Animation core, curves, velocity sampling, and motion tokens

**Files:**
- Create: `packages/animation/src/index.ts`
- Create: `packages/animation/test/animation.test.ts`

**Interfaces:**
- Consumes `AnimatedProperty<T>` and `MotionKeyframe<T>` from schema v3.
- Produces `evaluateAnimatedNumber`, `evaluateAnimatedVec2`, `evaluateAnimatedVec3`, `sampleVelocity`, `sampleCurve`, `applyMotionStyle`, and deterministic interpolation helpers.

- [ ] Write RED tests covering hold/linear/bezier/ease/expo/spring/damped-overshoot, exact endpoint behavior, deterministic sampling, velocity, and illegal discrete interpolation.
- [ ] Implement pure evaluation math and reusable motion-style curve tokens.
- [ ] Run package tests and full suite.
- [ ] Commit `feat(animation): add deterministic property evaluator`.

### Task 3: Responsive layout, typography layout/selectors, and vector geometry

**Files:**
- Create: `packages/layout/src/index.ts`
- Create: `packages/layout/test/layout.test.ts`
- Create: `packages/typography/src/index.ts`
- Create: `packages/typography/test/typography.test.ts`
- Create: `packages/vector/src/index.ts`
- Create: `packages/vector/test/vector.test.ts`

**Interfaces:**
- Produces `solveLayout`, aspect classification, safe areas, `TextShaper` interface + deterministic fallback layout, selector weights, text animator influence, vector bounds/path trim/morph compatibility/mask helpers.

- [ ] Write RED fixtures for 16:9/9:16/1:1/4:5 layouts, impossible constraints, Unicode text clusters/words/lines/ranges/regex/seeded random selectors, vector bounds and path operations.
- [ ] Implement deterministic constraint solver and fallback text/vector abstractions independent of rasterizer backend.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(motion): add layout typography and vector primitives`.

### Task 4: Restricted expressions, procedural behaviors, and rigs

**Files:**
- Create: `packages/expressions/src/index.ts`
- Create: `packages/expressions/test/expressions.test.ts`
- Create: `packages/behaviors/src/index.ts`
- Create: `packages/behaviors/test/behaviors.test.ts`
- Create: `packages/motion-components/src/rigs.ts`
- Create: `packages/motion-components/test/rigs.test.ts`

**Interfaces:**
- Produces bounded expression tokenizer/parser/evaluator, behavior evaluator library, deterministic noise, rig control mapping/remap.
- Expressions accept only explicit numeric context/functions and property/audio references supplied by caller.

- [ ] Write RED security tests for filesystem/network/process/eval/import/timers/loops/property escape attempts and deterministic expression/behavior tests.
- [ ] Implement restricted parser/evaluator, behavior registry, cost metadata, seeded modifiers, rig mappings.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(motion): add safe expressions behaviors and rigs`.

### Task 5: Motion scene evaluator and professional component library

**Files:**
- Replace/expand: `packages/motion/src/index.ts`
- Replace/expand: `packages/motion/src/motion.test.ts`
- Create: `packages/motion-components/src/index.ts`
- Create: `packages/motion-components/test/components.test.ts`

**Interfaces:**
- Consumes schema/animation/layout/typography/vector/expressions/behaviors/rigs.
- Produces `validateMotionComposition`, `evaluateMotionComposition`, hierarchical world transforms, layer evaluation records, legacy graph adapter, structured component definitions for title/paragraph/lower-third/message/terminal/diff/command-palette/browser/stat/table/feature-card/chart/callout/logo-end-card.

- [ ] Write RED tests for parenting, world transforms, layer lifetimes, property evaluation order, mask/matte/reference cycles, compatibility adapter, responsive component fixtures and deterministic component scene hashes.
- [ ] Implement evaluator and editable semantic components; keep legacy `SvgMotionRenderer` API compatible.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(motion): ship v3 scene evaluator and components`.

### Task 6: Audio-analysis signals and semantic sound cues

**Files:**
- Create: `packages/audio-analysis/src/index.ts`
- Create: `packages/audio-analysis/test/audio-analysis.test.ts`
- Modify: `packages/audio/src/index.ts`

**Interfaces:**
- Produces cached/provenanced analysis records, frame-normalized signal sampling, beat/downbeat snapping, envelope sampling, phrase/silence helpers, and sound-cue materialization helpers.

- [ ] Write RED tests for source-hash/version cache identity, ≤1-frame beat sampling, envelope interpolation, deterministic snapping, cue materialization without hidden audio assets.
- [ ] Implement pure cached-record evaluator and local-analysis adapter interfaces.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(audio): add deterministic motion analysis signals`.

### Task 7: Shared transitions, compositing graph, camera math, tracking bindings

**Files:**
- Create: `packages/compositing/src/index.ts`
- Create: `packages/compositing/test/compositing.test.ts`
- Create: `packages/tracking/src/index.ts`
- Create: `packages/tracking/test/tracking.test.ts`

**Interfaces:**
- Produces shared-element transition evaluator, compositing DAG validation, camera/view-projection helpers, motion-blur sample schedule, tracking record sampling and attachment transforms.

- [ ] Write RED tests for transition endpoint continuity, no one-frame jump, node/matte cycles, deterministic camera projection, shutter sampling, point/planar/corner-pin/stabilization records and capability-gated unsupported trackers.
- [ ] Implement pure math and graph validation.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(compositing): add transitions camera and tracking foundations`.

### Task 8: RenderGraph v3 compilation and invalidation

**Files:**
- Modify: `packages/render-graph/src/types.ts`
- Modify: `packages/render-graph/src/compile.ts`
- Modify: `packages/render-graph/src/validate.ts`
- Modify: `packages/render-graph/src/invalidation.ts`
- Modify: `packages/render-graph/test/render-graph.test.ts`

**Interfaces:**
- Consumes v3 project/motion/compositing records.
- Produces new node kinds for motion scenes, text/vector, camera, matte, motion blur, transitions, tracking, analysis dependencies and dependency-aware invalidation while preserving v2 compilation.

- [ ] Write RED tests for v3 scene compilation, compositing graph integration, dependency ranges, unsupported capability diagnostics, and unchanged v2 graph semantics.
- [ ] Implement v2/v3 overload compilation and narrow invalidation.
- [ ] Run render-graph and full suite.
- [ ] Commit `feat(render-graph): compile professional motion scenes`.

### Task 9: v3 typed timeline operations and Design/Motion QC

**Files:**
- Create: `packages/timeline/src/v3.ts`
- Modify: `packages/timeline/src/index.ts`
- Create: `packages/design-qc/src/index.ts`
- Create: `packages/design-qc/test/design-qc.test.ts`
- Create: `packages/timeline/src/v3.test.ts`

**Interfaces:**
- Produces revision-safe typed v3 operations from spec, receipts with affected IDs/ranges, lock/reference validation, and project-aware design/motion diagnostics.

- [ ] Write RED tests for operation replay/conflict/checkpoints, create/add/reparent/property/keyframe/expression/behavior/text/layout/mask/matte/camera/transition/graph/rig/tracking/audio/style operations, and every required QC rule.
- [ ] Implement canonical mutations through validation, never direct Studio state mutation.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(timeline): add v3 motion operations and design qc`.

### Task 10: Agent Director artifacts and motion grammar

**Files:**
- Create: `packages/agent/src/director.ts`
- Create: `packages/agent/src/director.test.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/src/style.ts`

**Interfaces:**
- Produces typed creative brief/storyboard/motion grammar/shot plan/sound plan/QC report structures and validates references to semantic components/tokens instead of raw pixel scripts.

- [ ] Write RED tests for structured Director plans, motion-token references, receipt rationale, and rejection of opaque arbitrary executable payloads.
- [ ] Implement Director model and validation helpers.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(agent): add motion director planning model`.

### Task 11: Studio workspaces, professional interaction state, and v3 controllers

**Files:**
- Modify: `apps/studio/src/view-model.ts`
- Modify: `apps/studio/src/view-model.test.ts`
- Modify: `apps/studio/src/controllers.ts`
- Modify: `apps/studio/src/controllers.test.ts`
- Modify: `apps/studio/src/FlickSmithStudio.tsx`

**Interfaces:**
- Produces `edit|motion|graph|audio|director` workspace state, stable selection, graph modes, command registry, beat/keyframe snapping preferences, revision-conflict surfaces, and controller methods backed by v3 typed operations.

- [ ] Write RED tests for workspace switching, selection stability, curve edits, rig editing, optimistic commit/revision conflict behavior and QC navigation.
- [ ] Implement view-model/controller scaffolding without duplicate project state.
- [ ] Run Studio and full suites.
- [ ] Commit `feat(studio): add professional motion workspaces`.

### Task 12: Interchange/plugin/color foundations and capability registry

**Files:**
- Create: `packages/interchange/src/index.ts`
- Create: `packages/interchange/test/interchange.test.ts`
- Modify: `packages/otio/src/export.ts`
- Modify: `packages/otio/src/export.test.ts`
- Modify: `packages/effects/src/index.ts`

**Interfaces:**
- Produces v3 OTIO metadata mapping, SVG/Lottie structured adapters, color-space intent records, OFX host capability declarations with native execution disabled by default.

- [ ] Write RED tests for safe structured import/export, disabled native plugin execution, preserved motion metadata and deterministic capability diagnostics.
- [ ] Implement foundations without pretending unsupported AAF/FCPXML/native OFX/OCIO processing exists.
- [ ] Run targeted and full suites.
- [ ] Commit `feat(interchange): add professional v3 capability foundations`.

### Task 13: Release evidence, performance fixtures, security regression, versioning, and acceptance scene

**Files:**
- Create: `tests/e2e/motion-v03.test.ts`
- Create: `tests/e2e/motion-v03-parity.test.ts`
- Create: `tests/security/motion-v03.test.ts`
- Create: `tests/release/motion-v03-release.test.ts`
- Create: `benchmarks/motion-v03/README.md`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Exercises all prior tasks as an integrated synthetic premium UI-motion acceptance composition; no Codex ad recreation.

- [ ] Write RED release tests covering v1/v2→v3 migration, deterministic scene evaluation, text/selectors, responsive variants, camera, motion blur schedule, mask/matte, transition continuity, beat alignment, design-QC, render graph parity, Studio operations and security escapes.
- [ ] Add benchmark harness/metadata that reports unsupported GPU/native toolchain honestly.
- [ ] Run `npm test`, typecheck if environment permits, release/security/integration subsets, `git diff --check`, runtime/license audit and package smoke evidence.
- [ ] Bump project version to 0.3.0 and document implemented vs capability-gated features.
- [ ] Commit `release: prepare FlickSmith v0.3 motion core`.

