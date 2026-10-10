# Running FlickSmith from ChatGPT without Codex

FlickSmith is packaged as a portable Agent Plugin at the repository root (`plugin.json`) and includes an onboarding skill plus deterministic bootstrap/smoke scripts.

## Supported path: ChatGPT with an execution environment

A ChatGPT execution-capable surface can clone/download this repository, run `bash scripts/bootstrap-chatgpt.sh`, then run `bash scripts/smoke-chatgpt.sh`. After the smoke gate passes, the chat can operate FlickSmith through its CLI/project APIs and preserve `project.flick.json` as the canonical editable artifact. This path does not require the Codex product.

## Repository marketplace

The repository includes `.agents/plugins/marketplace.json` so supported ChatGPT desktop/Work environments can discover the FlickSmith package from a repository checkout. The root `plugin.json` is the portable Agent Plugins manifest.

## Plain Chat limitation

A text-only ChatGPT conversation does not automatically receive an operating-system process runner, Node.js, FFmpeg, Rust, GPU access, or arbitrary GitHub execution merely because a repository URL is pasted into chat. Skills can teach a model how to use FlickSmith, but skills alone cannot execute the renderer.

For full FlickSmith capabilities in a ChatGPT conversation that has no local execution environment, deploy FlickSmith's tool surface behind a stable HTTPS plugin backend and connect it as a ChatGPT plugin. The repository's local MCP transport is deliberately loopback-only for desktop safety; a production remote service must add authentication, tenant isolation, media storage, quotas, and job isolation before exposing rendering over the internet.

This distinction is intentional: the repository is portable, but execution capabilities must come from either the ChatGPT environment or a deployed backend. No documentation should claim that an ordinary text-only chat can execute local binaries by itself.
