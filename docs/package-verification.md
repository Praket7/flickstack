# FlickSmith v0.2 Desktop Package Verification

The desktop release pipeline builds unsigned Tauri 2 development artifacts on macOS, Windows, and Linux. Every CI build runs the produced native executable with `--smoke` before uploading the bundle. The smoke response reports detected FFmpeg/ffprobe versions, the configured GPU bridge, and that paid APIs are not required.

## Current runner

The current Linux execution runner does not have Cargo/Rust installed, so it cannot produce or launch a Tauri binary locally. `scripts/smoke-desktop-package.ts` records that as a machine-readable `blocked` result rather than treating the successful static frontend build as a native-package pass.

This means native packaging remains a release-environment verification requirement. The source, bundle configuration, cross-platform CI jobs, and executable smoke hook are present, but no claim of a locally verified installer is made from this runner.
