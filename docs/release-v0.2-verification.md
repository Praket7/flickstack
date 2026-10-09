# FlickSmith v0.2 Release Verification

**Release:** 0.2.0  
**Verification date:** 2026-10-08  
**Branch:** `feature/flicksmith-v0.2`

This report distinguishes verified behavior from environment-blocked native/GPU work. A blocked gate is not counted as a pass.

## Verified release gates

### TypeScript and complete project suite

- `npm run typecheck` → exit 0
- `npm test` → **144 tests passed, 0 failed, 0 skipped**
- The suite covers v1 and v2 schema/timeline behavior, RenderGraph, professional FFmpeg compositing/audio, multicam, local vision, spatial intelligence, durable jobs, Studio/MCP, migration, release security, package evidence, and end-to-end rendering.

### Canonical integration render

- `npm run test:integration` → **1/1 passed**
- Generated launch-ad deliverable:
  - duration: **14.998 s**
  - video: **H.264**, 640×360, 30 fps
  - audio: **AAC**, 48 kHz mono
  - size in verification run: **310,641 bytes**
- Integration validates evidence → coverage → branch/receipt → motion → final render → QC.

### Renderer equivalence

- `tests/e2e/renderer-equivalence-suite.test.ts` → **1/1 passed**
- Verified path: canonical RenderGraph timing and normal-alpha preview compositing against the FFmpeg reference renderer under the declared RGB/alpha tolerance.
- Undeclared approximations fail rather than silently degrading.
- The professional preview path now includes deterministic CPU parity for masks, transforms, color effects, transitions, and non-normal blending, plus production WebGPU/WGSL code behind the same RenderGraph contract.
- Correctness-first audio preview renders through the canonical v2 FFmpeg master mix and preserves the final export channel layout, preventing preview/final level drift.

### Migration and professional editor scenarios

The complete suite includes:

- v1→v2 compatibility with explicit-save semantics, pixel/timing equivalence, and preserved embedded audio.
- A ten-scenario professional v0.2 matrix covering layered PIP, real rectangle masks, nested compositions, within-clip speed ramps, cross-dissolves, encoded audio-bus gain, multicam sync/drift primitives, spatial locks, bounded active perception, and localized repair lanes.
- Real output tests for sidechain ducking and multicam materialization.

### Local perception

- `tests/acceptance/local-vision.test.ts` → **1/1 passed**
- FFmpeg generates a real PNG, then the same image is decoded to RGBA for local embedding.
- Tesseract **5.5.0** performs real local OCR in this runner.
- SQLite evidence provenance and source-hash invalidation are verified.

### Crash recovery

Process-boundary tests verify:

- a job process killed with `SIGKILL` is safely recovered through the durable SQLite scheduler and idempotency prevents duplicate output;
- a prepared project write killed before rename leaves the old JSON valid, orphan temp files are recoverable, and the later atomic commit produces the complete new file.

### Security and runtime audit

- Focused security suite → **5/5 passed**
- MCP catalogs contain no arbitrary shell/exec/raw-filesystem bypass.
- Local media import is restricted to permitted roots.
- Credential-shaped project/mutation fields are rejected before persistence/state change.
- Wikimedia download URLs are restricted to HTTPS on exactly `upload.wikimedia.org`.
- Root package has **no production npm runtime dependencies**.
- No paid API is required for the verified base editing/rendering path.

Runtime audit on this runner:

- FlickSmith-owned code: Apache-2.0
- FFmpeg: **7.1.5**, system-provided, not bundled by FlickSmith
- This installed FFmpeg binary is **GPL-enabled** (`--enable-gpl`), which is recorded rather than generalized to every FFmpeg build.
- Tesseract: external local runtime, version 5.5.0

See `THIRD_PARTY_LICENSES.md` and `docs/security-v0.2.md`.

### Desktop package evidence

Verified locally:

- package manifest covers macOS app/DMG, Windows NSIS/MSI, Linux AppImage/deb;
- static desktop `frontendDist` exists and is tested;
- native executable has a machine-readable `--smoke` path in source;
- cross-platform CI builds Tauri bundles and invokes the smoke verifier before upload.
- the desktop runtime build copies canonical source only and excludes test trees, preventing stale packaged copies from contaminating repository verification;
- the desktop shell owns a loopback MCP project session and uses revision-safe professional edit calls instead of requiring a separate manually started engine.

The local package-smoke report correctly records native verification as blocked on this runner because Cargo/Rust is unavailable.

## Environment-blocked gates

### Real WebGPU hardware benchmark — BLOCKED

The benchmark report records:

- scenario: `1080p30-two-layer-h264`
- codec: H.264
- proxy mode: off
- backend: WebGPU
- runner CPU: AMD EPYC 9V74

This runner cannot initialize a verified browser WebGPU adapter, so FPS, frame latency, seek latency, dropped-frame count, and cache-hit rate are **null**. No synthetic GPU performance number is substituted.

### Native Rust/Tauri compile/package — BLOCKED

`cargo` is not installed on this runner, so the following are **not claimed as locally verified**:

- Rust `wgpu` crate compilation/tests;
- Tauri native compilation;
- native installer launch on macOS/Windows/Linux.

The Rust/Tauri source, CI matrix, package manifest, and native smoke hook are present. A Rust-enabled release runner must execute those gates before claiming native installers as verified binaries.

## Release conclusion

The TypeScript/Node/FFmpeg v0.2 engine and its professional reference-render path are verified by the release suite. Local perception, migration, multicam primitives, crash recovery, security boundaries, and package-source/CI contracts are also verified on this runner. Real GPU hardware performance and locally built native desktop packages remain explicit environment-blocked verification items rather than release claims.
