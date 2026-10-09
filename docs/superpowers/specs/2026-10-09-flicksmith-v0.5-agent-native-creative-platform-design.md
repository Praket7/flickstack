# FlickSmith v0.5 Agent-Native Creative Platform Design

> This design is the architectural bridge from FlickSmith v0.4's professional motion engine to a hybrid agent-native professional creation platform. It intentionally separates structured editable generation from flattened generative media.

## Goal

Make FlickSmith the strongest agent-native professional video creation environment by combining trustworthy multi-step creative orchestration with professional editing and motion control, while allowing generated image, video, audio and design assets to enter the same canonical, editable, reversible project model.

The defining user experience is not merely “chat with an editor.” A creator should be able to describe a finished communication goal, provide footage, brand material and references, and let FlickSmith plan, create, edit, verify and revise a complete project while every important decision remains inspectable and reversible.

A flagship v0.5 capability is **Generated Scene Assets**: generate a still image conversationally, convert that image into a structured layered scene, and animate the scene with FlickSmith's native motion engine instead of immediately flattening the result into a generated video clip.

## Product Position

FlickSmith should not try to recreate every specialist feature in Resolve, Nuke, After Effects, Pro Tools and Blender. It should integrate open standards and specialist tools where appropriate, while owning the layer that those systems still handle poorly: intent-to-execution orchestration over a professional editable project.

The target is:

- professional enough to finish premium ads, product films, creator content, explainers, social campaigns and motion-heavy editorial work;
- agent-native enough that complex jobs can be delegated in natural language;
- structured enough that agents never need to hide creative decisions in opaque model state;
- extensible enough to route generation and analysis to the best provider for each task;
- local-first for core editing/rendering, with cloud generation as an optional capability rather than a requirement.

## Research Basis

### Chat-native image generation

OpenAI's current API exposes image generation as a built-in tool in the Responses API, including conversational multi-turn generation/editing, image inputs, transparent backgrounds on supported image models, streamed partial images, and mask-based editing. This provides a first-party route to reproduce the “generate an image in chat” interaction inside FlickSmith without treating the ChatGPT product UI's internal image tool as an external API.

The provider integration should nevertheless remain model-neutral. OpenAI can be the primary cloud adapter, while the same contract can support local or third-party image generators later.

### Structured image editability

Recent work establishes that a raster image does not have to remain a flat editing primitive:

- **Qwen-Image-Layered (CVPR 2026)** decomposes a single RGB image into a variable number of semantically separated RGBA layers. Its released implementation can export/edit/recombine those layers, and the project is Apache-2.0 licensed.
- **Bunraku (2026)** demonstrates a stronger structured-asset result for illustrations: a single image is converted into ordered RGBA layers, per-layer meshes and parameter-driven deformation, producing an editable Live2D-style rig rather than a rasterized video.
- **LayerAnimate (ICCV 2025)** demonstrates layer-specific animation controls including motion amount, trajectories and sketch controls, although the output is still generated video.
- **3D Cinemagraphy (CVPR 2023)** combines a layered-depth representation with motion estimation to generate camera motion and content motion from a single still.
- Traditional Photoshop/After Effects parallax workflows already prove the production value of separating foreground/background layers, placing them in Z space and animating a 3D camera; the missing piece is automating the decomposition and hidden-region completion.

### Practical supporting components

- Promptable segmentation such as SAM 2 can provide editable object masks when full semantic layer decomposition is unavailable.
- Monocular depth models such as Depth Anything V2 can supply a depth prior for Z placement, 2.5D mesh displacement and safe camera motion.
- Generated or inpainted clean plates are required because moving foreground layers otherwise exposes holes where occluded pixels never existed in the source image.

No mainstream product found in this research combines all of the following into one canonical project model: conversational image generation, automatic structured layer/depth decomposition, native editable animation, agent-safe typed operations, generation provenance, branchable revisions and QC. Individual pieces exist. The combination is the opportunity.

## Core Design Principles

1. **Structured before flattened.** When a still can be animated using native layers, transforms, masks, depth and camera motion, that is the default path. Generative image-to-video is an optional mode, not the canonical representation.
2. **One canonical project.** `.flick.json` remains the source of truth. Studio, MCP clients, CLI, agents and renderers operate on the same project state.
3. **Every creative mutation is typed and reversible.** Generation requests, asset acceptance, layer assembly and motion changes all flow through revision-safe operations with Intent Receipts, Semantic Locks, checkpoints and Video Git semantics.
4. **Provider output is immutable evidence.** Once accepted, generated bytes are content-addressed assets. A later regeneration produces a new asset and receipt rather than silently changing history.
5. **Provider-neutral generation.** Image, video, audio, inpainting, decomposition and analysis use versioned provider contracts. FlickSmith owns orchestration and project semantics, not a single model vendor.
6. **Core editing remains local/offline capable.** A user can open, edit, render and inspect an existing project without access to any paid generation service.
7. **Professional text stays native.** Critical titles, CTA text, UI labels and brand copy should remain FlickSmith text/vector layers rather than being baked into generated raster artwork wherever practical.
8. **Uncertainty is visible.** Decomposition confidence, missing clean-plate areas, depth ambiguity and unsupported provider capabilities surface as diagnostics, never as silently trusted facts.
9. **Generation provenance is mandatory.** Provider, model, prompt, inputs, parameters, usage, rights state and output asset hashes are stored for each generation event. Credentials are never serialized.
10. **Provider failure is transactional.** Failed, cancelled or rejected generations do not mutate canonical project state.

## Architecture

### A. Unified V3 Agent Contract

This is the prerequisite for every later subsystem.

FlickSmith v0.4's professional motion data model already supports image layers, 3D transforms, cameras, masks, mattes, effects, rigs, particles, responsive layouts and compositing graphs. However, the current MCP catalog exposes v1 and v2 editing surfaces and does not expose an equivalent v3 professional-motion operation catalog.

v0.5 therefore introduces a single version-aware agent operation layer over the canonical v3 mutation engine. The agent should never need a generic shell or arbitrary script primitive.

Representative operations:

- `create_motion_composition`
- `add_motion_layer`
- `set_motion_property`
- `set_motion_keyframes`
- `create_camera`
- `create_mask`
- `set_matte`
- `set_compositing_graph`
- `create_replicator`
- `create_particle_system`
- `apply_motion_style`
- `create_responsive_variant`
- `attach_generated_scene`
- `regenerate_scene_layer`
- `review_generation`

Each mutation consumes an expected project revision and produces a checkpoint plus an Intent Receipt.

### B. Generative Provider Runtime

Create a provider-neutral job system rather than embedding API calls in Studio or MCP handlers.

Provider families:

- image generation/editing;
- video generation/editing;
- background/object inpainting;
- image layer decomposition;
- segmentation;
- monocular depth;
- speech/voice/music/SFX generation;
- upscaling/interpolation.

Every provider advertises a `ProviderCapabilityManifest`, including supported input/output types, transparency, masks, reference images, maximum dimensions, local/cloud execution, estimated cost units and cancellation support.

The runtime performs:

`GenerationRequest -> capability resolution -> budget/rights check -> provider job -> staged output -> validation -> user/agent acceptance -> canonical asset commit`

Generation can stream previews to UI, but only accepted final outputs become project assets.

### C. Generation and Scene Data Model

Add optional fields to Project V3 instead of creating a project-format major version solely for v0.5.

```ts
interface GenerationRecord {
  id: string;
  kind: 'image'|'image-edit'|'layer-decomposition'|'inpaint'|'depth'|'video'|'audio';
  provider: string;
  model: string;
  prompt?: string;
  inputAssetIds: string[];
  outputAssetIds: string[];
  parameters: Record<string, unknown>;
  seed?: number|string;
  requestHash: string;
  usage?: { units?: number; costUsd?: number };
  rights?: {
    commercialAllowed?: boolean|null;
    attributionRequired?: boolean;
    policy?: string;
  };
  createdAt: string;
}

interface GeneratedSceneLayer {
  id: string;
  assetId: string;
  name: string;
  z: number;
  bounds: {x:number;y:number;width:number;height:number};
  confidence?: number;
  depthRange?: readonly [number, number];
  meshAssetId?: string;
}

interface LayeredImageScene {
  id: string;
  sourceAssetId: string;
  layerAssetIds: string[];
  depthAssetId?: string;
  cleanPlateAssetId?: string;
  decompositionProvider: string;
  layers: GeneratedSceneLayer[];
  diagnostics: string[];
}
```

Project V3 gains optional `generationRecords?: GenerationRecord[]` and `generatedScenes?: LayeredImageScene[]`.

### D. Generated Scene Assets Pipeline

The default still-to-animation workflow is:

1. **Generate or select source image.** A chat instruction invokes an image provider. The OpenAI adapter uses the Responses API image-generation tool for conversational generation/editing.
2. **Canonicalize source.** Save the accepted output as a normal FlickSmith image asset and attach a Generation Record.
3. **Choose decomposition strategy.** The router evaluates provider availability and scene type.
   - Prefer a true multilayer decomposition provider such as Qwen-Image-Layered when available.
   - Otherwise use promptable segmentation for logical foreground/subject/background regions.
   - A single transparent generated object can skip decomposition entirely and become one layer over a separately generated or existing background.
4. **Complete occlusions.** Generate/inpaint pixels that are hidden behind movable foreground elements. Store the clean plate and any layer-completion outputs as separate generated assets with provenance.
5. **Estimate depth.** Produce a depth map and per-layer depth statistics. Use the values to establish Z order and conservative camera movement limits.
6. **Build native composition.** Each RGBA element becomes a normal `MotionLayer(kind:'image')` inside a v3 Motion Composition. A camera, transforms, masks and compositing graph are native project data.
7. **Apply motion.** The Director chooses from editable motion styles, camera language and layer behaviors. No video generation is needed for normal parallax, drift, push-in, rack focus, float, scale, rotation or procedural motion.
8. **Review and repair.** Design QC detects holes, edge halos, bad depth ordering, clipping, unsafe camera excursion and focal/readability failures. Repair modifies only the affected layer or motion range.

### E. Three Animation Modes

#### Mode 1: Native 2.5D — default and release-gating

Uses RGBA layers, depth, camera, transforms, effects and optional displacement/mesh deformation. It is deterministic, responsive, cheap to iterate and fully editable.

This mode must be sufficient to pass the v0.5 generated-scene acceptance film.

#### Mode 2: Rigged Layer Animation — advanced

Adds per-layer mesh geometry and parameterized deformations. Character/illustration adapters may use Bunraku-style outputs when practical, but the FlickSmith runtime owns the rig representation so a provider can be replaced later.

This is the route to editable hair movement, cloth motion, facial turns and puppet-style character animation without flattening the scene.

#### Mode 3: Generative Image-to-Video — optional fallback

A provider may create genuinely new temporal content from the source still. The result is imported as a generated video asset and clearly marked `flattenedGeneration: true` in its provenance metadata.

This mode is useful for water, fire, complex human movement or cinematic motions that native 2.5D cannot plausibly synthesize. It must never be marketed or treated as an editable native scene.

### F. Creative Orchestration

Extend the existing Director/Coverage Graph so generation is one possible way to satisfy missing evidence, not a free-form side effect.

The Director can produce a `CreativeActionPlan` consisting of normal typed operations such as:

- search existing source material;
- place source footage;
- generate a missing still;
- decompose it;
- animate the resulting scene;
- generate an SFX bed;
- apply responsive layout;
- run QC;
- repair only failed ranges.

Every generated item must state why generation was chosen over existing footage or a licensed asset.

The Director should support reference-driven goals without copying external creative assets: references can inform pacing, shot density, typography category, motion energy and camera language, while generated output remains traceable to its own assets and prompts.

### G. Professional Finish Layer

The hybrid platform cannot stop at creation. v0.5+ should progressively close the highest-value production gaps without trying to rebuild every specialist DCC feature.

Priorities:

- verified OCIO/ACES transforms and scopes;
- stronger HDR/color pipeline;
- OTIO first-class interchange, followed by the most valuable AAF/FCPXML paths;
- professional proxy/relink/conform diagnostics;
- deeper bus/automation/audio repair workflows;
- isolated OpenFX/plugin host;
- render caching, hardware decode and measured GPU performance;
- collaborative review/approval and branch-aware multi-user workflows.

These are independent subprojects and should not block the Generated Scene Assets release.

## User Experience

### Example: generate and animate an ad hero image

User:

> Generate a premium dusk image of the product on a reflective black pedestal, with a city skyline far behind it. Then make it feel alive for six seconds.

FlickSmith:

1. proposes the image generation and native-layer animation plan;
2. generates the still inside the chat surface and streams a preview;
3. after acceptance, decomposes it into product, pedestal/reflection, skyline and atmosphere/background where possible;
4. completes hidden background pixels;
5. estimates scene depth;
6. creates a normal v3 motion composition;
7. animates a slow camera arc, subtle product float, separate background drift and light/glow behavior;
8. returns an editable timeline and an Intent Receipt.

A follow-up such as “make only the skyline more futuristic” should regenerate/edit only the skyline layer when possible. Other layer asset hashes remain unchanged.

A follow-up such as “make the product movement half as strong” should modify native keyframes/behavior parameters and should not call an image or video generation model at all.

## Failure Handling

### Provider failure

A generation job remains staged until complete. Timeout, quota failure, moderation refusal, cancellation or transport failure leaves the canonical project revision unchanged.

### Bad decomposition

The generated scene stores confidence and diagnostics. The user can merge layers, split/refine a mask, choose a different decomposition provider, or accept a flat image. FlickSmith must not fabricate semantic layer labels when uncertain.

### Occlusion holes

Camera/motion QC renders extreme points in the intended motion envelope and detects transparent/discontinuous regions. The system either requests more clean-plate completion or automatically limits camera excursion.

### Expensive local model

Heavy local layer-decomposition models are capability-gated adapters, not mandatory dependencies. A machine without sufficient resources can use cloud decomposition, segmentation/depth fallback, or flat-image animation.

### Rights uncertainty

Unknown commercial-use status remains unknown/blocked under the existing rights-aware policy. Generating an asset does not automatically imply a rights claim unless the provider's policy and project context establish one.

## Security and Privacy

- API credentials live in the OS/keychain/runtime secret layer, never `.flick.json`.
- Provider calls receive only the input assets explicitly required by the accepted generation operation.
- Local providers are preferred when a user selects local-only/privacy mode.
- Generated asset bytes are hash-addressed and immutable after acceptance.
- Provider plugins run through a permissioned adapter boundary; arbitrary provider code does not gain editor filesystem or shell authority.
- Generation records may store prompt and provider metadata, but must redact credentials, authorization headers and private runtime configuration.

## Benchmark and Release Acceptance

### Generated Scene acceptance corpus

Build at least ten permanent cases:

- product hero on clean background;
- product with reflections;
- portrait with hair edge detail;
- illustrated character;
- foreground object with heavily occluded background;
- architecture/interior with strong depth;
- landscape with atmosphere;
- UI/product screenshot composite;
- typography/graphic poster that should preserve text as native overlays rather than raster text;
- complex scene that is expected to fall back gracefully instead of pretending to decompose perfectly.

### Acceptance gates

1. **Traceability:** 100% of generated outputs in the corpus have a Generation Record linking provider/model/request hash/input and output asset IDs.
2. **Transactional integrity:** provider failure/cancellation changes zero canonical project fields.
3. **Editability:** native generated-scene cases resolve to ordinary v3 image layers/camera/keyframes, not pre-rendered video.
4. **Selective regeneration:** replacing one decomposed layer leaves unrelated accepted layer asset hashes unchanged.
5. **Variant reuse:** the same accepted layer assets can produce 16:9, 9:16 and 1:1 versions without re-generation by default.
6. **Preview/final parity:** generated native scenes inherit existing CPU/GPU timing and visual parity thresholds.
7. **Occlusion safety:** the approved native camera/motion envelope produces no transparent holes in the curated benchmark unless the scene is explicitly marked as a known limitation.
8. **Diagnostics:** low-confidence or unsupported decomposition is surfaced rather than silently promoted to a valid structured scene.
9. **No secret leakage:** fixture projects contain zero provider credentials or authentication material.
10. **Agent safety:** all v3 generation and motion mutations require typed schemas, revision checks and receipts.
11. **Flattening honesty:** generative video assets are separately typed/marked and cannot satisfy the native-editability acceptance gate.
12. **Text quality:** critical copy in the acceptance film is native shaped text, not image-model-rendered copy, unless raster text is explicitly part of the source artwork.

## Implementation Decomposition

This architecture is too broad for one implementation plan. It should be delivered as six independently testable plans in this order:

1. **v0.5a — Unified V3 Agent Runtime.** Expose the professional v3 project/motion mutation engine through revision-safe MCP/agent operations.
2. **v0.5b — Generative Provider Runtime & Provenance.** Add provider capability manifests, transactional jobs, budget/rights controls and Generation Records. Ship OpenAI image generation as the first cloud adapter plus a test provider.
3. **v0.5c — Generated Scene Assets.** Implement source image -> RGBA layers/masks -> clean plate -> depth -> native v3 composition -> 2.5D motion -> QC. This is the flagship image-generation-to-animation feature.
4. **v0.5d — Creative Orchestration.** Let Director/Coverage Graph plan generation and native motion as inspectable operations and create whole campaign variants.
5. **v0.5e — Professional Finish & Interchange.** Add the highest-value color, interchange, audio and plugin-host gaps needed for serious delivery.
6. **v0.5f — Extensibility, Collaboration & Performance.** Provider/effect/analyzer SDKs, branch-aware review/collaboration, render workers/caching and hardware performance gates.

Each plan must preserve a usable product at its completion. v0.5c must not depend on v0.5e or v0.5f to prove the core generated-scene concept.

## Non-Goals for v0.5

- Replacing Blender-class modeling, character animation or ray-traced scene authoring.
- Rebuilding Nuke deep compositing.
- Making every arbitrary real photograph into a perfect fully rigged scene.
- Training FlickSmith's own foundation image/video model.
- Making cloud generation mandatory for normal editing/rendering.
- Claiming a generated video clip is equivalent to native layer editability.

## Recommended Product Claim After Acceptance

If the acceptance gates pass, FlickSmith can defensibly claim a differentiated workflow:

> Generate visual ideas conversationally, turn supported stills into editable layered motion scenes, and let agents build, revise, verify and version the result without flattening the project or hiding creative intent.

That claim is narrower and more technically defensible than “best at every post-production task,” while creating a stronger long-term product moat.
