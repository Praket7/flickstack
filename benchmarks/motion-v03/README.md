# FlickSmith v0.3 Motion Core benchmark evidence

This directory is intentionally split between **measured engine work** and **environment-blocked runtime work**.

`run.ts` measures deterministic scene-graph evaluation for an editable FlickSmith motion component. It exercises layer traversal, animated properties, behavior sampling, text/layout evaluation, and scene construction. The resulting `framesPerSecond` is **scene-graph evaluation throughput**, not decoded-video playback FPS and not a GPU-rendering claim.

## Hardware/runtime status

- **CPU scene-graph evaluation:** measured by `run.ts` and recorded in `current.json` with platform, CPU, Node version, frame count, elapsed time, and throughput.
- **WebGPU live-preview performance:** **blocked** in this release runner because no verified WebGPU adapter/hardware preview context is available to this benchmark. GPU FPS remains `null`; FlickSmith does not substitute software numbers or synthetic values.
- **Cargo/Rust/native desktop toolchain:** reported directly by the harness. If Cargo is absent, native Tauri/wgpu compilation remains **blocked**. If Cargo is present, the report says `available-unverified` until a real package build/smoke run succeeds.

## Benchmark scenarios for hardware runners

A hardware release runner should record p50/p95 frame time, dropped frames, adaptive preview quality, memory, and device-loss recovery for at least these cases at 1080p and 4K where supported:

1. 1,000 animated glyph clusters with per-word selectors.
2. 200 vector/mask layers with gradients and transforms.
3. 20 blur/glow/composite nodes plus motion blur.
4. UI motion with 2.5D camera, shared-element transitions, and tracked overlays.
5. Audio-reactive motion driven by cached beat/envelope analysis.
6. Responsive conversion of the same composition across 16:9, 9:16, 4:5, and 1:1.

A release must record unsupported scenarios as `blocked` or `unsupported`, never as zero-cost success.
