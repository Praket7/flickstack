# FlickSmith

**The agent-native video editor.** FlickSmith is a local-first editing engine where the project is structured data, agents make typed reversible operations, and every important creative decision can be inspected, diffed, reviewed, or undone.

FlickSmith is not a chatbot bolted onto a traditional editor and not a React-video framework. `project.flick.json` is the canonical artifact. Codex, Claude Code, the CLI, MCP clients, and the Studio operate on the same model.

## What is different

- **Coverage Graph** plans narrative beats against concrete time-ranged evidence before cutting. Missing evidence becomes explicit **coverage debt**.
- **Active perception** searches coarse local evidence first and requests more inspection only where the editing task needs it.
- **Semantic Locks** encode creative constraints such as “preserve this founder quote” or “keep the CTA at the end” and enforce them inside the mutation engine.
- **Intent Receipts** record why an edit happened, which frames changed, which typed operation ran, which semantic locks were respected, and the checkpoint it created.
- **Video Git** branches timeline state without duplicating source media, produces semantic branch diffs, and rejects conflicting merges.
- **Edit Memory** stores inspectable local taste rules rather than hiding preferences in a model prompt.
- **Renderer-neutral Motion Graph** provides deterministic keyframed motion components without requiring Remotion. Remotion can be an optional future adapter.
- **Repair Lanes** convert QC issues into localized frame ranges and isolated repair branches instead of rebuilding an entire video.
- **Rights-aware media** records license, creator, source, commercial-use status, and attribution requirements. Unknown rights remain blocked.

## Current v0.4 professional motion engine

FlickSmith v0.4 turns the v0.3 motion data model into a real authoring and rendering system. The project remains the canonical artifact, but professional motion is now authored through production Studio panels and resolved through a versioned native render contract instead of relying on pre-rendered generated-scene videos.

### Implemented in v0.4

- **Native render program + semantic runtime.** `FlickProjectV3 → RenderGraph → RenderProgramV1 → MotionRuntime → EvaluatedScene` is the shared path for preview/final semantics. FFmpeg remains the media decode/encode/mux boundary for v3 rather than the visual compositor.
- **Production typography.** The native text crate uses Parley/HarfRust/Skrifa-backed shaping and layout, preserving resolved font bytes, glyph IDs, clusters, ligatures, variable-axis coordinates, bidi direction, and per-glyph animation state for rendering.
- **Deterministic CPU reference pixels.** Vectors and shaped glyphs have a scene-linear premultiplied reference renderer used for goldens, parity, and fallback.
- **Real GPU composition.** The `wgpu` path allocates device textures, command encoders and render passes, performs ordered premultiplied-alpha composition on the GPU, submits the frame, and reads back the actual framebuffer. Vector/text primitive rasterization is currently staged per layer by the deterministic CPU reference rasterizer; v0.4 therefore does **not** call this full GPU vector rasterization.
- **Professional authoring surfaces.** Studio now has project-backed Layer Tree, Inspector, Timeline/Dope Sheet, value/speed Curve Editor, spatial paths, 2.5D viewer gizmos, masks/camera controls, compositing Node Graph, procedural controls, and tracking controls rather than a hard-coded demo workspace.
- **Animation depth.** Independent-dimension Bezier timing, roving spatial keys, springs/overshoot, direct-manipulation gesture commits, cameras, masks/mattes, shared transitions, effects contracts, motion blur/DOF scheduling, behaviors, rigs, and responsive layout stay editable project data.
- **Procedural motion.** Deterministic replicators, index context, grid/radial/path distributions, falloffs, particles, time offsets, seeded variation, and hard instance/particle budgets add kinetic density without exploding project layer count.
- **Real tracking solver boundary.** Point and planar solver implementations are available through an optional native OpenCV backend with confidence/error diagnostics and stabilization derivation. Builds without OpenCV expose the capability as unavailable instead of faking a track.
- **Motion-quality QC.** FlickSmith measures static-frame ratio, in-shot motion density, cut-only energy, dead space, UI occupancy, projected readability, safe-area spacing, layered-motion independence, focal competition, and resolved end-card hold. The failed v0.3-style film is a regression fixture.
- **Native premium acceptance project.** The v0.4 benchmark film is a 48-second brand-neutral software-product project made entirely from editable FlickSmith text/vector/camera/procedural/effect/audio-reactive layers. It contains no generated PNG/HTML/video proxy and defines 16:9 and 9:16 from the same source.

### Capability boundaries in v0.4

FlickSmith reports these explicitly instead of turning scaffolding into marketing claims:

- The GPU compositor is real `wgpu` device work, but v0.4 still uses **hybrid primitive raster + GPU composition** for vector/text primitives. Full hardware vector/glyph rasterization remains a later backend optimization.
- Native Rust, optional OpenCV, and macOS/Windows package builds are verified in GitHub Actions because this conversation runner has no Rust toolchain. Hardware GPU throughput/parity requires an Actions/self-hosted runner exposing a real compatible adapter; no synthetic FPS is reported.
- Native OpenFX execution remains disabled until a process-isolated trusted plugin host exists.
- OCIO/ACES processing is claimed only when a real non-stub OpenColorIO backend is linked and verified. Declarative color intent alone is not described as pixel processing.
- The compositor is a professional 2D/2.5D motion system, not Blender-class mesh modeling, ray tracing, character animation, or physically based 3D.
- Full AAF/FCPXML round-trip, distributed rendering, and multi-user collaboration remain outside v0.4.

### Release acceptance model

A premium project cannot pass merely because it renders. Generated visuals must remain editable, the same source must survive responsive variants, important UI/text must remain readable, motion energy must exist inside shots rather than only at cuts, long scenes must contain independent motion groups, and the resolved end card must hold for at least 45 frames at 30 fps. See `benchmarks/v0.4/premium-film-report.json` and `docs/release-v0.4-verification.md`.

## Requirements

- Node.js 22+
- FFmpeg and FFprobe on `PATH`
- No paid API is required for the base editing/rendering path

Optional local intelligence adapters such as Whisper or a local VLM can add richer transcript and visual evidence. Model weights remain subject to their own licenses.

## Quick start

```bash
npm install
npm test
npm run typecheck
node --experimental-strip-types apps/cli/src/index.ts doctor
node --experimental-strip-types apps/cli/src/index.ts init launch-ad
```

Run the MCP server from a project directory:

```bash
FLICKSMITH_PROJECT=./project.flick.json \
FLICKSMITH_MEDIA_ROOTS="$PWD" \
node --experimental-strip-types apps/mcp/src/server.ts
```

The server exposes typed tools such as `import_asset`, `add_clip`, `split_clip`, `trim_clip`, `branch_project`, `diff_branches`, `render_final`, `review_render`, and `repair_segment`. There is deliberately no arbitrary shell-execution tool.

## Studio

The current product prototype is designed around semantic evidence, Coverage Graph, live edit health, timeline state, QC/repair lanes, Video Git branches, and Intent Receipts rather than copying the panel hierarchy of a conventional NLE.

## Architecture

```text
local/licensed media
       ↓
ingest + ffprobe + proxies
       ↓
active multimodal evidence ↔ semantic index
       ↓
Coverage Graph → Director / Editor / Reviewer
       ↓
typed immutable operations ← Edit Memory / Semantic Locks
       ↓
project.flick.json + Intent Receipts + Video Git
       ↓
RenderGraph v3 + native MotionRuntime + CPU reference / wgpu compositor
       ↓
proxy/final render → QC → localized Repair Lane → typed operations
```

Read `docs/superpowers/plans/2026-10-08-flicksmith-v0.4-professional-motion-engine.md` for the v0.4 build plan. The v0.3 architecture documents remain the reference for the underlying motion data model and v0.2 remains the reference for the editing/audio foundation.

## Honest scope

v0.4 is designed to produce premium commercial/product motion work with editable provenance, serious typography, procedural density, 2.5D authoring, graph timing, compositing, tracking and deterministic native-render semantics. It is a much stronger motion editor than v0.3, but this README does not claim blanket superiority over every mature NLE/VFX application. Mature tools still have decades of plugin, codec, color, collaboration and specialist workflow depth.

The release evidence separates three things that are easy to blur together: **CPU reference correctness**, **real GPU composition**, and **measured hardware GPU performance**. The first two are implemented in source; the third is claimed only when a verified adapter run exists. The same rule applies to optional OpenCV tracking and native desktop packaging.

FlickSmith's differentiator is the combination of professional motion primitives with an agent-native, typed, reversible, inspectable project model—so a human or agent can make deep edits without flattening the work or hiding intent.

## License

FlickSmith-owned code is Apache-2.0. See `THIRD_PARTY_LICENSES.md`, `docs/licensing/dependencies.md`, and `docs/security-v0.2.md` for third-party/runtime and security notes.
