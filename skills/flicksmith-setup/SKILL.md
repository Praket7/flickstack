---
name: flicksmith-setup
description: Set up and verify FlickSmith from a GitHub checkout in an execution-capable ChatGPT environment before professional video work.
---

# FlickSmith setup

Use the repository checkout as the source of truth. Do not substitute a slideshow, React video framework, or ad-hoc FFmpeg composition for FlickSmith's canonical project model.

1. Read `AGENTS.md`, `CODEX.md`, `README.md`, `plugin.json`, `docs/chatgpt-portability.md`, and `docs/human-crafted-creative-system.md`.
2. Run `bash scripts/bootstrap-chatgpt.sh`. If the environment cannot install a dependency, report the exact missing capability rather than pretending setup succeeded.
3. Run `bash scripts/smoke-chatgpt.sh` and require a zero exit code.
4. Keep `project.flick.json` canonical. Use typed operations, expected revisions, checkpoints, Semantic Locks, Intent Receipts, generation provenance, QC, review anchors, and repair lanes.
5. Search evidence and resolve coverage debt before generation. Prefer editable generated scenes over flattened generated video.
6. For professional ads, build a brand-specific craft direction and run `review_human_craft_v3`. Do not fake humanity with random jitter or noise.
7. Prefer the native v3 renderer for v3 projects. FFmpeg remains a media boundary/fallback where FlickSmith explicitly uses it.
8. Before claiming completion, run `npm run verify`, verify requested outputs with FFprobe, and run relevant native gates on hardware that actually provides them.
9. Never claim unavailable hardware, codec, OpenCV, OCIO, OpenFX, GPU, or performance capabilities as working. Surface diagnostics instead.

This skill is intended for ChatGPT Work, Codex, or another execution-capable environment. Plain text-only ChatGPT cannot execute a GitHub repository by itself; use the connected MCP/plugin surface for tool execution or move the task to Work/Codex.
