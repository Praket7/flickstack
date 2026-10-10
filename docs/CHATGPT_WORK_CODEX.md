# Using FlickSmith from ChatGPT, Work, and Codex

FlickSmith v0.5 is packaged so the same repository can serve three surfaces without pretending they have identical execution privileges.

## 1. Normal ChatGPT chat

Normal Chat is the creative-control surface. Install/use the `flicksmith-create` skill when available. It can analyze uploads and references, create a brief, coverage plan, storyboard, shot timing, motion grammar, sound plan, typography system, generated-asset prompts, responsive variants, QC plan, and exact FlickSmith operations.

A normal chat that does **not** have a shell, writable repository, or connected FlickSmith MCP server cannot truthfully run FFmpeg/Rust or render a local MP4. In that case it should still produce an editable `.flick.json`/operation plan when file tools are available, then hand the render to Work/Codex or a connected FlickSmith runtime. Do not claim a render ran when it did not.

If a deployed/connected FlickSmith MCP server is available, ChatGPT can use the same tools directly.

## 2. ChatGPT Work

Work is the recommended ChatGPT surface for end-to-end creation because it can operate across files and longer workflows. The portable plugin contains `plugin.json`, `mcp.json`, and `skills/`.

For a workspace/sandbox that has this repository available:

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
bash scripts/bootstrap-chatgpt.sh
```

Set the active project for the stdio MCP runtime:

```bash
export FLICKSMITH_PROJECT=/absolute/path/to/project.flick.json
# Optional cloud image generation
export OPENAI_API_KEY=...
```

The portable `mcp.json` starts `apps/mcp/src/mcp-stdio.ts` with Node. The server exposes the v3 editing/motion tools, generation lifecycle, generated-scene tools, creative planning helpers, and human-craft review.

If Work is running in a hosted environment without the repository/dependencies, connect a deployed FlickSmith HTTP MCP server or use a self-hosted/connected environment. Installing a skill alone does not magically provide FFmpeg, local media, GPU, or arbitrary process execution.

## 3. Codex / local development

Clone and bootstrap exactly as above. Codex is useful when you are modifying FlickSmith itself, debugging render code, or working directly in the repository. It is not required just to direct an edit when the FlickSmith plugin/runtime is already available.

The repo-local plugin marketplace is in `.agents/plugins/marketplace.json`. The portable root manifest is `plugin.json` and the MCP declaration is `mcp.json`.

## 4. Verify a clean checkout

```bash
bash scripts/smoke-chatgpt.sh
```

The smoke gate runs the full TypeScript verification suite, checks the CLI, creates a fresh v3 project, and validates that the project can be opened from a clean checkout. CI runs this gate on every push/PR.

For native Rust verification:

```bash
cargo fmt --all -- --check
cargo check --workspace
cargo test --workspace
```

## 5. Creative quality requirement

Before final delivery, run the human-craft review. FlickSmith intentionally rejects the repeated visual language associated with generic AI ads: mechanical equal-length pacing, constant push-ins, transition spam, generic centered captions, weak sound design, and styling that is not derived from the actual brand/product/story.

This is a quality gate, not provenance evasion. Generated assets remain tagged with their provider/model/inputs/rights metadata.
