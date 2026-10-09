# FlickSmith v0.2 Security and Trust Boundaries

## Project data and credentials

`project.flick.json` is creative/project state, not a credential store. Both v1 and v2 serializers recursively reject credential-shaped fields such as API keys, access/refresh tokens, authorization values, passwords, client secrets, bearer tokens, and private keys. Optional provider credentials must stay in process/user configuration outside project JSON, receipts, and release fixtures.

## MCP and agent tools

The MCP catalogs expose typed editing, analysis, rendering, branching, preview, and QC operations. They do not expose arbitrary shell execution, generic command execution, or raw read/write filesystem tools. The HTTP MCP transport binds only to loopback and accepts only the configured `/mcp` POST endpoint with bounded request size. Unknown tools fail closed.

Every project mutation flows through the canonical typed engine with revision/checkpoint/receipt behavior. Desktop/UI and agent writes therefore share conflict detection instead of racing through separate state stores.

## Filesystem and subprocesses

Local media import is restricted to configured permitted roots. URL-shaped strings and paths outside those roots are rejected before probing. The desktop process bridge uses absolute executable allowlists, argv arrays (no shell interpolation), canonical working-root checks, timeout/cancellation, and bounded output.

Project saves use prepared temp files, fsync, atomic replacement, and orphan recovery. Durable job recovery is backed by SQLite and idempotency keys so interrupted work can be retried without duplicating completed output.

## Remote media / SSRF

FlickSmith has no generic remote-URL import MCP tool. The Wikimedia provider constructs its API endpoint internally at `https://commons.wikimedia.org/`; it does not accept an arbitrary API base URL. Asset downloads are accepted only when the final URL is HTTPS and the hostname is exactly `upload.wikimedia.org`. Link-local, localhost, alternate-host, and caller-mutated arbitrary URLs are rejected before fetch or file write.

## Rendering and generated content

The canonical timeline/render graph is structured data. MCP does not receive a code-evaluation or shell escape path. Motion/effect generation is constrained to typed graph/component data; the existing motion source validator rejects imports, `require`, `eval`, `new Function`, network primitives, child processes, and filesystem primitives.

Final FFmpeg renders use constructed argument arrays. FFmpeg remains an external compatibility renderer, and files are written to caller-authorized paths rather than overwriting source media.

## Local perception

Perception evidence records provider, model, version, confidence, source hash, and time range. Source-hash changes invalidate stale evidence. Anonymous tracking evidence is not real-world identity. Optional visual/OCR runtimes report unavailable rather than forcing cloud upload.

## Distribution / dependency boundary

The base desktop manifest uses system-provided FFmpeg. The current verification runner's FFmpeg is GPL-enabled, which is recorded by `scripts/audit-runtime-deps.ts`; it is not bundled into FlickSmith artifacts produced here. Tesseract is also external. The runner has no Cargo/Rust toolchain, so native Rust/Tauri compilation and transitive native-license resolution remain explicit release-environment verification requirements.

## Automated release checks

`tests/security/tool-surface.test.ts` verifies the MCP tool surface, permitted-root URL rejection, secret-field serialization rejection, and runtime dependency policy. `packages/providers/src/wikimedia.test.ts` verifies remote download host restrictions. `scripts/audit-runtime-deps.ts` emits a machine-readable runtime audit used by release verification.
