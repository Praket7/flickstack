# FlickSmith

**Agent-native professional video creation.** FlickSmith keeps the edit as structured project data, lets agents make typed/reversible operations, and preserves provenance, checkpoints, locks, reviews, and render intent instead of flattening every AI operation into an MP4.

The v0.5 platform layer builds on the verified v0.4 native motion/render core and adds generated scene assets, creative orchestration, professional finishing foundations, human-craft QC, extensibility/collaboration/performance infrastructure, and portable ChatGPT/Work/Codex tooling.

## Why it is different

- **Structured before flattened.** Generated stills can become RGBA/depth scene layers, native cameras, transforms, masks, and editable motion.
- **One canonical project.** `project.flick.json` is the source of truth across CLI, Studio, MCP/agents, Work, and Codex.
- **Agent-safe editing.** Mutations are typed, revision checked, checkpointed, reversible, and compatible with Semantic Locks and Intent Receipts.
- **Evidence before generation.** Coverage planning prefers authentic/licensed source media and generates only justified gaps.
- **Human-craft release gate.** FlickSmith checks for template repetition, decorative motion, transition spam, mechanical pacing, generic typography, weak sound design, and insufficient brand-specific choices.
- **Professional finishing foundations.** Color transforms/scopes/HDR metadata, OTIO-preserving interchange, FCPXML/EDL export, relink diagnostics, audio automation/repair planning, and isolated OpenFX execution boundaries.
- **Platform, not a closed editor.** Permissioned extensions, review anchors/approvals, semantic render caching, immutable render-worker jobs, and measured-hardware benchmark rules.

## Quick start

Requirements are checked by the bootstrap script. Node 22+ and FFmpeg are the main TypeScript/runtime dependencies. Native Rust verification uses Rust 1.88+.

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
bash scripts/bootstrap-chatgpt.sh
```

Create a project:

```bash
node --experimental-strip-types apps/cli/src/index.ts init ./my-video
```

Verify the repository:

```bash
npm run verify
bash scripts/smoke-chatgpt.sh
```

Native verification:

```bash
cargo fmt --all -- --check
cargo check --workspace
cargo test --workspace
```

## ChatGPT, Work, and Codex

FlickSmith ships a portable plugin manifest (`plugin.json`), a local stdio MCP declaration (`mcp.json`), and reusable skills under `skills/`.

For Work/Codex or another execution-capable environment, point the runtime at the active project:

```bash
export FLICKSMITH_PROJECT=/absolute/path/to/project.flick.json
# Optional OpenAI image generation
export OPENAI_API_KEY=...
```

`apps/mcp/src/mcp-stdio.ts` exposes the v3 motion/editing tools, generation lifecycle, generated-scene tools, creative planning helpers, and human-craft review over MCP without requiring the Codex UI.

A normal ChatGPT conversation without shell/filesystem/process access can still use the FlickSmith skill for professional briefs, coverage plans, shot maps, motion grammar, sound design, typography, generation prompts, responsive variants, QC, and exact operation plans. Rendering requires an execution-capable Work/Codex environment or a connected/deployed FlickSmith MCP runtime. FlickSmith never claims a render ran when it did not.

Full setup details: `docs/CHATGPT_WORK_CODEX.md`.

## v0.5 stages

- **v0.5a** — Unified V3 Agent Runtime
- **v0.5b** — Generative Provider Runtime & Provenance
- **v0.5c** — Generated Scene Assets
- **v0.5d** — Creative Orchestration
- **v0.5e** — Professional Finish & Interchange foundations
- **v0.5f** — Extensibility, Collaboration & Performance platform

Release notes: `docs/releases/v0.5-platform.md`.

## Human-crafted creative quality

The goal is not to hide AI provenance. Generated assets stay traceable. The goal is to avoid the generic visual language that makes many AI ads feel instantly synthetic.

FlickSmith's creative rules prefer motivated camera movement, cuts over transition spam, shot durations shaped by information/performance, native editorial typography, real sound design, continuity, and brand-specific visual grammar. Random jitter/noise is not considered “humanization.” See `docs/research/human-crafted-video-quality.md`.

## Project model

The v3 project format includes professional motion compositions, cameras, masks/mattes, compositing graphs, responsive variants, generated-scene/provenance records, checkpoints, and revision-safe operations. Generated video can still be used when true temporal synthesis is required, but flattened generation is explicitly marked and does not satisfy the native-editability gate.

## Security

- Credentials remain in environment variables or opaque handles and are never serialized into project files.
- Provider failures/cancellations do not mutate canonical project state.
- Extensions have narrow declared permissions and no general shell/project-write authority.
- OpenFX execution is isolated from the editor process.
- Accepted generated assets are content-addressed and provenance tracked.

## Performance claims

FlickSmith does not claim workstation/GPU performance from generic CI. Benchmark claims require at least three measured samples on a matching hardware fingerprint. Render-cache keys include render program, asset hashes, renderer/backend, plugins, color config, fonts, quality, and output format.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
