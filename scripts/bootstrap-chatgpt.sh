#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail(){ printf 'FlickSmith bootstrap: %s\n' "$*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail 'Node.js 22+ is required.'
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js 22+ is required; found $(node -v)."
command -v npm >/dev/null 2>&1 || fail 'npm is required.'
command -v ffmpeg >/dev/null 2>&1 || fail 'FFmpeg is required on PATH.'
command -v ffprobe >/dev/null 2>&1 || fail 'FFprobe is required on PATH.'

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run typecheck
node --experimental-strip-types apps/cli/src/index.ts doctor

if command -v cargo >/dev/null 2>&1; then
  cargo check --workspace
else
  printf 'FlickSmith bootstrap: Rust/Cargo not present; TypeScript/FFmpeg path is available, native Rust verification must run in CI or another Rust-capable environment.\n' >&2
fi

printf 'FlickSmith bootstrap complete.\n'
