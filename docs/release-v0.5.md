# FlickSmith v0.5 release acceptance

v0.5 is the agent/creative-platform layer over the verified v0.4 native/product base. It includes the unified v3 agent runtime, provider-neutral generation, Generated Scene Assets, creative orchestration, professional finish foundations, human-craft review, permissioned extensions, collaboration anchors, render cache/worker contracts, measured-performance gates, and ChatGPT/Work/Codex portability.

## Required normal CI gates

- `npm run typecheck`
- `npm test`
- `npm run verify`
- `bash scripts/smoke-chatgpt.sh`
- v3 MCP routing including generation, generated scenes, native motion, render diagnostics, and human-craft tools
- no live paid model credential required in CI

## Capability-specific gates

Rust/native render, OpenCV, hardware GPU, platform packaging, OpenFX plugin execution, OCIO transforms, and codec-specific behavior are only claimed when the corresponding workflow/environment verifies them. Performance claims require at least three measured samples on matching hardware, renderer version, and benchmark project.

## Creative acceptance

A technically valid ad is not automatically release-quality. Production work should pass `review_human_craft_v3` or the equivalent `creative-quality` API. Blocking failures include generic template repetition, unmotivated motion, weak sound, generic brand language, and narrative flatness. Continuity, audiovisual coordination, pacing, typography, and synthetic-evidence ratio are explicit review dimensions. Repairs should be localized.
