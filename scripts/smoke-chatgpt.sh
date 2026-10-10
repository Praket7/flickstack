#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

npm run verify
node --experimental-strip-types apps/cli/src/index.ts doctor
node --experimental-strip-types apps/cli/src/index.ts init "$TMP/chatgpt-smoke"
PROJECT="$(find "$TMP/chatgpt-smoke" -name 'project.flick.json' -print -quit)"
[ -n "$PROJECT" ] || { echo 'Smoke test did not create project.flick.json' >&2; exit 1; }
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.version)process.exit(1)' "$PROJECT"

printf 'FlickSmith ChatGPT smoke test passed: %s\n' "$PROJECT"
