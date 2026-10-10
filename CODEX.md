# FlickSmith for Codex and ChatGPT Work

Use this path when the agent has a shell, repository access, and local files.

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
npm install
bash scripts/bootstrap-chatgpt.sh
bash scripts/smoke-chatgpt.sh
npm run verify
```

For a v3 project, start the MCP server from the project directory:

```bash
FLICKSMITH_PROJECT="$PWD/project.flick.json" \
FLICKSMITH_MEDIA_ROOTS="$PWD" \
node --experimental-strip-types apps/mcp/src/server.ts
```

The canonical artifact is `project.flick.json`. Use v3 typed operations and expected revisions. Do not bypass FlickSmith with an unrelated video framework. Search/coverage comes before generation. Keep generation provenance. Convert generated stills to editable scenes where possible. Run technical QC plus `review_human_craft_v3` before delivery.

For professional ads, read `docs/human-crafted-creative-system.md`. Avoid generic AI-ad defaults. Build a brand-specific motion grammar, narrative arc, typography system, shot logic, continuity, and sound design. Motion is earned by story or subject.

Before declaring success, run `npm run verify`, verify the rendered output with FFprobe, and run any relevant native Rust/GPU gates on hardware that actually provides those capabilities. Do not invent performance numbers or capability claims.
