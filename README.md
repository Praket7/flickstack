# FlickSmith v0.5

**An agent-native professional video creation platform.** FlickSmith keeps the edit as structured, inspectable data so a human, ChatGPT, Work, Codex, the CLI, Studio, and MCP clients can operate on the same canonical `project.flick.json` without flattening creative intent into opaque code or a one-shot generated video.

The core rule is **structured before flattened**. Editing, motion, generated assets, scene decomposition, color intent, audio automation, reviews, extension permissions, render cache keys, and provenance remain explicit project/runtime data.

## What v0.5 adds

- **Unified v3 agent runtime.** Typed MCP operations use expected revisions, atomic persistence, checkpoints, Intent Receipts, Semantic Locks, undo/redo, path validation, and no arbitrary shell/eval tool.
- **Provider-neutral generation.** Generation jobs are cancellable and staged. Acceptance is explicit, content-addressed, provenance-preserving, and credential fields are rejected from canonical state. The OpenAI image adapter uses the Responses image-generation tool when configured.
- **Generated Scene Assets.** Generated stills can be routed through layered/segmentation/depth strategies and assembled into editable native v3 layers and camera motion instead of requiring a flattened AI video.
- **Creative orchestration.** Coverage-aware plans prefer authentic evidence, generate only justified gaps, create responsive variants, run QC, and localize repairs.
- **Human-craft quality.** FlickSmith can reject the recognizable generic AI-ad pattern: repeated push-ins, equal shot lengths, transition spam, generic centered typography, weak narrative progression, weak audiovisual coordination, continuity breaks, synthetic-evidence overuse, and music-only sound. See `docs/human-crafted-creative-system.md`.
- **Professional finish.** Color/HDR intent and scope primitives, interchange/conform foundations, audio automation, and an isolated OpenFX host boundary are represented explicitly rather than hidden behind prompts.
- **Extensibility and review.** Permissioned SDK manifests, extension conformance, checkpoint/revision-anchored review threads, deterministic render cache keys, immutable version-matched worker contracts, and measured-hardware benchmark gates.
- **Chat portability.** `plugin.json`, `skills/flicksmith-setup/SKILL.md`, MCP tools, bootstrap/smoke scripts, and CI make the repository usable from execution-capable ChatGPT surfaces without depending on a specific editor UI.

## Why the work should not look like an AI ad

FlickSmith does not “humanize” work by adding random shake, noise, timing mistakes, or fake film grain. The craft system focuses on authored decisions: narrative progression, motivated camera movement, purposeful cuts, brand-specific composition and typography, varied information-driven pacing, tactile sound, continuity, authentic evidence, and local repair. Normal v3 MCP clients can call `plan_human_craft_v3` and `review_human_craft_v3` directly.

## Quick start for Work, Codex, or a local terminal

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
npm install
bash scripts/bootstrap-chatgpt.sh
bash scripts/smoke-chatgpt.sh
npm run verify
```

Run the v3 MCP server against a project:

```bash
FLICKSMITH_PROJECT="$PWD/project.flick.json" \
FLICKSMITH_MEDIA_ROOTS="$PWD" \
node --experimental-strip-types apps/mcp/src/server.ts
```

Requirements for the base Node workflow are Node.js 22+ and FFmpeg/FFprobe on `PATH`. Rust/native, GPU, OpenCV, OCIO, OpenFX, and codec capabilities are verified only in environments that actually provide them.

## Normal ChatGPT

A text-only chat cannot execute binaries on your computer. It can inspect the GitHub repository through a connected GitHub source, reason about FlickSmith projects, produce typed edit plans, and perform professional craft review. For actual rendering/edit execution, use ChatGPT Work/Codex or connect a deployed authenticated FlickSmith plugin backend. The local HTTP MCP server intentionally binds loopback only. See `docs/chatgpt-portability.md`.

## Architecture

```text
media + licensed/generated assets
        ↓
active evidence + semantic search
        ↓
Coverage Graph → Director → typed CreativeActionPlan
        ↓
provider-neutral generation → staged acceptance → generated scene decomposition
        ↓
v3 typed operations + revisions + locks + receipts + checkpoints + Video Git
        ↓
native motion/compositing + color/audio/interchange boundaries
        ↓
technical QC + human-craft review → localized repair
        ↓
render cache / immutable workers → final render
```

## Safety and determinism

FlickSmith deliberately does not expose a generic shell/exec/eval MCP tool. Mutations are typed and revision-checked. Extension permissions are narrow. Credentials stay out of canonical project state. Generation is staged before acceptance. Render cache keys include pixel-affecting inputs. Worker compatibility is version checked. Performance claims require at least three measured samples on matching hardware and project hashes.

## Capability boundaries

FlickSmith v0.5 is designed to be unusually strong for agent-driven, editable commercial/product motion work. It does not claim that one release has more specialist depth than every mature NLE, compositor, color suite, DAW, or 3D package. Full local execution is available only where the environment provides the necessary filesystem/process/hardware capabilities, and optional native backends must pass their own verification gates.

The differentiator is the combination: professional editable structure, agent-safe typed control, generated-scene structure, provenance, revisions, collaboration anchors, deterministic rendering contracts, and a creative-quality system that can reject technically valid but generic AI-looking work.

## Development verification

```bash
npm run typecheck
npm test
npm run verify
```

CI also runs the clean-environment ChatGPT smoke gate. Native cross-platform verification remains in the native/desktop workflows.

## License

FlickSmith-owned code is Apache-2.0. See `THIRD_PARTY_LICENSES.md`, `docs/licensing/dependencies.md`, and `docs/security-v0.2.md` for third-party/runtime and security notes.
