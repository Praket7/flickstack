# FlickSmith v0.4 Professional Motion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn FlickSmith v0.3's motion architecture into a real professional motion editor and renderer that can author, preview, and final-render premium software/product films entirely from editable `.flick.json` layers, with no pre-rendered Python/Pillow scene workaround.

**Architecture:** Keep Project v3 and RenderGraph as the canonical authoring/interchange model, but replace the current descriptive-only motion path with a native Rust motion runtime and renderer. The renderer will evaluate the same animation/behavior/expression program for both desktop preview and final export; Parley/HarfRust will provide real text shaping, Vello CPU will be the deterministic vector/text reference path, and FlickSmith's own `wgpu` compositor will own textures, masks, effects, 2.5D cameras, depth, motion blur, and GPU composition. Studio will become a real React authoring client over typed v3 operations instead of a static demo shell.

**Tech Stack:** Node 22+, TypeScript 5.8+, Rust 1.88+, Tauri 2, `wgpu` 30, Parley/HarfRust/Skrifa/Fontique for typography, Vello CPU for deterministic vector reference rendering, FFmpeg CLI for media decode/encode, React + Vite for Studio, `@xyflow/react` for the compositing node editor, OpenCV 4.8+ behind a separate tracking feature/package, existing FlickSmith schema/timeline/RenderGraph/QC infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-08-flicksmith-v0.3-motion-architecture-design.md`, plus the post-v0.3 motion-film audit that identified renderer, typography, authoring, 2.5D, procedural, tracking, and motion-density gaps.

## Research basis

This plan deliberately borrows interaction and rendering concepts rather than product UI chrome.

- **Adobe After Effects:** A professional animation system needs both value and speed graphs, editable Bezier velocity/influence, separate spatial dimensions, expressions, text animators/selectors, per-character 3D, cameras, and motion blur. Official references: `https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-basics/animation-basics.html`, `https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/speed-between-keyframes/speed.html`, `https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html`.
- **DaVinci Resolve/Fusion:** Motion and VFX need a real node tree, separate Spline and Keyframe editors, Text+/Follower-style sequencing, modifiers/expressions, masks, particles, true 3D, point/planar/camera tracking, and audio-driven parameter animation. Official references: `https://www.blackmagicdesign.com/products/davinciresolve/fusion`, `https://documents.blackmagicdesign.com/UserManuals/FusionManual.pdf`.
- **Apple Motion:** Fast authoring should not require hand-keyframing everything. Behaviors, parameter behaviors, rigs/published controls, replicators, particles, sequence text, type-on, tracking and reusable templates are first-class concepts. Official reference: `https://support.apple.com/guide/motion/welcome/mac`.
- **Cavalry:** Procedural motion needs Duplicators, index context, falloffs, stagger/time offsets, data-driven values and dynamic rendering. Official references: `https://cavalry.studio/docs/nodes/shapes/duplicator/`, `https://cavalry.studio/docs/nodes/utilities/falloff/`, `https://cavalry.studio/docs/getting-started/key-concepts/context/`.
- **HarfBuzz / Parley:** Real typography must shape Unicode into positioned glyphs using proper OpenType/script logic, then line-break, reorder bidi text, align and expose actual glyph metrics. Official references: `https://harfbuzz.github.io/`, `https://docs.rs/parley/latest/parley/`.
- **Vello:** Use the mature CPU path as a deterministic vector reference, but do not make the current GPU implementation the sole production foundation. Official project material still documents active API/maturity work around filters, masks, blending, glyph caches and GPU paths: `https://github.com/linebender/vello`.
- **OpenColorIO / ACES:** Professional compositing should happen in a scene-linear working space with explicit input/output/display transforms rather than treating color as metadata. OCIO provides both CPU and GPU transform paths and current ACES Studio configs; `ocio-rs` 0.2.x targets OCIO 2.5.2 but is still in release-hardening, so FlickSmith must keep its core linear-premultiplied color model independent of that binding and capability-gate the adapter. Official references: `https://opencolorio.readthedocs.io/en/stable/concepts/overview/overview.html`, `https://opencolorio.readthedocs.io/en/stable/configurations/aces_studio.html`.
- **OpenCV:** Real tracking should use proven pyramidal Lucas-Kanade for points, feature matching + RANSAC homography for planes/corner pins, and calibrated `solvePnP`/RANSAC for future camera solves. Official references: `https://docs.opencv.org/5.0/tutorials/others/optical_flow.html`, `https://docs.opencv.org/5.0/tutorials/features/feature_homography/feature_homography.html`.
- **Remotion:** Agent-native video benefits from deterministic frame functions, reusable typed components, springs/interpolation and composition/sequence abstractions. Official references: `https://www.remotion.dev/docs/animating-properties`, `https://www.remotion.dev/docs/reusability`.

## Product decisions locked by the audit

1. **No flattened acceptance-film shortcut.** A benchmark film passes only if all generated UI, text, vectors, masks, cameras, transitions and effects are editable project layers. User-supplied media may remain media; generated motion graphics may not be replaced with pre-rendered scene MP4s.
2. **One visual engine.** Desktop preview and final export use the same native renderer and motion runtime. Quality may differ by sample count/resolution, but timing, layout, transforms, text shaping, effects, camera math and transition semantics may not.
3. **FFmpeg is media I/O, not the v3 compositor.** FFmpeg remains the decoder/encoder/muxer and v2 compatibility renderer. v3 visuals render through FlickSmith's native engine.
4. **Real typography before fancy presets.** The `FallbackTextShaper` is removed from production rendering/QC. Approximate `fontSize * 0.6` metrics are test-only after this release.
5. **Custom wgpu compositor, conservative Vello adoption.** Vello CPU is the deterministic vector reference. GPU vector acceleration is optional and must pass parity benchmarks before use; complex masks/filter graphs remain under FlickSmith's compositor.
6. **Scene-linear premultiplied compositing.** Color transforms occur at ingest/view/output boundaries; blur, glow, blending, motion blur, DOF and opacity compositing operate on scene-linear premultiplied floating-point RGBA. OCIO/ACES is an adapter on top of this invariant, not the internal pixel model.
7. **Motion authoring is a product feature, not controller state.** Motion/Graph workspaces must contain real layer/property editing, keyframe/curve editing, spatial paths, masks, camera controls and node editing.
8. **Tracking capability names must mean solving.** Storing/interpolating tracking records is not labeled “tracking support.” Solver capability and record-playback capability are separate.
9. **QC must detect the failure we just shipped.** Static-motion ratio, shot-internal motion, dead-space/coverage, projected readability, long inactive holds and end-card hold must be measurable.
10. **Premium detail must be structural, not decorative.** The renderer and authoring model must support independent foreground, subject and background/depth motion so premium scenes can stay visually alive without hiding UI behind random effects.
11. **Spacing is judged at the rendered frame.** Authoring-time bounds are insufficient; QC must measure projected UI/text occupancy, safe-area spacing and focal competition after camera/effects/layout are resolved.

## Global Constraints

- Keep `.flick.json` as the canonical editable project state; UI and agents mutate through typed revision-safe operations only.
- Preserve v1/v2/v3 project readability and the existing v2 FFmpeg renderer until v3 feature parity is demonstrated.
- Node 22 and TypeScript strict mode remain required.
- Rust minimum version is **1.88** for the new native workspace.
- Existing `wgpu` 30 stays the compositor version; do not downgrade the whole repository to match an experimental third-party GPU renderer.
- All random/procedural systems use explicit seeds and deterministic frame evaluation.
- Expressions remain bounded and host-isolated; no arbitrary JavaScript, filesystem, process, network, timers or dynamic imports.
- Preview quality reduction may change resolution/sample count only; it may not change timeline timing, text layout, geometry, camera path, transition endpoints or effect parameter values.
- Native OFX execution stays disabled until plugin process isolation exists.
- Unsupported GPU features fail over to the CPU reference renderer with an explicit capability diagnostic; never silently drop an effect.
- Render-core pixel semantics are scene-linear premultiplied floating-point RGBA. Display/output conversion is explicit; no effect node may secretly operate in display-encoded sRGB unless the node contract says so.
- Release claims distinguish CPU-reference correctness, GPU parity and measured hardware performance.
- The premium motion acceptance project may not contain Python/Pillow-generated visual scene proxies or flattened generated graphics.

## Review Focus

1. **Complex text:** Arabic/Devanagari/CJK/emoji/ligatures/RTL/variable-font text must shape and animate without cluster corruption, fallback-font drift or selection errors; pinned in Tasks 4 and 5.
2. **Preview/final parity:** masks, mattes, blur/glow, text, camera depth and motion blur must not change semantically between CPU reference, GPU preview and final export; pinned in Tasks 6–9 and 18.
3. **Malformed/untrusted graphs:** cyclic parenting, cyclic compositing, pathological masks, huge allocations and hostile SVG/Lottie/media metadata must fail with bounded diagnostics rather than panic or allocate unbounded memory; pinned in Tasks 2, 6, 8 and 15.
4. **Device/media failure:** GPU loss, decoder failure, missing fonts/media and unsupported effects must degrade to a declared recovery path without corrupting project state; pinned in Tasks 8, 9 and 10.
5. **Authoring correctness under edits:** drag/keyframe/node/mask operations must preserve revision safety, undo/redo and selection even while preview renders are in flight; pinned in Tasks 11–14.

---

# File/Package Structure

## New Rust workspace

- Create `Cargo.toml` — root workspace; members below plus existing `crates/flick-preview` and `apps/desktop/src-tauri`.
- Create `crates/flick-render-contract/` — versioned JSON/Serde render-program contract shared by renderer crates.
- Create `crates/flick-motion-runtime/` — deterministic animation, expression bytecode, behaviors, rigs, responsive layout and world-transform evaluation.
- Create `crates/flick-text/` — Parley/HarfRust shaping, line layout, glyph metrics/outlines and cluster mapping.
- Create `crates/flick-render-core/` — renderer-independent evaluated scene, scene-linear premultiplied color model, camera, mask/matte/compositing and effect semantics.
- Create `crates/flick-render-cpu/` — deterministic reference rasterizer using Vello CPU plus software compositing where required.
- Create `crates/flick-render-wgpu/` — `wgpu` 30 GPU compositor, texture cache, layer passes, depth, masks, filters and temporal accumulation.
- Create `crates/flick-render-cli/` — headless render/benchmark/golden CLI using the same runtime/core as desktop.
- Create `crates/flick-tracking-opencv/` — optional tracking solver crate, isolated from renderer release dependency.

## New/expanded TypeScript packages

- Create `packages/render-ir/` — compiles validated `.flick.json` + RenderGraph into a versioned native `RenderProgramV1`.
- Expand `packages/expressions/` — compile restricted expressions to versioned bytecode consumed identically by TS tests and Rust runtime.
- Expand `packages/render-preview/` and `packages/render-gpu-native/` — bridge to native program/frame APIs.
- Expand `packages/design-qc/` — temporal/render-aware motion QC rather than only base-value geometry checks.
- Create `packages/procedural/` — typed duplicator/falloff/index/replicator/particle evaluation definitions and TS reference fixtures.

## Studio/Desktop

- Create `apps/studio/package.json`, `apps/studio/vite.config.ts`, `apps/studio/src/main.tsx`, `apps/studio/src/styles.css`.
- Create `apps/studio/src/workspaces/{EditWorkspace,MotionWorkspace,GraphWorkspace,AudioWorkspace,DirectorWorkspace}.tsx`.
- Create `apps/studio/src/panels/{Viewer,LayerTree,PropertyInspector,Timeline,DopeSheet,CurveEditor,NodeGraph,TrackingPanel}.tsx`.
- Create `apps/studio/src/overlays/{TransformGizmo,MotionPathOverlay,MaskOverlay,CameraOverlay}.tsx`.
- Modify `apps/desktop/build.ts` to build/copy the real Studio app instead of shipping static `web-src` demo content.
- Expand `apps/desktop/src-tauri/src/gpu.rs` and `lib.rs` with real native render commands.

---

# Subproject A — Render contract and deterministic native runtime

### Task 1: Lock the v0.4 benchmark corpus and release thresholds

**Files:**
- Create: `benchmarks/v0.4/README.md`
- Create: `benchmarks/v0.4/scenes/*.flick.json`
- Create: `benchmarks/v0.4/expected/manifest.json`
- Create: `tests/release/v04-benchmark-contract.test.ts`
- Modify: `docs/renderer-tolerances.md`
- Modify: `docs/performance.md`

**Interfaces:**
- Produces ten permanent benchmark compositions: kinetic type, dense UI close-up, responsive layout, nested masks/mattes, 2.5D parallax camera with independently animated foreground/subject/background planes, DOF/motion blur, compositing/effect graph, shared-element transition, procedural duplicator/falloff, audio-reactive scene.
- Produces exact release thresholds consumed by later render/QC tasks.

- [ ] **Step 1: Write the failing benchmark-contract test.** Assert ten benchmark IDs exist; each fixture contains editable v3 layers and no generated visual clip proxy; expected manifest contains CPU hash/tolerance fields, required capabilities and target frame numbers.
- [ ] **Step 2: Run** `npm test -- tests/release/v04-benchmark-contract.test.ts` **and confirm RED** because the corpus does not exist.
- [ ] **Step 3: Author the benchmark fixtures and release thresholds.** Use 1920×1080/30 for product-motion fixtures and explicit 9:16/1:1 variants for responsive fixtures.
- [ ] **Step 4: Pin parity thresholds.** CPU golden output is the semantic reference; GPU/reference RGB RMSE ≤ **0.02**, alpha RMSE ≤ **0.005**, activation/timing error **0 frames**. Effects that cannot meet tolerance remain CPU-only with explicit diagnostics.
- [ ] **Step 5: Pin motion acceptance thresholds.** Premium-film preset requires end-card resolved hold ≥ **45 frames at 30 fps**; no accidental generated-UI text below **18 px projected height**; static-frame ratio is computed excluding declared intentional holds and must be ≤ **50%**; every non-hold shot >2 s must contain at least two simultaneously changing visual properties for ≥50% of its duration; hero UI shots must keep the intended focal region readable and inside safe area; scenes marked `layered_motion` must show independently changing foreground/subject/background transforms or effects for ≥40% of the shot instead of deriving all energy from a single global camera transform.
- [ ] **Step 6: Run benchmark-contract test and full `npm test`.** Expected PASS.
- [ ] **Step 7: Commit** `test(v04): lock professional motion benchmark corpus`.

### Task 2: Add the Rust workspace and versioned RenderProgram contract

**Files:**
- Create: `Cargo.toml`
- Create: `crates/flick-render-contract/Cargo.toml`
- Create: `crates/flick-render-contract/src/lib.rs`
- Create: `crates/flick-render-contract/tests/fixtures.rs`
- Create: `packages/render-ir/src/types.ts`
- Create: `packages/render-ir/src/compile.ts`
- Create: `packages/render-ir/test/contract.test.ts`
- Modify: `packages/render-graph/src/index.ts`

**Interfaces:**
- `compileRenderProgram(project: FlickProjectV3, graph: RenderGraph, target: {compositionId:string}): RenderProgramV1`
- `RenderProgramV1` includes version, dimensions/fps/duration, layer graph, animation curves, text/vector definitions, camera, masks/mattes, effect/compositing DAG, transitions, audio-analysis signals and external-media descriptors.
- Rust `RenderProgramV1` is a Serde mirror validated against shared JSON fixtures.

- [ ] **Step 1: Write RED TS and Rust contract tests** using one minimal text layer and one nested camera/matte fixture; assert both languages deserialize the identical JSON and reject unknown major versions/cycles/non-finite values.
- [ ] **Step 2: Run** `npm test -- packages/render-ir/test/contract.test.ts` **and** `cargo test -p flick-render-contract` **and confirm RED**.
- [ ] **Step 3: Implement the contract and compiler.** Do not embed resolved pixels or flattened generated assets.
- [ ] **Step 4: Add allocation limits** for path points, mask count, layer count, effect nodes and texture dimensions at contract validation.
- [ ] **Step 5: Run contract tests, `npm run typecheck`, `cargo test -p flick-render-contract` and full `npm test`.**
- [ ] **Step 6: Commit** `feat(render): add versioned native render program`.

### Task 3: Compile restricted expressions to portable bytecode

**Files:**
- Modify: `packages/expressions/src/index.ts`
- Modify: `packages/expressions/test/expressions.test.ts`
- Create: `crates/flick-motion-runtime/src/expression.rs`
- Create: `crates/flick-motion-runtime/tests/expression_parity.rs`

**Interfaces:**
- `compileExpression(source:string): ExpressionProgramV1`
- Bytecode opcodes are numeric/constants, property/audio/index/time loads, bounded arithmetic/comparison/select and whitelisted math/noise functions only.
- Rust `evaluate_expression(program:&ExpressionProgramV1, context:&ExpressionContext) -> Result<Value, RuntimeError>`.

- [ ] **Step 1: Write parity/security RED fixtures** for arithmetic, `time`, frame, layer properties, audio signals, seeded noise and malicious host-access strings.
- [ ] **Step 2: Run TS and Rust tests and confirm RED** for missing bytecode/runtime.
- [ ] **Step 3: Implement compiler and Rust VM** with opcode-count and recursion-free execution budget.
- [ ] **Step 4: Assert cross-language parity** within `1e-6` for 1,000 deterministic generated contexts.
- [ ] **Step 5: Run full TS/Rust suites.**
- [ ] **Step 6: Commit** `feat(expressions): compile deterministic render bytecode`.

### Task 4: Port animation, behavior, rig, layout and world-transform evaluation to Rust

**Files:**
- Create: `crates/flick-motion-runtime/Cargo.toml`
- Create: `crates/flick-motion-runtime/src/{lib.rs,animation.rs,behaviors.rs,rigs.rs,layout.rs,transform.rs}`
- Create: `crates/flick-motion-runtime/tests/runtime_parity.rs`
- Create: `packages/render-ir/test/runtime-fixtures.test.ts`

**Interfaces:**
- `MotionRuntime::load(program: Arc<RenderProgramV1>)`
- `MotionRuntime::evaluate(frame:u32, surface:RenderSurface) -> Result<EvaluatedScene, RuntimeError>`
- Evaluates keyframes → expressions → behaviors → responsive layout → rig overrides in the same documented order used by v0.3.

- [ ] **Step 1: Export 100+ frame parity fixtures** from current TS animation/motion behavior tests, including spring/overshoot/Bezier/separate dimensions/parent transforms/responsive variants.
- [ ] **Step 2: Write Rust RED parity tests** asserting numeric equality/tolerance and deterministic seeds.
- [ ] **Step 3: Implement runtime modules** without rendering concerns.
- [ ] **Step 4: Add cycle/depth/budget guards** for parenting, rig references and procedural evaluation.
- [ ] **Step 5: Run** `cargo test -p flick-motion-runtime`, targeted TS tests and full suites.
- [ ] **Step 6: Commit** `feat(runtime): add native deterministic motion evaluator`.

---

# Subproject B — Production typography and vector rendering

### Task 5: Replace fallback typography with Parley/HarfRust layout

**Files:**
- Create: `crates/flick-text/Cargo.toml`
- Create: `crates/flick-text/src/{lib.rs,font_db.rs,layout.rs,glyphs.rs,metrics.rs}`
- Create: `crates/flick-text/tests/{layout.rs,complex_scripts.rs,variable_fonts.rs}`
- Modify: `packages/typography/src/index.ts`
- Modify: `packages/typography/test/typography.test.ts`
- Modify: `packages/design-qc/src/index.ts`

**Interfaces:**
- `TextEngine::layout(request:&TextLayoutRequest) -> Result<TextLayout, TextError>`
- `TextLayout` returns lines, glyph runs, glyph IDs, clusters, exact advances/offsets, baselines, bounds and fallback-font identity.
- `packages/typography` retains selector/reference utilities but `FallbackTextShaper` is renamed `TestFallbackTextShaper` and prohibited in production render/QC imports.

- [ ] **Step 1: Write RED typography fixtures** for Latin kerning/ligatures, emoji clusters, Arabic RTL shaping, Devanagari marks, CJK line breaking, mixed bidi, variable weight axis, tabs/paragraph alignment and font fallback.
- [ ] **Step 2: Assert current fallback shaper fails at least the kerning/RTL/complex-script fixtures.**
- [ ] **Step 3: Implement Parley/HarfRust text layout** and exact glyph bounds/metrics.
- [ ] **Step 4: Add font-resolution diagnostics** with deterministic fallback order and project font provenance.
- [ ] **Step 5: Migrate Design QC text bounds/readability to native metrics.**
- [ ] **Step 6: Run Rust/TS tests and full suites.**
- [ ] **Step 7: Commit** `feat(text): add production shaping and glyph layout`.

### Task 6: Implement per-glyph animation and deterministic vector reference rendering

**Files:**
- Create: `crates/flick-render-core/Cargo.toml`
- Create: `crates/flick-render-core/src/{lib.rs,scene.rs,text.rs,vector.rs,paint.rs,color.rs}`
- Create: `crates/flick-render-cpu/Cargo.toml`
- Create: `crates/flick-render-cpu/src/lib.rs`
- Create: `crates/flick-render-cpu/tests/golden.rs`
- Modify: `packages/vector/src/index.ts`

**Interfaces:**
- `build_text_instances(layout:&TextLayout, animators:&[EvaluatedTextAnimator]) -> Vec<GlyphInstance>` preserves cluster-to-glyph semantics so ligatures/combining marks are not split incorrectly.
- `CpuRenderer::render(scene:&EvaluatedScene, frame:u32) -> Result<RgbaFrame, RenderError>` is the deterministic golden/reference backend.
- `LinearRgba` is premultiplied scene-linear float RGBA; input textures are converted at load boundaries and display/output transforms are applied only when requested by the render target.

- [ ] **Step 1: Write RED glyph-instance tests** for char/word/line/index/regex/seeded selectors over ligatures, RTL and combining clusters.
- [ ] **Step 2: Write RED CPU golden tests** for fills/strokes/gradients/rounded rects/Bezier paths/trim/morph/text/glyph transforms/masks, plus premultiplied-alpha edge cases and linear-vs-display-space blending fixtures.
- [ ] **Step 3: Implement vector draw primitives, the scene-linear/premultiplied color core, and Vello CPU adapter.** Use FlickSmith's own layer/mask/composite semantics above Vello; do not expose Vello scene structure in the project schema.
- [ ] **Step 4: Render the typography/vector benchmark fixtures** and record CPU golden hashes/images.
- [ ] **Step 5: Run all Rust/TS suites.**
- [ ] **Step 6: Commit** `feat(render): add reference text and vector renderer`.

---

# Subproject C — Real compositor, camera, effects and preview/final parity

### Task 7: Replace prototype native preview with a real wgpu scene compositor

**Files:**
- Replace: `crates/flick-preview/src/lib.rs`
- Create: `crates/flick-render-wgpu/Cargo.toml`
- Create: `crates/flick-render-wgpu/src/{lib.rs,device.rs,resources.rs,passes.rs,layers.rs,cache.rs}`
- Create: `crates/flick-render-wgpu/tests/parity.rs`
- Modify: `crates/flick-preview/Cargo.toml`

**Interfaces:**
- `GpuRenderer::new(RenderDeviceOptions) -> Result<GpuRenderer, RenderError>`
- `GpuRenderer::load(program:Arc<RenderProgramV1>) -> ProgramHandle`
- `GpuRenderer::render(handle, frame, quality) -> Result<RgbaFrame, RenderError>`
- Resource cache keys include media/frame identity, vector/text glyph atlas identity and effect dependencies.

- [ ] **Step 1: Write RED parity tests** against CPU golden scenes for normal alpha, transformed layers, nested groups and cached text/vector surfaces.
- [ ] **Step 2: Replace the current full-frame-per-layer texture upload path** with per-resource textures/instance data and real transform matrices.
- [ ] **Step 3: Add device-loss recovery** that invalidates GPU resources but not project/runtime state.
- [ ] **Step 4: Run software/adapter-available parity tests.** If no adapter exists, record blocked hardware status rather than synthetic FPS.
- [ ] **Step 5: Commit** `feat(gpu): replace preview prototype with scene compositor`.

### Task 8: Add masks, mattes, 2.5D cameras, depth and shared-element geometry

**Files:**
- Create: `crates/flick-render-core/src/{camera.rs,mask.rs,matte.rs,transition.rs}`
- Create: `crates/flick-render-wgpu/src/{depth.rs,masks.rs,transitions.rs}`
- Create: `crates/flick-render-cpu/tests/camera_masks.rs`
- Create: `crates/flick-render-wgpu/tests/camera_masks_parity.rs`
- Modify: `packages/compositing/src/index.ts`

**Interfaces:**
- Perspective camera uses focal length/FOV/near/far plus world/view/projection matrices.
- Layer transforms support X/Y/Z position, XYZ rotation, anchor and parent transforms.
- Shared-element transition resolves source/destination bounds, clip geometry, opacity, corner radii and camera framing continuously across the transition interval.

- [ ] **Step 1: Write RED camera fixture** with three depth planes and exact expected projected coordinates at key frames.
- [ ] **Step 2: Write RED mask/matte fixtures** for nested vector masks, alpha/luma mattes, feather and inverted masks.
- [ ] **Step 3: Write RED shared-element endpoint/continuity tests** proving no one-frame jump and exact endpoints.
- [ ] **Step 4: Implement CPU semantics, then GPU passes.**
- [ ] **Step 5: Run CPU/GPU parity fixture suite.**
- [ ] **Step 6: Commit** `feat(compositor): add 2.5d masks mattes and shared transitions`.

### Task 9: Implement professional effects, DOF and motion blur

**Files:**
- Create: `crates/flick-render-core/src/effects.rs`
- Create: `crates/flick-render-cpu/src/effects.rs`
- Create: `crates/flick-render-wgpu/src/{effects.rs,blur.rs,dof.rs,motion_blur.rs}`
- Modify: `packages/effects/src/index.ts`
- Modify: `docs/renderer-tolerances.md`

**Interfaces:**
- Required v0.4 effect nodes: gaussian/directional blur, drop/inner shadow, glow, color matrix/basic grade, sharpen, noise/grain, vignette, displacement, chromatic separation, light sweep.
- Motion blur uses shutter angle/phase and deterministic temporal sampling; preview may use fewer samples, final uses configured sample count.
- DOF uses camera focus distance/aperture with a depth-aware blur pass.

- [ ] **Step 1: Write CPU golden tests** for every required effect and effect bounds expansion so shadows/glows are not clipped at viewport edges.
- [ ] **Step 2: Write GPU parity tests** at small deterministic fixtures.
- [ ] **Step 3: Implement effect DAG scheduling** with offscreen textures for spatial effects and bounded intermediate allocation.
- [ ] **Step 4: Implement motion blur/DOF** with explicit sample quality presets: preview-low, preview-full, final.
- [ ] **Step 5: Mark any non-parity GPU effect CPU-only rather than silently approximating it.**
- [ ] **Step 6: Run benchmark corpus and full suites.**
- [ ] **Step 7: Commit** `feat(effects): add production compositing and temporal effects`.

### Task 10: Make final export use the same renderer and FFmpeg only for media I/O

**Files:**
- Create: `crates/flick-render-cli/Cargo.toml`
- Create: `crates/flick-render-cli/src/{main.rs,render.rs,media.rs,ffmpeg.rs}`
- Create: `crates/flick-render-cli/tests/smoke.rs`
- Modify: `packages/render-ffmpeg/src/index.ts`
- Create: `packages/render-gpu-native/src/bridge.ts`
- Modify: `packages/render-gpu-native/src/index.ts`
- Modify: `packages/render-preview/src/index.ts`

**Interfaces:**
- CLI: `flick-render render --program <json> --output <mp4> --backend cpu|gpu|auto`
- CLI: `flick-render frame --program <json> --frame N --output <png>`
- FFmpeg child processes decode external video/audio and encode/mux final frames; visual layer composition is native FlickSmith.
- `NativePreviewRenderer` and CLI both call the same `MotionRuntime` + `RenderCore`.

- [ ] **Step 1: Write RED integration test** rendering the same benchmark frames through desktop-native preview and CLI final path; compare to CPU reference tolerance.
- [ ] **Step 2: Implement sequential FFmpeg media frame provider** with decoder reuse, seek invalidation and missing-media diagnostics.
- [ ] **Step 3: Implement final raw-frame pipe to FFmpeg** with exact FPS/timestamps and color metadata.
- [ ] **Step 4: Keep v2 FFmpeg renderer callable for legacy projects** until v3 coverage proves complete.
- [ ] **Step 5: Run integration tests and benchmark corpus.**
- [ ] **Step 6: Commit** `feat(render): unify preview and final native pipeline`.

---

# Subproject D — Real professional Motion/Graph authoring UI

### Task 11: Turn `apps/studio` into the actual desktop frontend

**Files:**
- Create: `apps/studio/package.json`
- Create: `apps/studio/vite.config.ts`
- Create: `apps/studio/src/main.tsx`
- Create: `apps/studio/src/styles.css`
- Create: `apps/studio/src/workspaces/*.tsx`
- Modify: `apps/studio/src/FlickSmithStudio.tsx`
- Modify: `apps/desktop/build.ts`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Desktop invokes the built Studio SPA.
- Tauri commands expose project open/save, render-program load/invalidate/seek, text measurement, GPU capability and final-render job APIs.

- [ ] **Step 1: Write RED desktop runtime test** proving the packaged frontend originates from `apps/studio/dist` and not the old static demo.
- [ ] **Step 2: Create the Vite/React app** while preserving existing controller/view-model tests.
- [ ] **Step 3: Wire Tauri render commands** to the new native renderer.
- [ ] **Step 4: Remove hardcoded evidence/timeline/preview fixtures from production UI.** Keep equivalent demo data only in Storybook/test fixtures if needed.
- [ ] **Step 5: Run Studio build, desktop smoke and full tests.**
- [ ] **Step 6: Commit** `feat(studio): ship real desktop authoring client`.

### Task 12: Implement Layer Tree, Timeline, Dope Sheet and Inspector

**Files:**
- Create: `apps/studio/src/panels/{LayerTree,Timeline,DopeSheet,PropertyInspector}.tsx`
- Create: `apps/studio/src/panels/*.test.ts`
- Modify: `apps/studio/src/controllers.ts`
- Modify: `apps/studio/src/view-model.ts`

**Interfaces:**
- Every property row has animation state: static/keyframed/expression/behavior/rig-linked.
- Timeline supports layer in/out, keyframe selection/move/copy/paste, markers, beat snapping and frame snapping.
- All writes call `StudioMotionController` typed v3 operations with expected revision.

- [ ] **Step 1: Write RED interaction tests** for layer selection/rename/reparent/lock, keyframe drag, multiselect, copy/paste, beat snap, undo/redo and stale-revision rejection.
- [ ] **Step 2: Implement virtualized layer/property rows** and deterministic selection state.
- [ ] **Step 3: Implement dope-sheet/time ruler** with zoom/pan and frame-exact snapping.
- [ ] **Step 4: Run Studio controller/component tests.**
- [ ] **Step 5: Commit** `feat(studio): add production layer and timeline authoring`.

### Task 13: Implement real Curve Editor and spatial motion paths

**Files:**
- Create: `apps/studio/src/panels/CurveEditor.tsx`
- Create: `apps/studio/src/overlays/MotionPathOverlay.tsx`
- Create: `apps/studio/src/math/curves.ts`
- Create: `apps/studio/src/panels/CurveEditor.test.ts`
- Modify: `packages/animation/src/index.ts`

**Interfaces:**
- Modes: value graph and speed graph.
- Keyframes expose incoming/outgoing Bezier handles, numeric speed/influence, hold/linear/Bezier/continuous/auto states, separate X/Y/Z dimensions, curve copy/paste independent of values and roving spatial keys.
- Motion-path overlay exposes path points and temporal spacing dots.

- [ ] **Step 1: Write RED curve geometry tests** mapping handles ↔ interpolation data and preserving exact curve values after viewport pan/zoom.
- [ ] **Step 2: Write RED interaction tests** for handle dragging, broken/linked tangents, speed/influence editing and separate dimensions.
- [ ] **Step 3: Implement SVG/canvas curve renderer and controller mutations.**
- [ ] **Step 4: Implement spatial path overlay and roving-key workflow.**
- [ ] **Step 5: Compare sampled curves against animation runtime at 1,000 points.**
- [ ] **Step 6: Commit** `feat(studio): add professional graph editor and motion paths`.

### Task 14: Implement Viewer gizmos, masks and 2.5D camera authoring

**Files:**
- Create: `apps/studio/src/panels/Viewer.tsx`
- Create: `apps/studio/src/overlays/{TransformGizmo,MaskOverlay,CameraOverlay}.tsx`
- Create: `apps/studio/src/overlays/*.test.ts`
- Modify: `apps/studio/src/controllers.ts`

**Interfaces:**
- Viewer supports selectable transforms, anchors, scale/rotation, direct mask/path points, camera target/frustum, focus plane and safe-area overlays.
- Drag operations emit typed edits only at gesture commit while preview may receive transient local overrides.

- [ ] **Step 1: Write RED coordinate-space tests** for screen↔world↔layer transforms under camera/perspective/parenting.
- [ ] **Step 2: Implement transform and anchor gizmos** with modifier-key snapping.
- [ ] **Step 3: Implement mask/path editing** including feather visualization.
- [ ] **Step 4: Implement camera/focus/frustum overlays** and 2.5D depth manipulation.
- [ ] **Step 5: Verify undo/revision safety and preview invalidation ranges.**
- [ ] **Step 6: Commit** `feat(studio): add direct 2.5d canvas authoring`.

### Task 15: Implement actual compositing Node Graph

**Files:**
- Create: `apps/studio/src/panels/NodeGraph.tsx`
- Create: `apps/studio/src/panels/NodeGraph.test.ts`
- Modify: `packages/compositing/src/index.ts`
- Modify: `packages/timeline/src/v3.ts`

**Interfaces:**
- Use `@xyflow/react` for node layout/connection interaction only; project state remains FlickSmith's typed compositing DAG.
- Supports source, transform, mask, matte, blur, glow, shadow, color, blend, displacement, noise, sharpen, composite and output nodes.

- [ ] **Step 1: Write RED graph mutation tests** for add/connect/disconnect/delete/duplicate/group, cycle rejection and type-incompatible ports.
- [ ] **Step 2: Implement graph UI** with edge/node selection and Inspector integration.
- [ ] **Step 3: Add graph thumbnails/previews** using native renderer node subgraph rendering, not HTML screenshots.
- [ ] **Step 4: Run compositing validation and Studio tests.**
- [ ] **Step 5: Commit** `feat(studio): add production compositing node graph`.

---

# Subproject E — Procedural motion and true tracking

### Task 16: Add duplicators, index context, falloffs and particle/replicator systems

**Files:**
- Modify: `packages/schema/src/v3/project.ts`
- Create: `packages/procedural/src/index.ts`
- Create: `packages/procedural/test/procedural.test.ts`
- Create: `crates/flick-motion-runtime/src/procedural.rs`
- Create: `crates/flick-motion-runtime/tests/procedural.rs`
- Modify: `apps/studio/src/panels/PropertyInspector.tsx`

**Interfaces:**
- `ReplicatorDefinition`: grid/radial/path distributions, count, spacing/radius/path, transform offsets, time offset and seed.
- `IndexContext`: stable per-instance index/depth/normalized position.
- `FalloffDefinition`: circle/rect/linear/sweep/path with graph curve and combine mode.
- `ParticleDefinition`: deterministic emitter rate/lifetime/velocity/scale/rotation/color curves and seed.

- [ ] **Step 1: Write RED deterministic fixtures** for grid/radial/path duplication, index-driven color/scale, staggered time offsets and falloff-modulated behavior.
- [ ] **Step 2: Add backward-compatible optional schema fields and parser validation.**
- [ ] **Step 3: Implement TS reference and Rust runtime evaluator** with hard instance/particle budgets.
- [ ] **Step 4: Add render-core instance batches** so 1,000 repeated elements do not become 1,000 independent project layers.
- [ ] **Step 5: Add Studio inspector controls and viewport handles.**
- [ ] **Step 6: Run procedural performance fixture and full tests.**
- [ ] **Step 7: Commit** `feat(motion): add procedural replicators falloffs and particles`.

### Task 17: Replace tracking-record “support” with real point/planar solvers

**Files:**
- Create: `crates/flick-tracking-opencv/Cargo.toml`
- Create: `crates/flick-tracking-opencv/src/{lib.rs,point.rs,planar.rs,stabilize.rs,metrics.rs}`
- Create: `crates/flick-tracking-opencv/tests/synthetic.rs`
- Modify: `packages/tracking/src/index.ts`
- Create: `apps/studio/src/panels/TrackingPanel.tsx`
- Modify: `THIRD_PARTY_LICENSES.md`

**Interfaces:**
- `solve_point_track(video, seed, range, options) -> PointTrackResult`
- `solve_planar_track(video, quad, range, options) -> PlanarTrackResult`
- Results include per-frame transform, status, forward/backward error, RANSAC inlier ratio and confidence.
- Current record interpolation API remains, renamed/documented separately from solver capabilities.

- [ ] **Step 1: Write synthetic RED fixtures** with known translation/rotation/perspective and occlusion.
- [ ] **Step 2: Implement pyramidal Lucas-Kanade point tracking** with periodic redetection and forward/backward consistency checks.
- [ ] **Step 3: Implement planar tracking** from ORB/AKAZE-style features + RANSAC homography + perspective-transform corner pin.
- [ ] **Step 4: Implement stabilization transform derivation** and confidence/error diagnostics.
- [ ] **Step 5: Add Tracking panel** for region selection, solve progress, confidence graph, manual correction and bake/apply.
- [ ] **Step 6: Feature-gate OpenCV packaging** so missing native library disables solver with an explicit diagnostic rather than breaking the editor.
- [ ] **Step 7: Commit** `feat(tracking): add real point and planar tracking solvers`.

---

# Subproject F — QC, acceptance and release

### Task 18: Make Design/Motion QC temporal and render-aware

**Files:**
- Modify: `packages/design-qc/src/index.ts`
- Create: `packages/design-qc/src/motion-analysis.ts`
- Create: `packages/design-qc/test/motion-analysis.test.ts`
- Modify: `packages/qc/src/qc.ts`
- Modify: `apps/studio/src/workspaces/DirectorWorkspace.tsx`

**Interfaces:**
- New issue types: `static_motion_ratio`, `inactive_shot`, `dead_space`, `readability_projection`, `focal_competition`, `end_card_hold`, `cut_only_energy`, `motion_density`, `single_plane_motion`, `ui_occupancy`, `safe_area_spacing`.
- `analyzeMotionFrames(frames, shotRanges, annotations, config) -> MotionQCReport` works on downscaled rendered frames plus scene activity metadata.

- [ ] **Step 1: Recreate the failed Codex-v0.3 motion statistics as a RED regression fixture.** Assert it is flagged for high static ratio/cut-only energy/dead-space/end-card hold.
- [ ] **Step 2: Implement frame-difference and coverage analysis** using deterministic downsampled luma/edge maps, plus projected UI/text occupancy and safe-area spacing metrics derived from native scene bounds.
- [ ] **Step 3: Combine render analysis with graph activity** so intentional static hero holds can be annotated rather than penalized blindly, and distinguish genuine layered motion from one global camera/scale transform affecting the whole frame.
- [ ] **Step 4: Move readability calculations to native shaped/projected bounds.**
- [ ] **Step 5: Surface timecoded QC issues in Studio with “jump to frame/layer”.**
- [ ] **Step 6: Run the old failed film fixture and new benchmark scenes.**
- [ ] **Step 7: Commit** `feat(qc): detect bland motion spacing and readability failures`.

### Task 19: Premium motion acceptance project — zero flattened generated scenes

**Files:**
- Create: `tests/fixtures/v04-premium-ui-film.flick.json`
- Create: `tests/acceptance/v04-premium-motion.test.ts`
- Create: `tests/acceptance/v04-native-render.test.ts`
- Create: `benchmarks/v0.4/premium-film-report.json`

**Interfaces:**
- Synthetic 40–50 second software-product film that exercises kinetic type, readable UI close-ups, worktree-style duplication, shared transitions, 2.5D camera, independently animated foreground/subject/background detail, graph effects, audio-reactive behavior, responsive variant and final end card.
- It is intentionally brand-neutral; this task validates the editor and does **not** recreate the Codex advertisement.

- [ ] **Step 1: Write the acceptance test before the film fixture.** It rejects generated visual media proxies and requires native layers/components for every generated scene.
- [ ] **Step 2: Build the film only through FlickSmith v3 project operations/components.** No Pillow, HTML screenshot renderer or pre-rendered generated-scene MP4.
- [ ] **Step 3: Render through CPU reference and native GPU/auto paths.**
- [ ] **Step 4: Run Design/Motion QC thresholds from Task 1.** Zero blocking issues; no unexplained tolerance failures; no `single_plane_motion`, unreadable hero UI, dead-space, or short end-card violations in the premium preset.
- [ ] **Step 5: Generate 16:9 and 9:16 variants from the same source project** without manual layer rebuild.
- [ ] **Step 6: Commit** `test(acceptance): prove native professional motion workflow`.

### Task 20: Release verification, documentation and v0.4.0 cut

**Files:**
- Modify: root `package.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `crates/flick-preview/Cargo.toml`
- Modify: all new crate versions consistently
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `THIRD_PARTY_LICENSES.md`
- Create: `docs/release-v0.4-verification.md`
- Create: `benchmarks/v0.4/<hardware>.json` when measurable

**Interfaces:**
- Release evidence reports CPU correctness separately from GPU hardware performance and tracking availability.

- [ ] **Step 1: Run fresh TypeScript gates:** `npm run typecheck`, `npm test`, `npm run test:integration`.
- [ ] **Step 2: Run fresh Rust gates:** `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- [ ] **Step 3: Run benchmark/golden suite** on CPU reference; run GPU suite only where a verified adapter exists.
- [ ] **Step 4: Run desktop build/package smoke** on macOS and Windows-capable CI before claiming packaged native support.
- [ ] **Step 5: Run runtime/license audit** and verify FFmpeg/OpenCV/font dependencies and licenses.
- [ ] **Step 6: Verify project migration and v2 legacy render suite remain green.**
- [ ] **Step 7: Verify `git diff --check`, clean tree and exact version surfaces.**
- [ ] **Step 8: Write release verification document** with blocked/unsupported items explicitly separated from passing items.
- [ ] **Step 9: Commit** `chore(release): prepare FlickSmith v0.4.0 professional motion engine`.

---

# Ordered Implementation Waves and Approval Gates During Execution

After the user approves this plan, implementation should proceed in these waves. A wave may not be called complete without its own green tests and review.

1. **Wave 1 — Render truth:** Tasks 1–6. Outcome: production typography + deterministic CPU reference + native motion runtime. No UI polish work starts before text/vector golden tests are real.
2. **Wave 2 — Pixel engine:** Tasks 7–10. Outcome: native GPU compositor + masks/camera/effects + same-engine final export. This is the critical “no more Python/Pillow acceptance render” gate.
3. **Wave 3 — Professional authoring:** Tasks 11–15. Outcome: actual Studio frontend, timeline/layer/curve/canvas/node editing.
4. **Wave 4 — Procedural and tracking:** Tasks 16–17. Outcome: kinetic density tools and real tracking solvers.
5. **Wave 5 — Quality/release:** Tasks 18–20. Outcome: blandness/dead-space/readability QC, native benchmark film and v0.4 release evidence.

A failure in an earlier wave blocks claims in later waves. For example, Studio may expose a GPU capability only after the renderer parity test for that capability is green.

# Non-goals for v0.4

- Full Blender-class mesh modeling, ray tracing or character animation.
- Native OFX plugin execution before sandbox/process isolation.
- Full AAF/FCPXML round-trip before the core motion renderer is stable.
- Distributed/network rendering.
- Multi-user collaborative editing.
- A “transition pack” as a substitute for geometry-aware shared transitions.
- Recreating the Codex film during the implementation itself. The editor must pass the brand-neutral native acceptance project first.

# Final Release Gates

The v0.4 branch is not release-ready until all applicable gates below are backed by fresh evidence:

- **Editable provenance:** 100% of generated acceptance-film visuals trace to editable FlickSmith layers/components, not flattened generated scene videos.
- **Typography:** complex-script/RTL/emoji/ligature/variable-font golden fixtures pass; production code contains no `FallbackTextShaper` import.
- **Renderer:** all ten benchmark scenes pass CPU golden tests; GPU-supported scenes meet RGB RMSE ≤0.02 / alpha RMSE ≤0.005 with 0-frame timing error.
- **Color:** CPU and GPU agree on scene-linear premultiplied compositing fixtures; sRGB/linear round-trip tests pass; OCIO/ACES processing is claimed only when a real non-stub OCIO backend is linked and verified.
- **Preview/final parity:** identical program/frame produces semantically identical output through desktop preview and final render paths within declared tolerance.
- **Camera/compositing:** nested masks/mattes, depth sorting, camera projection, shared transitions, DOF and motion blur have deterministic fixtures with no one-frame jumps.
- **Authoring:** real project changes can be made from Layer Tree, Inspector, Timeline, Dope Sheet, Curve Editor, Viewer gizmos and Node Graph and survive save/reload/undo/redo.
- **Procedural:** 1,000-instance duplicator benchmark remains deterministic and within the declared frame budget on CPU reference; GPU claims require measured hardware evidence.
- **Tracking:** synthetic point/planar fixtures meet declared mean error and report confidence; absent OpenCV produces an explicit disabled capability.
- **Motion QC:** the failed v0.3 Codex film is correctly flagged for excessive static motion/cut-only energy/dead space/short end hold, while the v0.4 acceptance fixture passes.
- **Responsive:** same acceptance project renders 16:9 and 9:16 without collision, clipped text or manual layer reconstruction.
- **Security:** malformed graph/expression/SVG/Lottie/media fixtures terminate within budgets and cannot access host capabilities.
- **Legacy:** all v0.2/v0.3 tests and migrations stay green.
- **Packaging:** macOS and Windows package smoke must be verified before claiming native packaged support. Linux remains a development/CI target unless explicitly promoted.

# Self-review

## 1. Spec coverage

- Native v3 renderer execution: Tasks 2–10.
- Real typography/per-glyph animation: Tasks 5–6.
- Graph/speed editor: Task 13.
- 2.5D cameras/masks/shared transitions: Tasks 8, 14.
- Professional effects/motion blur/DOF: Task 9.
- Real Motion workspace and editable Studio: Tasks 11–15.
- Procedural duplicators/falloffs/particles: Task 16.
- True tracking solver: Task 17.
- Motion-density/spacing/readability QC: Task 18.
- No flattened acceptance shortcut: Tasks 1 and 19.
- Preview/final parity and release evidence: Tasks 7–10, 20.

No audited gap is left without an owning task. Full 3D modeling and plugin ecosystems are deliberately non-goals for this release.

## 2. Step scan

Each task owns one independently reviewable deliverable and follows RED → implementation → GREEN → commit. Large UI areas are split between foundational frontend integration, timeline/property editing, curve/spatial editing and node compositing so a reviewer can reject one without invalidating the others.

## 3. Type consistency

The core flow is intentionally one-way:

`FlickProjectV3` → `RenderGraph` → `compileRenderProgram(...)` → `RenderProgramV1` → `MotionRuntime::evaluate(...)` → `EvaluatedScene` → CPU/GPU renderer.

Studio edits never mutate `RenderProgramV1`; they mutate the canonical project through `StudioMotionController`, then invalidate/recompile the affected program range.

## 4. Review Focus coverage

All five Review Focus risks have explicit tests in their owning tasks: complex text (5/6), parity (7–10), malformed graphs (2/6/8/15), device/media failure (7/10), and revision-safe authoring (11–15).

## 5. Proportion

The plan decides package boundaries, interfaces, test gates, implementation order and release thresholds without prescribing full function bodies. It is intentionally much narrower than rebuilding every pro NLE feature; it targets exactly the failures exposed by the v0.3 acceptance film.

---

# Approval Boundary

**STOP HERE. Do not modify production code, add dependencies, bump versions, or create implementation commits until Praket approves this v0.4 plan.**

On approval, the recommended execution method is **Subagent-driven** because the plan contains multiple high-risk subsystems with different expertise boundaries (Rust rendering, typography, GPU compositing, React authoring, computer vision) and a shipped mistake in an early contract would contaminate every later layer. Native execution is still possible if the user explicitly prefers it.
