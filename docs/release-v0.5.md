# FlickSmith v0.5 release acceptance

v0.5 is the professional agent/creative-platform layer over the verified v0.4 native render engine. The public product identity is `0.5.0`; the native v0.4 engine version remains explicit so renderer compatibility is never disguised.

## Included capability stages

- **v0.5a:** unified v3 agent runtime with typed reversible edits, revisions, receipts, locks, checkpoints, undo/redo, cameras, compositing, rigs and responsive variants.
- **v0.5b:** provider-neutral transactional generation with cancellation, budgets, rights/provenance, content-addressed acceptance and conversational image generation.
- **v0.5c:** Generated Scene Assets with RGBA/depth/clean-plate routing, native editable layers, 2.5D cameras and QC.
- **v0.5d:** evidence-first Director/Coverage Graph orchestration, resumable action plans, aspect variants and localized repair.
- **v0.5e:** managed SDR/HDR color, explicit OCIO bridge, scopes, OTIO/FCPXML/EDL, relink diagnostics, audio automation/repair and isolated OpenFX hosting.
- **v0.5f:** permissioned SDK, revision-anchored collaboration, semantic render caching, immutable render workers and measured hardware benchmark gates.
- **Human-craft system:** brand-specific visual grammar, evidence-first generation, editorial rhythm, restrained motivated motion, native typography, sound design, continuity and synthetic-evidence review to reduce generic AI-ad styling.

## Execution modes

### Normal ChatGPT

Normal ChatGPT does not need repository shell access when it is connected to a deployed FlickSmith backend. Deploy the repository on a Node 22+ host, place TLS in front of it, set a long random `FLICKSMITH_REMOTE_TOKEN`, configure `FLICKSMITH_ALLOWED_ORIGINS`, and run:

```bash
npm install
npm run mcp:remote
```

The remote server exposes `/healthz` and authenticated `/mcp`. It rejects unauthenticated calls, disallowed browser origins and oversized request bodies. Do not expose the desktop loopback transport to the internet.

### ChatGPT Work / Codex / terminal-capable agents

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
npm install
npm run verify
bash scripts/bootstrap-agent.sh
bash scripts/smoke-chatgpt.sh
```

These environments can use local media, FFmpeg/native rendering and repository tools directly. Codex is useful for developing FlickSmith but is not required to use a deployed FlickSmith backend from ChatGPT.

## Required release gates

- `npm run typecheck`
- `npm test`
- `npm run verify`
- `bash scripts/smoke-chatgpt.sh`
- remote MCP authentication/origin tests
- v3 routing including generation, generated scenes, native motion, render diagnostics and human-craft tools
- native Rust format, clippy and workspace tests
- cross-platform desktop packaging
- no live paid model credential required in CI

## Capability honesty

OpenColorIO, OpenFX plugins, OpenCV tracking, GPU hardware paths and codec-specific behavior are only claimed when the corresponding runtime is present. Built-in color transforms remain deterministic when OCIO is absent. Performance claims require at least three measured samples on matching hardware, renderer version and benchmark project.

## Creative acceptance

A technically valid ad is not automatically release-quality. Production work should pass `review_human_craft_v3` or the equivalent creative-quality API. Blocking failures include generic template repetition, unmotivated motion, weak sound, generic brand language, excessive synthetic evidence and narrative flatness. Continuity, audiovisual coordination, pacing and typography are explicit review dimensions, and repairs should remain localized.
