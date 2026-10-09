# Dependency and media licensing

FlickSmith-owned source code is Apache-2.0.

## FFmpeg

FlickSmith executes the `ffmpeg` and `ffprobe` binaries as external processes. FFmpeg licensing depends on how the installed binary was configured. Much of FFmpeg is LGPL, while enabling GPL components can make a distributed FFmpeg build GPL. FlickSmith does not assume that every FFmpeg binary has the same license configuration. Distributors are responsible for complying with the exact binary they ship.

## Local models

Runtime licenses and model-weight licenses are separate. A permissively licensed local inference runtime does not make every model weight permissively licensed. FlickSmith adapters must surface model identity and license information rather than silently treating all weights as equivalent.

## Remotion

Remotion is not required by FlickSmith and is not part of the base renderer. It may be supported later as an optional adapter. This keeps the base architecture independent from Remotion licensing and React-code-as-source-of-truth assumptions.

## Internet media

Public availability is not treated as reuse permission. Provider records retain original URL, provider, creator, license, commercial-use status, attribution requirement, and retrieval time. When rights are unresolved, automatic inclusion is blocked.

## v0.2 native desktop and GPU path

The v0.2 source includes Tauri 2 and a native `wgpu` adapter. Their Rust dependency tree must be audited from Cargo-resolved metadata on the native build runner. The current execution environment does not have Cargo installed, so this repository does not claim a locally verified native dependency resolution here.

## Current runner evidence

`node --experimental-strip-types scripts/audit-runtime-deps.ts` reports the exact external runtime state used for release verification. On the current runner, FFmpeg is system-provided and GPL-enabled, Tesseract is external and available, no runtime npm dependencies are declared, and the Rust toolchain is unavailable.
