# FlickSmith v0.2 Third-Party Runtime and Distribution Notes

FlickSmith-owned source code is licensed under Apache-2.0. This file records third-party components that matter to the v0.2 runtime/distribution boundary. It is not a substitute for the license files of those projects.

## System FFmpeg / ffprobe

FlickSmith invokes `ffmpeg` and `ffprobe` as external processes. The v0.2 desktop package manifest uses the policy `system-provided`; the base package does **not** bundle an FFmpeg binary.

FFmpeg's effective license depends on how a particular binary is configured. The release runner used for v0.2 verification reports FFmpeg 7.1.5 with `--enable-gpl`, so that installed binary is GPL-enabled. This does not change FlickSmith-owned source from Apache-2.0, but any distributor that chooses to bundle an FFmpeg build must comply with that exact build's licenses and source/notice obligations. FlickSmith must never label every FFmpeg build as MIT, Apache, or uniformly LGPL.

## Tesseract OCR

Tesseract is an optional external local executable, not bundled by the base package. Upstream Tesseract source is Apache-2.0. Language/model data is installed separately and its provenance must be reviewed by a distributor or user. FlickSmith records OCR evidence provider/model metadata rather than treating local language data as FlickSmith-owned.

## Rust native dependencies

The checked-in direct Rust manifests reference:

- Tauri 2 / tauri-build
- serde / serde_json
- windows-sys on Windows
- wgpu 30.0.1
- pollster 0.4

These projects use permissive open-source licensing in their upstream distributions, but the current release runner has no Cargo toolchain and therefore cannot resolve the full transitive crate graph or generate a lockfile-derived third-party report. A Rust-enabled release job must generate and archive the exact resolved dependency/license inventory before distributing native binaries.

## Node runtime dependencies

The root `package.json` has no production `dependencies`. TypeScript and `@types/node` are development dependencies and are not a runtime subscription/service requirement.

## Local AI/model runtimes

FlickSmith v0.2 bundles no mandatory foundation-model weights. Optional ONNX, llama.cpp, Ollama, or other local adapters must treat runtime licenses and model-weight licenses as separate records. A runtime's permissive license does not grant permission to redistribute arbitrary weights.

## Internet media

Wikimedia Commons integration records per-asset creator, original URL, license, commercial-use status, attribution requirement, and retrieval time. Unknown or insufficient rights block automatic inclusion. Download URLs are restricted to HTTPS on `upload.wikimedia.org`; generic arbitrary remote URL download is not exposed as an MCP tool.

## OpenCV tracking backend (v0.4 optional)

FlickSmith v0.4 includes an optional native point/planar tracking backend behind the Rust feature `flick-tracking-opencv/opencv-backend`. The base editor and default Rust workspace build do not require OpenCV; when the native library is absent, the solver reports an explicit unavailable capability and existing tracking records remain readable/interpolatable.

- OpenCV 4.5.0 and newer are Apache-2.0 licensed. The v0.4 backend targets supported OpenCV 4.x/5.x installations and does not bundle OpenCV in the base package.
- The `opencv` Rust bindings (`opencv` crate 0.101.x) are MIT licensed.
- Distributors enabling the backend must record the exact OpenCV build/version and any optional codec/system dependencies supplied by that build. FlickSmith does not treat system media codecs pulled in by a platform OpenCV package as FlickSmith-owned dependencies.

## FlickSmith v0.4 native motion/rendering dependencies

v0.4 adds or promotes the following native components. Distributors must use the exact resolved Cargo graph and upstream license files as the authoritative record for a binary build.

- **Parley 0.11.x** — rich text layout. Parley is dual-licensed Apache-2.0 OR MIT upstream. It depends on the Linebender text stack, including **HarfRust** for text shaping, **Fontique** for font discovery/cache, **Skrifa** for OpenType/TrueType metrics/outlines, and ICU4X-related Unicode support through its dependency graph. FlickSmith does not redistribute third-party fonts merely because the shaping engine can discover them on a system.
- **Vello CPU** — deterministic CPU vector/glyph raster reference backend. The Linebender Vello family is dual-licensed Apache-2.0 OR MIT upstream.
- **wgpu 30.0.1** — GPU abstraction used by the native compositor. wgpu and its gfx-rs dependency family use permissive upstream licensing; the resolved lockfile/native package report is required before binary redistribution.
- **pollster / bytemuck / regex / serde / thiserror** — Rust runtime/support crates used by native rendering, project contracts and safe text selectors. See the generated Cargo inventory for exact versions and licenses.
- **OpenCV** remains optional and system-provided for native tracking. The base desktop package does not bundle OpenCV. See the dedicated OpenCV section above.

### Hybrid GPU compositor disclosure

The v0.4 `wgpu` compositor performs real GPU texture allocation, ordered premultiplied-alpha composition, command submission and framebuffer readback. Vector and shaped-text primitives are currently rasterized per layer by the deterministic CPU reference rasterizer before being uploaded for GPU composition. This architecture must not be described as full GPU vector/glyph rasterization.

### Color-management boundary

v0.4 performs its internal reference compositing with scene-linear premultiplied RGBA semantics. OpenColorIO/ACES remains capability-gated unless a future build links and verifies a real non-stub OCIO implementation. Merely storing OCIO/ACES metadata does not constitute pixel processing.
