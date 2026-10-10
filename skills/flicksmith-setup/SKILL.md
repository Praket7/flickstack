---
name: flicksmith-setup
description: Set up and verify FlickSmith from a GitHub checkout in a ChatGPT execution environment before video work.
---

# FlickSmith setup

Use the repository checkout as the source of truth. Do not substitute a slideshow, React video framework, or ad-hoc FFmpeg composition for FlickSmith's canonical project model.

1. Read `AGENTS.md`, `README.md`, `plugin.json`, and `docs/chatgpt-portability.md`.
2. Run `bash scripts/bootstrap-chatgpt.sh`. If the environment cannot install a system dependency, report the exact missing capability rather than pretending setup succeeded.
3. Run `bash scripts/smoke-chatgpt.sh` and require a zero exit code.
4. For project work, keep `project.flick.json` canonical. Use typed operations, revisions, checkpoints, semantic locks, intent receipts, generation provenance, QC, and repair lanes.
5. Prefer the native v3 renderer for v3 projects. FFmpeg remains a media boundary/fallback where FlickSmith explicitly uses it.
6. Before claiming completion, run `npm run verify` and verify the requested output with FFprobe. Native Rust gates must be verified in an environment with Rust/Cargo.
7. Never claim unavailable hardware, codec, OpenCV, OCIO, OpenFX, or GPU capabilities as working. Surface capability diagnostics instead.

This skill is intentionally usable by ChatGPT Work or another execution-capable ChatGPT environment. A plain text-only chat cannot execute a GitHub repository by itself; use an execution-capable ChatGPT surface or a deployed FlickSmith plugin backend.
