# FlickSmith v0.3 Motion Architecture Specification

## Status
Design approved in conversation on 2026-10-08. This document turns that approved direction into a repository-grounded specification for implementation review.

## Product goal
FlickSmith v0.3 turns the existing local-first agent-native editor into a professional motion-design and compositing system without sacrificing the qualities that already differentiate FlickSmith: typed project state, deterministic rendering, reversibility, semantic constraints, receipts, local-first operation, and honest verification.

The target is not to clone every mature NLE, compositor, DAW, and 3D package at once. The target is to become the strongest **agent-native professional editor and motion system**: fast enough for direct editing, structured enough for agents, expressive enough for premium launch films and commercial motion graphics, and inspectable enough that every generated edit can be reviewed and repaired.

## Success criteria
A v0.3 implementation is successful only when all of the following are true:

1. Professional motion graphics can be authored from canonical FlickSmith project data rather than pre-rendered scene videos or ad-hoc generated scripts.
2. Every visible motion parameter that v0.3 exposes can be represented as an animatable property with deterministic evaluation at an integer frame.
3. Typography supports paragraph layout, per-character/word/line animation selectors, and reusable text behaviors without flattening text into bitmaps in project state.
4. Curves, behaviors, expressions, audio-driven signals, and keyframes can coexist predictably and can be inspected or baked.
5. 2.5D camera/depth motion, masks/mattes, vector paths, shared-element transitions, and motion blur are first-class render-graph concepts.
6. Preview and final rendering consume the same canonical motion scene semantics. Backend-specific limitations must produce capability diagnostics instead of silent visual changes.
7. Existing v0.2 projects migrate deterministically and preserve their visual/audio behavior within the documented renderer tolerance.
8. Studio exposes dedicated Edit, Motion, Graph, Audio, and Director workspaces without replacing the typed operation pipeline with local component state.
9. Design QC catches layout/legibility/motion defects such as overflow, unsafe text, collisions, discontinuities, insufficient hold time, and unreadable projected UI.
10. Agent-authored changes remain typed, reversible, revision-checked, checkpointed, constrained by Semantic Locks, and recorded through Intent Receipts.
11. No release claim of “professional,” “realtime,” “GPU accelerated,” or “parity” is made without an executable verification gate and recorded evidence.

## Existing v0.2 foundations to preserve
v0.3 is an extension of the current architecture, not a rewrite. The following remain authoritative:

- `project.flick.json` is the canonical artifact.
- Project time uses integer frame ticks and rational frame rates.
- `FlickProjectV2` composition/track/clip state remains the editorial root.
- Typed operations mutate projects through revision-checked sessions and create checkpoints/receipts.
- RenderGraph is the renderer-neutral execution boundary.
- FFmpeg remains the deterministic media/reference renderer for semantics it can faithfully implement.
- GPU preview backends declare capabilities and must not fabricate equivalence.
- Audio buses/effects, multicam, local perception, jobs, rights provenance, security restrictions, Video Git, Semantic Locks, and repair lanes remain first-class.
- Generated motion must not gain arbitrary filesystem, process, network, eval, or native capabilities.

## Architectural decision
FlickSmith v0.3 uses a **hybrid editorial + motion architecture**.

```text
FlickProjectV3
  ├─ editorial compositions/tracks/clips
  ├─ motion compositions
  │    ├─ scene layers
  │    ├─ animatable properties
  │    ├─ behaviors / expressions / selectors
  │    ├─ cameras / masks / mattes / vector paths
  │    └─ optional compositing graph
  ├─ audio analysis signals
  ├─ motion components / rigs
  ├─ layout constraints
  └─ QC / provenance / checkpoints / branches
            │
            ▼
       RenderGraph v3
        ├─ reference backend
        ├─ GPU preview backend
        └─ future adapters / plugin nodes
```

The editorial timeline remains the primary editing surface. A motion composition can appear on that timeline as a structured source. Advanced node compositing is scoped to a motion composition rather than replacing the main timeline.

This avoids three failure modes:

- a pure After Effects clone that becomes awkward for normal editing,
- a pure Fusion graph that makes simple editorial work cumbersome,
- a pure code-video framework that is agent-friendly but poor for direct visual editing.

## Scope decomposition
The requested feature set is intentionally split into independently testable subsystems. Each subsystem receives its own implementation plan after this spec is approved.

1. **Project v3 + Motion Scene Graph**
2. **Animation Core + Graph Curves**
3. **Typography + Responsive Layout**
4. **Vector Shapes + Masks + Mattes**
5. **Camera + 2.5D + Motion Blur**
6. **Behaviors + Expressions + Motion Rigs**
7. **Shared-Element Transitions + Compositing Graph**
8. **Audio Analysis + Beat/Signal Animation + Sound Cues**
9. **Tracking Interfaces + Spatial Attachments**
10. **Design/Motion QC**
11. **Motion Components + Agent Director Model**
12. **Studio Professional Workspaces**
13. **Interchange / Plugin Foundations**
14. **Renderer Performance + Golden Verification Suite**

The subsystems are ordered by dependency, but each must produce useful tested software when completed.

---

# 1. Project v3 and Motion Scene Graph

## Versioning
Introduce `FlickProjectV3` rather than overloading v2 fields until semantics become ambiguous. Add a deterministic v2→v3 migration. v2 remains readable for compatibility; explicit save upgrades to v3 following the same compatibility philosophy as v1→v2.

## Project additions
`FlickProjectV3` extends v2 with:

- `motionCompositions: MotionComposition[]`
- `motionComponents: MotionComponentDefinition[]`
- `motionRigs: MotionRigDefinition[]`
- `audioAnalyses?: AudioAnalysisRecord[]`
- `motionStyles?: MotionStyleDefinition[]`
- `trackingData?: TrackingRecord[]`
- project-wide `layoutTokens?`, `motionTokens?`, and `typographyTokens?`

Existing compositions/tracks/clips remain editorial containers.

## Motion composition
A motion composition has:

- stable `id`
- `name`
- integer `duration`
- `width` and `height`
- `background`
- ordered `layers`
- optional `cameraId`
- optional compositing graph
- optional named published controls
- optional layout variant rules

## Layer kinds
Initial first-class layer kinds:

- `group`
- `null`
- `text`
- `shape`
- `image`
- `video`
- `composition`
- `camera`
- `adjustment`
- `particle` is schema-reserved but implementation may remain capability-gated until the procedural/VFX phase.

All visible layers share:

- lifetime (`start`, `duration`)
- parent relation
- enabled/locked flags
- z-order
- blend mode
- transform
- opacity
- effects
- masks/mattes
- responsive constraints
- motion blur flag

## Animatable properties
All animation-capable values use one generic model:

```ts
interface AnimatedProperty<T> {
  baseValue: T;
  keyframes?: MotionKeyframe<T>[];
  behaviors?: MotionBehaviorInstance[];
  expression?: MotionExpression;
}
```

`AnimatedProperty<T>` is the canonical animation carrier. Features must not invent independent one-off keyframe structures when the property model can express them.

Supported v0.3 property primitives include:

- number
- boolean/enum with hold interpolation only
- color
- vec2 / vec3
- rectangle
- path reference / path geometry where supported

## Evaluation order
Property evaluation is deterministic and documented:

1. base value
2. keyframe interpolation
3. behaviors in declared order
4. expression result or expression modifier according to explicit expression mode
5. rig/published-control mapping at the declared binding stage
6. clamp/validation for the property domain

A later phase may add user-configurable modifier order, but v0.3 must use one stable order.

## Parent transforms
Parent-child transforms must be hierarchical and deterministic. World transforms are derived, not serialized as authoritative values.

## Scene validation
Validation must reject:

- duplicate IDs
- parent cycles
- composition-reference cycles
- non-finite numeric values
- invalid layer lifetimes
- unsupported interpolation for discrete types
- missing masks/mattes/camera/component references
- unbounded expression work
- constraints that form unsatisfiable dependency cycles

---

# 2. Animation Core and Graph Curves

## Keyframe model
A keyframe contains:

- integer frame
- value
- interpolation
- optional incoming tangent
- optional outgoing tangent
- optional spatial tangent where applicable

Interpolation types:

- hold
- linear
- bezier
- auto-bezier
- continuous-bezier
- ease
- expo-in/out/in-out
- spring
- damped-overshoot

Bounce is implemented as a behavior/preset unless a deterministic interpolation primitive proves cleaner.

## Curve engine
The engine must expose both value and velocity/speed sampling for UI graph visualization and QC.

Functions must be pure and deterministic. Given the same project and frame they return the same value independent of wall-clock timing or preview frame drops.

## Saved motion curves
Motion styles contain reusable curve/duration tokens such as:

- `ui-native`
- `mechanical`
- `soft`
- `cinematic`
- `snappy`
- `heavy`

These are data, not hard-coded editor magic, and agents may reference them semantically.

## Curve editor requirements
Studio Motion workspace supports:

- value graph
- speed graph
- draggable tangents
- separate dimensions
- copy/paste curve shape without forcing value equality
- snapping to frame/marker/beat/keyframe
- loop and ping-pong preview helpers
- curve preset application

The view is an editor for canonical project properties, not a separate animation state store.

---

# 3. Typography and Responsive Layout

## Text model
Text layers must support:

- point and paragraph text
- bounding boxes
- wrapping
- horizontal/vertical alignment
- font family/style/weight
- variable-font axes when the shaping backend supports them
- font size
- line height
- tracking
- kerning controls where feasible
- baseline shift
- OpenType feature flags
- fill/stroke
- gradient fill
- shadow/glow through ordinary effects
- text path reference

Text is retained as editable Unicode text in project state.

## Text shaping abstraction
Do not bind the schema to one rasterizer. Define a shaping/layout interface capable of returning glyph runs, line metrics, bounds, and cluster mappings.

A renderer spike may compare Parley/HarfRust, HarfBuzz-backed options, Skia, or other candidates, but the project model remains independent.

## Text selectors
Text animators can target:

- characters/glyph clusters
- words
- lines
- index ranges
- percentage ranges
- regex-defined text ranges where deterministic and Unicode-safe
- seeded-random selections

Selectors output normalized influence weights used by text animator properties.

## Text animator properties
Initial properties:

- position
- scale
- rotation
- opacity
- blur amount
- tracking
- fill color
- stroke width

Per-character 2.5D can be capability-gated until the camera subsystem supports it reliably.

## Responsive layout
Add constraints suitable for video surfaces:

- pin edges
- center
- anchor
- fixed/relative size
- min/max
- aspect fit/fill
- stack row/column
- gap
- alignment
- safe-area relation
- parent percentage sizing
- breakpoint/variant rules for aspect classes

The same motion composition should be able to adapt from 16:9 to 9:16/1:1/4:5 without manually rebuilding every layer when constraints are sufficient.

Layout evaluation occurs before transform animation unless a property explicitly animates the layout result through a defined bridge.

---

# 4. Vector Shapes, Masks, and Mattes

## Shapes
Initial vector primitives:

- rectangle / rounded rectangle
- ellipse / circle
- polygon
- star
- line
- arbitrary Bezier path

Style:

- solid/gradient fill
- stroke width
- line cap/join
- dash pattern
- opacity

## Path operations
Target operations:

- trim path
- offset path
- path morphing when topology is compatible
- boolean union/intersect/subtract/xor where backend support is reliable
- repeat/duplicate through behaviors rather than storing hundreds of copies

## Masks
Masks become general scene objects/references rather than only v2 rectangle masks.

Support:

- rect
- ellipse
- path
- animated feather
- animated expansion
- invert
- combine modes

## Mattes
Track/layer mattes support alpha and luma modes. Matte relationships are explicit references and validated for cycles.

---

# 5. Camera, 2.5D, and Motion Blur

## 2.5D transform
Motion transforms expand to:

- x/y/z
- anchor x/y/z
- scale x/y/z
- rotation x/y/z
- optional orientation helper

Layers may remain 2D by default for efficiency.

## Camera
Camera properties:

- position/orientation
- focal length / field of view
- focus distance
- aperture / depth-of-field amount where supported
- near/far clipping metadata for scene evaluation

The first production goal is UI/product motion depth, not general-purpose 3D modeling.

## Motion blur
Motion blur is a scene-level + per-layer feature with:

- enabled flag
- shutter angle
- shutter phase
- sample budget / quality preset

Preview may use fewer samples than final, but both backends must document and test the relationship. Fast transforms without blur must never silently render with blur in only one backend.

---

# 6. Behaviors, Expressions, and Motion Rigs

## Behaviors
Behaviors are deterministic procedural modifiers that can be combined with keyframes.

Initial behavior library:

- fade
- slide
- grow/shrink
- spring
- overshoot
- drift
- wiggle/noise
- follow
- look-at
- follow-path
- orbit
- stagger
- sequence
- type-on
- audio-react
- auto-focus

Every behavior declares:

- property domains it can affect
- parameters
- deterministic seed where randomness exists
- frame evaluation cost estimate
- whether it can be baked to keyframes

## Expression language
Expressions must be safe, deterministic, and resource-bounded.

Allowed inputs include:

- frame/time derived from project fps
- same-project layer/property references
- markers
- audio-analysis signals
- index/context values
- deterministic math/noise
- composition dimensions

Forbidden capabilities include filesystem, network, process, timers, nondeterministic random, dynamic imports, eval, reflection into host objects, and unbounded loops.

Expressions use a dedicated parser/interpreter or a validated restricted AST. They are not arbitrary JavaScript execution.

## Rigs and published controls
A motion rig maps many internal properties to a smaller semantic control surface.

Control types:

- number slider
- boolean
- enum
- color
- text
- asset reference
- point

Mappings may include normalization/remapping curves. Rigs make complex templates directly usable by humans and agents without exposing every internal keyframe.

---

# 7. Shared-Element Transitions and Compositing Graph

## Transition philosophy
Transitions are represented as compositional relationships, not only clip-local named effects.

First-class transition mechanisms:

- hard cut
- opacity crossfade
- shared-element geometry transform
- match-geometry/mask continuation
- camera continuation
- depth pass/reveal
- focus/blur handoff
- directional/motion match where motion vectors are available

## Shared elements
A shared-element transition binds a source layer/property set in composition A to a destination layer/property set in composition B and interpolates a defined subset:

- bounds
- transform
- corner radius
- mask/path where compatible
- opacity
- selected style properties

The transition has explicit ownership of the overlap interval and can be inspected as canonical project data.

## Compositing graph
Motion compositions may contain an optional node graph.

Initial node families:

- source/layer
- transform
- blur/directional blur
- glow
- shadow
- color adjustment
- mask/matte
- blend/composite
- displacement/noise
- sharpen
- vignette
- output

The graph must compile into the main RenderGraph rather than forming a separate opaque renderer.

---

# 8. Audio Analysis, Beat Signals, and Sound Cues

## Audio analysis record
Analysis is cached/provenanced by source hash and algorithm version.

Signals include where reliable:

- onset strength
- beat positions
- downbeats
- tempo estimate
- phrase/section boundaries
- low/mid/high energy envelopes
- silence regions
- speech/vocal probability when available locally

No analysis may silently depend on a paid/cloud service.

## Animation access
Expressions and behaviors can read named normalized signals such as:

- `beat`
- `downbeat`
- `energy`
- `low`
- `mid`
- `high`

Signal sampling is frame-deterministic.

## Timeline integration
Studio can show analysis markers and snap cuts/keyframes/transition peaks to beats or downbeats.

## Sound cues
Motion components may declare semantic sound events such as `click`, `send`, `impact`, `success`, `panel-open`, or `whoosh`. The actual SFX asset remains explicit project media with provenance and can be replaced/disabled. Components do not hide copyrighted audio inside code.

---

# 9. Tracking Interfaces and Spatial Attachments

Tracking is split from rendering so multiple trackers can produce a shared data model.

Initial records:

- point track
- planar transform track
- corner-pin track
- stabilization transform
- mask track

Reserved future records:

- object/segmentation track
- 3D camera solve
- deformable surface track

Tracking data stores algorithm/version/source hash and confidence/diagnostics where available.

Layers, masks, and effect centers may bind to tracking records through explicit adapters.

The release must distinguish between implemented trackers and schema/API foundations; unsupported tracker kinds are capability-gated, not simulated.

---

# 10. Design and Motion QC

Extend QC beyond encoded media defects into project-aware design checks.

Required v0.3 checks include:

- text overflow/clipping
- safe-area violations
- minimum projected text size
- insufficient text/background contrast where colors are known
- unintended layer collisions
- content outside composition bounds
- clipped shadow/glow extents
- inconsistent alignment against declared layout tokens
- inconsistent spacing against stack constraints
- unreadably small embedded UI after transform/camera projection
- transition discontinuities / one-frame transform jumps
- camera velocity discontinuities
- extremely short title/CTA hold durations
- impossible responsive constraints
- accidental full-frame blank output from project evaluation

QC output retains the existing repair-lane philosophy: exact frame range, severity, implicated IDs, explanation, suggested action, and branchable repair scope.

QC rules use documented thresholds/tokens rather than aesthetic claims hidden in prompts.

---

# 11. Motion Components and Agent Director Model

## Motion component
A component packages:

- motion composition graph
- published controls / rig
- responsive variants
- optional semantic sound cues
- supported aspect classes
- version
- provenance/license metadata
- preview thumbnail/poster metadata

Initial professional component categories:

- kinetic title
- paragraph reveal
- lower third
- message/chat composer
- terminal/code block
- diff/review panel
- command palette
- browser window
- data/stat counter
- table/list
- feature card
- chart
- callout
- logo/end card

Components must be editable project data, not generated opaque videos.

## Director artifacts
The agent workflow gains explicit structured artifacts:

- creative brief
- storyboard
- motion grammar
- shot plan
- sound cue plan
- design QC report
- motion QC report

A Director plan references semantic motion tokens and components rather than raw pixel instructions whenever possible.

Example receipt intent should be able to state why a move exists, what concept it communicates, and what constraints it respected.

---

# 12. Studio Professional Workspaces

Studio adds five top-level workspaces while preserving existing evidence/coverage/receipts concepts.

## Edit
Conventional layered editorial timeline, source/evidence browsing, trim/split/move, multicam, clip/effect inspector.

## Motion
Layer tree + timeline, direct manipulation canvas, property inspector, curve editor, text selectors, masks, behaviors, responsive constraints, camera controls.

## Graph
Compositing node graph for the selected motion composition, with capability diagnostics and node inspection.

## Audio
Waveforms, buses, effects, meters, beat/analysis lanes, sound-cue events, automation/keyframes.

## Director
Brief/storyboard/motion grammar, coverage, agent proposals, receipts, QC, branch compare, localized repair.

Workspace state that affects the project is persisted through canonical operations. Pure viewport preferences may remain local UI state.

## Professional interaction requirements

- keyboard shortcuts are command-based and discoverable
- undo/redo maps to project checkpoints/operations where applicable
- selection is stable by IDs
- no hidden duplicate project model inside React state
- drag operations preview optimistically but commit through typed mutations
- conflicting revision updates surface a refresh/reapply flow rather than overwriting changes

---

# 13. Interchange and Plugin Foundations

These are professional ecosystem foundations, not promises of instant full compatibility.

## OpenTimelineIO
Extend the current OTIO package to preserve v3 editorial information through metadata when OTIO has no native equivalent. Round-trip tests must prove no accidental loss of timeline order/ranges/markers for supported constructs.

## OpenColorIO / ACES
Introduce a renderer-neutral color-management configuration interface before binding to an OCIO runtime. Project schema must record working/display/output color-space intent where needed.

## OpenFX
Add a host-capability abstraction and repository research spike before loading native plugins. Security/process isolation, pixel formats, parameter serialization, and GPU-context sharing are mandatory design concerns. Do not expose arbitrary native OFX plugins in the default trusted path until isolation policy is implemented.

## SVG and Lottie
SVG should map into vector-layer/path primitives where feasible. Lottie may be imported through an adapter or rendered as a structured source, but the canonical project should preserve editable mappings when supported rather than always flattening.

---

# 14. Renderer Architecture and Performance

## RenderGraph v3
Add node kinds/params required for:

- motion composition source
- text/vector scene rendering
- camera projection
- matte/mask operations
- motion blur
- shared transitions
- tracking transforms
- compositing graph nodes
- audio-analysis-driven animation dependencies

Invalidation must understand property/scene dependency ranges so a one-property change does not invalidate an unrelated whole timeline.

## Backends
Maintain a capability matrix:

1. **Reference/final backend**: deterministic correctness first.
2. **GPU preview backend**: interactive performance with declared quality level.
3. Optional specialized vector/text backend chosen only after benchmark spike.

Potential vector/text candidates may include the current custom wgpu path, Vello/Parley, Skia, or another implementation. Dependency selection occurs after reproducible quality/performance tests, not because one library is fashionable.

## Adaptive preview
Preview quality may reduce:

- motion-blur samples
- effect kernel quality
- decode resolution
- depth-of-field quality
- particle count in future phases

It must not alter story timing, text layout, transform curves, transition semantics, or audio timing.

## Determinism
Final render and golden tests must not depend on wall-clock timing, preview FPS, GPU race ordering, unseeded randomness, or network state.

---

# Typed editing operations

v3 adds typed operations rather than permitting direct project mutation. Representative operations:

- `create_motion_composition`
- `add_motion_layer`
- `remove_motion_layer`
- `reparent_motion_layer`
- `set_motion_property`
- `set_motion_keyframes`
- `set_motion_expression`
- `add_motion_behavior`
- `reorder_motion_behaviors`
- `set_text_style`
- `set_text_selector`
- `set_layout_constraints`
- `add_mask`
- `set_matte`
- `set_camera`
- `add_shared_transition`
- `set_motion_graph`
- `set_rig_control`
- `bind_rig_control`
- `attach_tracking_data`
- `analyze_audio`
- `set_motion_style`

Every operation:

- validates permissions/locks
- rejects invalid references/cycles
- returns affected IDs/ranges
- creates a checkpoint
- creates an Intent Receipt
- participates in revision conflict checks
- is serializable and replayable

---

# Migration strategy

1. Parse v1/v2 exactly as current release supports.
2. Migrate v1→v2 using existing deterministic migration.
3. Migrate v2→v3:
   - preserve editorial compositions/tracks/clips/audio exactly
   - translate existing clip transform/opacity/effect keyframes without visual change
   - translate old `packages/motion` graphs/components into compatibility motion compositions where possible
   - retain untranslatable legacy props in namespaced metadata and issue warnings, never silently discard them
4. Parse migrated v3 and validate all references.
5. Renderer-equivalence fixture compares v2 reference output with migrated v3 output for existing supported semantics.

---

# Security and trust boundaries

- Expressions use a dedicated restricted evaluator, not `eval`, `Function`, Node VM with ambient host access, or arbitrary JS modules.
- Native plugin hosting is off by default until a documented isolation model exists.
- Imported components cannot declare filesystem/network/process powers.
- Asset access still obeys configured media roots and provenance rules.
- Agent tools expose typed editing verbs only.
- Generated component definitions are validated, bounded in size/complexity, and smoke-rendered before being accepted.
- Tracking/audio-analysis executables must run through the existing restricted process/job infrastructure.

---

# Testing strategy

## Unit tests
Each subsystem owns pure deterministic tests for:

- parsing/validation
- evaluation math
- cycles/references
- interpolation/behavior/expression semantics
- layout/text bounds
- transition continuity
- QC detection

## Property tests
Use generated legal inputs for curve/layout/property evaluation where useful, with deterministic seeds.

## Golden frame tests
Maintain small fixture scenes with expected hashes or image-tolerance metrics for:

- typography
- vector paths
- masks/mattes
- camera depth
- motion blur
- shared transitions
- responsive variants

Golden comparison must use a documented image metric/tolerance rather than fragile raw hashes when antialiasing backend differences are legitimate.

## Preview/final parity
For canonical fixtures compare:

- layer bounds
- glyph layout
- transform matrices
- opacity/blend
- mask geometry
- transition progress
- sampled audio timing

Pixel-level comparison is added where both backends claim visual equivalence.

## Migration tests
All existing v0.2 e2e/release fixtures must load and render after migration. No v0.2 release gate is deleted merely because v0.3 adds new ones.

## Studio tests
Controller/view-model tests cover:

- workspace switching
- selection
- optimistic drag commit
- revision conflicts
- curve edits
- component rig editing
- QC navigation

## Security tests
Fuzz/negative tests cover expression escapes, component payload abuse, cycle bombs, huge keyframe sets, malicious plugin metadata, and path/process boundary violations.

---

# Release gates

v0.3 cannot be called complete until the repository records evidence for:

1. v1/v2→v3 migration round-trip fixtures
2. all existing v0.2 tests passing
3. project v3 validation/cycle rejection
4. deterministic property evaluation
5. text layout + selector animation fixtures
6. responsive 16:9 / 9:16 / 1:1 / 4:5 fixtures without unintended overlap
7. camera + 2.5D transform fixture
8. motion-blur fixture
9. mask/matte fixture
10. shared-element transition continuity with no black or one-frame jump
11. beat/audio-signal frame alignment ≤ 1 frame for cached analysis fixtures
12. design-QC fixtures that intentionally trigger each required rule
13. preview/final semantic parity suite
14. renderer capability diagnostics for unsupported features
15. Studio typed-operation integration tests
16. security negative suite
17. package/license/runtime audit
18. performance report on declared hardware/toolchain with no fabricated GPU claim
19. acceptance project proving premium UI motion can be authored from structured project state without pre-rendered scene videos

The acceptance project may use a Codex-like or synthetic UI fixture, but this architecture phase does **not** recreate the requested Codex advertisement.

---

# Performance targets

Targets are release goals, not claims until measured.

- Interactive preview should sustain the display cadence for common 1080p motion scenes on supported modern hardware using adaptive quality.
- Timeline/property scrubbing should remain responsive under thousands of keyframes through indexed dependency evaluation and caching.
- Text/vector layout should avoid full-scene recomputation when unrelated properties change.
- 4K final render prioritizes correctness; GPU acceleration is used only where parity is verified.
- Memory caches are bounded and participate in existing device-loss/recovery behavior.

Exact FPS numbers belong in benchmark evidence tied to hardware, backend, scene, and quality preset.

---

# Repository structure additions

Expected high-level package boundaries:

```text
packages/
  animation/          keyframes, curves, property evaluation
  motion/             scene graph, layers, composition model, legacy adapter
  typography/         shaping/layout interfaces, selectors, text animators
  vector/             paths/shapes/boolean/trim abstractions
  layout/             responsive constraints and aspect variants
  expressions/        restricted expression parser/evaluator
  behaviors/          procedural motion modifiers
  compositing/        motion compositing graph + shared transitions
  tracking/           tracking record model/adapters
  audio-analysis/     beat/onset/envelope analysis + cache model
  motion-components/  reusable components/rigs/published controls
  design-qc/          project-aware layout/motion checks
```

Existing packages remain authoritative for schema, timeline, rendering, audio, jobs, security, OTIO, QC media analysis, and Studio integration. A package may be merged with an adjacent one if implementation proves the boundary artificial, but responsibilities must remain isolated.

---

# Non-goals for the first v0.3 production cut

These are deliberately not blockers for v0.3 Motion Core unless their underlying schema/interface is required:

- full Blender/Cinema4D-style mesh modeling
- arbitrary native plugin execution in the trusted editor process
- cloud collaboration service
- every mature Resolve/AE/Premiere effect
- physically accurate particle/fluid simulation
- deep compositing / EXR pipeline parity with high-end VFX packages
- blanket support for every OTIO/AAF/FCPXML edge case
- AI-generated product UI as a substitute for real/structured UI

The architecture must leave room for these without pretending they already exist.

---

# Product-quality principles

1. **Completeness over decoration.** Do not add effect packs before the animation/layout fundamentals are solid.
2. **Real structure over baked pixels.** Text, UI, shapes, and components remain editable where practical.
3. **Few coherent motion grammars over random transitions.** Motion styles are reusable systems.
4. **Product/UI legibility over spectacle.** Camera/effects must preserve readability unless the user intentionally chooses otherwise.
5. **Fast common path, deep advanced path.** Timeline and behaviors handle routine editing; graph/curves expose precision when needed.
6. **Agent and human edit the same model.** No hidden agent-only renderer or human-only project fork.
7. **Evidence before claims.** Verification records are part of the release.

## Final definition of done
FlickSmith v0.3 is done when the new scene/animation/type/layout/compositing/audio-motion systems are usable through typed project operations and Studio, render deterministically through declared backends, survive migration and security gates, and can produce a premium professional motion piece from structured assets without relying on pre-rendered custom scene clips as a workaround.
