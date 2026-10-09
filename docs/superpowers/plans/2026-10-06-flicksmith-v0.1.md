# FlickSmith v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-first, fully free base version of FlickSmith that lets Codex, Claude Code, or any MCP client understand footage, edit a structured timeline, render and review videos, and make reversible repairs without paid APIs.

**Architecture:** TypeScript owns a typed timeline-as-data project model, editing command layer, MCP/CLI surface, orchestration, and Studio UI. FFmpeg/ffprobe own deterministic media transforms. Media intelligence and motion are pluggable local subsystems behind stable interfaces so FlickSmith is not coupled to Remotion, one model, or one renderer.

**Tech Stack:** TypeScript, Node.js, pnpm, Zod, SQLite, FFmpeg/ffprobe, whisper.cpp, PySceneDetect or native scene detection, MCP, Vitest, React for Studio, a renderer-neutral motion graph with an initial permissive backend, optional Ollama-compatible local models.

**Spec:** `docs/superpowers/specs/2026-10-06-flicksmith-design.md`

## Global Constraints

- Base workflows require no paid API, subscription, cloud service, or proprietary editing software.
- FlickSmith-owned code uses Apache-2.0.
- Remotion is optional only and never a required renderer.
- `project.flick.json` is the canonical source of truth.
- Timeline time uses integer frame ticks plus rational frame rate, never floating-point seconds.
- Every timeline mutation returns a structured diff, warnings, and checkpoint id.
- Original media files are never overwritten.
- Generated motion code cannot access unrestricted filesystem, process, network, eval, or native modules.
- External media with uncertain rights is rejected or clearly blocked from automatic use.
- v0.1 supports Linux first in CI, with architecture compatible with macOS and Windows.
- Logical Director, Editor, and Reviewer roles may share one host model in v0.1.

## Review Focus

1. Variable-frame-rate and unusual source media must normalize safely without timeline drift — pinned in Task 4.
2. Paths outside permitted media roots must be rejected — pinned in Task 2.
3. Corrupt or partially missing assets must produce explicit diagnostics rather than silent render failure — pinned in Task 4.
4. Branch operations must never mutate the source branch — pinned in Task 3.
5. Generated motion components with forbidden imports or dynamic execution must be rejected before render — pinned in Task 7.

---

## File Structure

```text
flicksmith/
  apps/cli/src/
  apps/mcp/src/
  apps/studio/src/
  packages/schema/src/
  packages/timeline/src/
  packages/media/src/
  packages/render-ffmpeg/src/
  packages/intelligence/src/
  packages/search/src/
  packages/audio/src/
  packages/motion/src/
  packages/providers/src/
  packages/qc/src/
  packages/otio/src/
  packages/agent/src/
  motion/components/
  skills/
  tests/fixtures/
  tests/integration/
  tests/golden/
  docs/superpowers/specs/
  docs/superpowers/plans/
```

### Task 1: Workspace, schema and project serialization

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/schema/src/project.ts`
- Create: `packages/schema/src/time.ts`
- Create: `packages/schema/src/index.ts`
- Test: `packages/schema/src/project.test.ts`

**Interfaces:**
- Produces: `Rational`, `FrameTick`, `FlickProject`, `Asset`, `Track`, `Clip`, `Checkpoint`, `BranchRef`, `parseProject(input)`, `serializeProject(project)`.

- [ ] **Step 1: Write failing schema tests**
  Assert rational frame rates preserve `30000/1001`, frame ticks are integers, invalid floating-point clip positions fail, and a minimal `FlickProject` round-trips through serialization.
- [ ] **Step 2: Run test to verify failure**
  Run `pnpm --filter @flicksmith/schema test`.
- [ ] **Step 3: Implement schema**
  Use Zod schemas plus inferred TypeScript types in the files above.
- [ ] **Step 4: Run tests**
  Expect all schema tests to pass.
- [ ] **Step 5: Commit**
  `git commit -am "feat: add canonical FlickSmith project schema"`

### Task 2: Immutable edit operation engine

**Files:**
- Create: `packages/timeline/src/operations.ts`
- Create: `packages/timeline/src/apply.ts`
- Create: `packages/timeline/src/diff.ts`
- Create: `packages/timeline/src/checkpoint.ts`
- Create: `packages/timeline/src/path-policy.ts`
- Test: `packages/timeline/src/apply.test.ts`
- Test: `packages/timeline/src/path-policy.test.ts`

**Interfaces:**
- Consumes: `FlickProject`, `FrameTick`.
- Produces: `EditOperation`, `EditResult`, `applyOperation(project, op)`, `applyOperations(project, ops)`, `computeProjectDiff(before, after)`, `validatePermittedPath(path, roots)`.

- [ ] **Step 1: Write failing operation tests**
  Cover add, split, trim, move, ripple-delete, speed, transition, text, volume, and invalid-overlap behavior.
- [ ] **Step 2: Write path security test**
  Assert paths outside configured roots and path traversal sequences are rejected.
- [ ] **Step 3: Run tests and confirm failure**
  Run timeline package tests.
- [ ] **Step 4: Implement pure immutable operation application**
  No operation mutates input state. Every successful mutation creates `checkpointId`, warnings array, and diff.
- [ ] **Step 5: Run tests**
  Expect operation and security tests to pass.
- [ ] **Step 6: Commit**
  `git commit -am "feat: add reversible timeline operation engine"`

### Task 3: Checkpoints and Video Git

**Files:**
- Create: `packages/timeline/src/branches.ts`
- Create: `packages/timeline/src/merge.ts`
- Test: `packages/timeline/src/branches.test.ts`

**Interfaces:**
- Produces: `createCheckpoint`, `undoToCheckpoint`, `createBranch`, `diffBranches`, `mergeBranch`.

- [ ] **Step 1: Write failing branch tests**
  Assert branch creation shares asset references, branch edits do not mutate source branch, diffs are deterministic, and conflicts are surfaced explicitly.
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement checkpoint and branch storage**
  Branches reference parent checkpoint and store timeline-level state/deltas.
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**
  `git commit -am "feat: add Video Git checkpoints and branches"`

### Task 4: Media ingestion, probing and proxies

**Files:**
- Create: `packages/media/src/ffprobe.ts`
- Create: `packages/media/src/ingest.ts`
- Create: `packages/media/src/proxy.ts`
- Create: `packages/media/src/normalize.ts`
- Test: `packages/media/src/ingest.test.ts`
- Create: `tests/fixtures/media/README.md`

**Interfaces:**
- Produces: `probeMedia(path)`, `ingestAsset(path, options)`, `createProxy(asset, options)`, `normalizeMediaTiming(metadata)`.

- [ ] **Step 1: Write failing ingestion tests**
  Cover normal CFR media, variable-frame-rate metadata normalization, missing audio, corrupt input, missing file, and partial asset failure diagnostics.
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Implement ffprobe JSON parsing and normalization**
- [ ] **Step 4: Implement deterministic proxy creation**
  Preserve source, write proxy under project cache.
- [ ] **Step 5: Run package and fixture tests**
- [ ] **Step 6: Commit**
  `git commit -am "feat: add robust local media ingestion"`

### Task 5: Local transcript, scene analysis and semantic search

**Files:**
- Create: `packages/intelligence/src/transcribe.ts`
- Create: `packages/intelligence/src/scenes.ts`
- Create: `packages/intelligence/src/keyframes.ts`
- Create: `packages/intelligence/src/analyze.ts`
- Create: `packages/search/src/index-db.ts`
- Create: `packages/search/src/search.ts`
- Test: `packages/search/src/search.test.ts`

**Interfaces:**
- Produces: `TranscriptWord`, `Scene`, `VisualDescriptor`, `analyzeAsset(asset)`, `indexAnalysis(result)`, `searchAssets(query, options)`.

- [ ] **Step 1: Write failing semantic search tests**
  Seed deterministic fixture descriptors and assert ranked retrieval for visual, spoken, and combined queries.
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Implement SQLite analysis store and lexical/local-vector search adapter**
  Keep embedding backend behind `EmbeddingProvider`.
- [ ] **Step 4: Add whisper.cpp adapter and scene-detector adapter**
  Gracefully report unavailable optional tools.
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**
  `git commit -am "feat: add local media understanding and semantic search"`

### Task 6: Coverage planner, Edit Memory and style packages

**Files:**
- Create: `packages/agent/src/brief.ts`
- Create: `packages/agent/src/coverage.ts`
- Create: `packages/agent/src/edit-plan.ts`
- Create: `packages/agent/src/edit-memory.ts`
- Create: `packages/agent/src/style.ts`
- Test: `packages/agent/src/coverage.test.ts`
- Test: `packages/agent/src/edit-memory.test.ts`

**Interfaces:**
- Produces: `Brief`, `CoveragePlan`, `EditPlan`, `StylePackage`, `EditMemoryStore`, `planCoverage(brief, searchResults)`.

- [ ] **Step 1: Write failing coverage tests**
  Assert each narrative beat has source asset, interval, role and confidence; uncovered beats are explicit.
- [ ] **Step 2: Write Edit Memory tests**
  Preferences are local, inspectable, removable, and deterministically applied.
- [ ] **Step 3: Implement planner and local memory store**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**
  `git commit -am "feat: add coverage planning and editable taste memory"`

### Task 7: Renderer-neutral motion graph

**Files:**
- Create: `packages/motion/src/graph.ts`
- Create: `packages/motion/src/renderer.ts`
- Create: `packages/motion/src/validator.ts`
- Create: `packages/motion/src/components/*.ts`
- Test: `packages/motion/src/validator.test.ts`
- Test: `tests/golden/motion.test.ts`

**Interfaces:**
- Produces: `MotionGraph`, `MotionNode`, `MotionRenderer`, `validateMotionComponent`, initial component registry with at least kinetic-title, lower-third, product-card, stat-counter, and caption-highlight.

- [ ] **Step 1: Write failing graph and security tests**
  Reject forbidden imports, filesystem/process/network/eval/native access, dynamic module loading, cycles, and invalid timing.
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement renderer-neutral graph and validator**
- [ ] **Step 4: Implement five initial polished components**
- [ ] **Step 5: Add golden-frame tests**
  Render fixed frames and compare deterministic output hashes or approved image diffs.
- [ ] **Step 6: Run tests**
- [ ] **Step 7: Commit**
  `git commit -am "feat: add FlickSmith motion graph and secure components"`

### Task 8: FFmpeg render planner and audio engine

**Files:**
- Create: `packages/render-ffmpeg/src/filtergraph.ts`
- Create: `packages/render-ffmpeg/src/render-plan.ts`
- Create: `packages/render-ffmpeg/src/render.ts`
- Create: `packages/audio/src/analysis.ts`
- Create: `packages/audio/src/duck.ts`
- Create: `packages/audio/src/beats.ts`
- Test: `packages/render-ffmpeg/src/render-plan.test.ts`
- Test: `packages/audio/src/duck.test.ts`

**Interfaces:**
- Produces: `buildRenderPlan(project)`, `renderProxy(project)`, `renderFinal(project)`, `analyzeLoudness`, `buildDuckingEnvelope`, `detectBeats`.

- [ ] **Step 1: Write failing render-plan snapshot tests**
  Test multi-track video, captions, audio, speed, transitions and mixed motion overlays.
- [ ] **Step 2: Write audio envelope tests**
- [ ] **Step 3: Implement render-plan IR before emitting FFmpeg arguments**
- [ ] **Step 4: Implement audio analysis and ducking**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**
  `git commit -am "feat: add deterministic FFmpeg and audio render engine"`

### Task 9: Rights-aware external media providers

**Files:**
- Create: `packages/providers/src/types.ts`
- Create: `packages/providers/src/provenance.ts`
- Create: `packages/providers/src/wikimedia.ts`
- Test: `packages/providers/src/provenance.test.ts`

**Interfaces:**
- Produces: `MediaProvider`, `ExternalAssetResult`, `ProvenanceRecord`, `canUseAsset(record, intendedUse)`.

- [ ] **Step 1: Write failing rights-policy tests**
  Unknown license, missing commercial permission when required, or missing source provenance blocks automatic inclusion.
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement provider interface and Wikimedia adapter**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**
  `git commit -am "feat: add rights-aware external media sourcing"`

### Task 10: QC engine and localized repair

**Files:**
- Create: `packages/qc/src/checks.ts`
- Create: `packages/qc/src/review.ts`
- Create: `packages/qc/src/repair.ts`
- Test: `packages/qc/src/review.test.ts`

**Interfaces:**
- Produces: `QCResult`, `QCIssue`, `reviewRender(path, project)`, `buildRepairPlan(issue, project)`.

- [ ] **Step 1: Write failing QC tests**
  Cover missing media, black/frozen frames, clipping, caption overflow, safe zones, dead air, duplicate shots, extreme crop, missing attribution, and render failure.
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Implement deterministic checks plus pluggable visual reviewer**
- [ ] **Step 4: Implement segment-scoped repair plan generation**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**
  `git commit -am "feat: add localized video QC and repair planning"`

### Task 11: MCP, CLI and agent skills

**Files:**
- Create: `apps/mcp/src/server.ts`
- Create: `apps/mcp/src/tools.ts`
- Create: `apps/cli/src/index.ts`
- Create: `skills/create-video/SKILL.md`
- Create: `skills/edit-footage/SKILL.md`
- Create: `skills/reference-style/SKILL.md`
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Test: `apps/mcp/src/tools.test.ts`
- Test: `apps/cli/src/cli.test.ts`

**Interfaces:**
- Consumes: all stable package APIs.
- Produces: validated MCP tool catalog and CLI commands from the design spec.

- [ ] **Step 1: Write failing MCP contract tests**
  Assert tool schemas, path restrictions, structured diffs and absence of arbitrary shell execution.
- [ ] **Step 2: Write CLI contract tests**
- [ ] **Step 3: Implement MCP server and tool adapters**
- [ ] **Step 4: Implement CLI**
- [ ] **Step 5: Add agent skill docs with operation-first workflows**
- [ ] **Step 6: Run tests**
- [ ] **Step 7: Commit**
  `git commit -am "feat: expose FlickSmith through MCP CLI and agent skills"`

### Task 12: Studio UI and MagicPath design integration

**Files:**
- Create: `apps/studio/src/App.tsx`
- Create: `apps/studio/src/features/media/*`
- Create: `apps/studio/src/features/timeline/*`
- Create: `apps/studio/src/features/agent/*`
- Create: `apps/studio/src/features/qc/*`
- Create: `apps/studio/src/features/branches/*`
- Test: `apps/studio/src/App.test.tsx`

**Interfaces:**
- Consumes: project state, operation engine, search, branches and QC APIs.
- Produces: local UI for semantic media, viewer, multi-track timeline, Agent/Inspector/QC panels, branch selector and reversible command execution.

- [ ] **Step 1: Translate approved MagicPath prototype into component boundaries**
- [ ] **Step 2: Write failing interaction tests**
  Search asset, select asset, switch branch, submit command, inspect returned checkpoint, inspect QC issue.
- [ ] **Step 3: Implement responsive Studio shell**
- [ ] **Step 4: Wire only typed operation APIs, never direct project mutation**
- [ ] **Step 5: Run UI tests**
- [ ] **Step 6: Commit**
  `git commit -am "feat: add FlickSmith Studio agent-native editor UI"`

### Task 13: OTIO export and interchange

**Files:**
- Create: `packages/otio/src/export.ts`
- Test: `packages/otio/src/export.test.ts`

**Interfaces:**
- Produces: `exportOtio(project)`.

- [ ] **Step 1: Write failing export fixture test**
- [ ] **Step 2: Implement a conservative supported-subset exporter**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**
  `git commit -am "feat: add OTIO interchange export"`

### Task 14: End-to-end launch-ad fixture, CI and release proof

**Files:**
- Create: `tests/integration/launch-ad.test.ts`
- Create: `examples/launch-ad/brief.json`
- Create: `examples/launch-ad/README.md`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Create: `docs/licensing/dependencies.md`

**Interfaces:**
- Consumes: complete v0.1 stack.
- Produces: one canonical reproducible 15-second synthetic launch ad and CI evidence.

- [ ] **Step 1: Write the end-to-end test**
  Generate or use repository-safe synthetic fixtures, ingest, search, build timeline, add captions/music/motion, render proxy, QC, local repair, branch comparison and final render.
- [ ] **Step 2: Run E2E test and confirm the first expected failure**
- [ ] **Step 3: Fix integration defects without bypassing package interfaces**
- [ ] **Step 4: Add CI**
  Linux runs typecheck, unit, integration and deterministic golden tests.
- [ ] **Step 5: Add dependency/license document**
  Note FFmpeg LGPL/GPL build considerations and model-weight licensing separately from runtime licensing.
- [ ] **Step 6: Run full verification**
  `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
- [ ] **Step 7: Render and ffprobe canonical output**
  Assert 15s target duration tolerance, dimensions, codecs, audio stream, nonzero bitrate and no missing frames.
- [ ] **Step 8: Commit**
  `git commit -am "test: prove FlickSmith v0.1 end to end"`

## Self-review outcome

- Spec coverage checked: every v0.1 success criterion maps to Tasks 4 through 14.
- Timeline model and operation names remain consistent across tasks.
- Security, licensing and path-policy requirements are explicitly tested.
- Five high-risk failure classes are pinned to owning tasks.
- Plan intentionally defers full Premiere/DaVinci parity, cloud rendering, model training and large swarms.
- Differentiators are implemented as architecture, not marketing-only UI.
