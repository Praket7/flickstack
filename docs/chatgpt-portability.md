# Using FlickSmith from ChatGPT, Work, and Codex

FlickSmith ships a root `plugin.json`, an onboarding skill, MCP tools, and deterministic bootstrap/smoke scripts. The project format and tool contract are the same across clients, but the amount of execution authority depends on the ChatGPT surface.

## Normal ChatGPT

A normal text chat cannot clone a repository into your computer, launch Node, run FFmpeg/Rust, access your local media, or render through your GPU by itself. That operating-system boundary is real.

There are two useful normal-chat paths:

1. **Repository/source work.** Connect GitHub, point the chat at `Praket7/flickstack`, and ask it to inspect the source, plan edits, review projects, or prepare typed operations. To obtain the source yourself, open the GitHub repository and use **Code → Download ZIP**, or download a release/source archive if one is published.
2. **Connected FlickSmith backend.** Connect a deployed FlickSmith plugin/MCP backend. The v3 tool surface supports revision-safe editing, native motion authoring, rendering diagnostics, and the chat-facing `plan_human_craft_v3` / `review_human_craft_v3` professional craft tools. A production remote backend must add HTTPS authentication, tenant isolation, media storage, quotas, job isolation, and secrets management. The local desktop HTTP server intentionally binds loopback only and should not be exposed directly to the internet.

Normal chat is therefore strong for creative direction, project reasoning, typed edit planning, professional craft review, and connected-backend operation. Full local media execution requires Work/Codex or another execution-capable environment.

## ChatGPT Work or Codex

These surfaces can use the repository directly when they have shell/filesystem access:

```bash
git clone https://github.com/Praket7/flickstack.git
cd flickstack
npm install
bash scripts/bootstrap-chatgpt.sh
bash scripts/smoke-chatgpt.sh
npm run verify
```

Then start FlickSmith against a project:

```bash
FLICKSMITH_PROJECT="$PWD/project.flick.json" \
FLICKSMITH_MEDIA_ROOTS="$PWD" \
node --experimental-strip-types apps/mcp/src/server.ts
```

Read `AGENTS.md`, `CODEX.md`, `plugin.json`, and `docs/human-crafted-creative-system.md` before production work. Keep `project.flick.json` canonical. Use typed operations, revisions, checkpoints, Semantic Locks, Intent Receipts, generation provenance, QC, localized repair, and the human-craft gate.

## Clean-environment verification

`bash scripts/smoke-chatgpt.sh` is the portability gate. CI installs Node and FFmpeg, runs `npm install`, `npm run verify`, and the smoke script. Native Rust, OpenCV, OCIO, OpenFX, codec, and GPU claims must only be made when the corresponding environment and workflow actually verify them.

## Why the capability split exists

A skill or plugin manifest can teach ChatGPT how to operate FlickSmith, but it cannot grant a text-only chat arbitrary access to your operating system. FlickSmith keeps that boundary explicit rather than pretending local rendering happened when it did not.
