---
name: flicksmith-create
description: Create, direct, edit, review, and finish professional videos with FlickSmith. Use for commercials, social edits, explainers, cinematic promos, motion graphics, generated scene assets, and revision requests.
---

# FlickSmith Create

Treat FlickSmith as a professional editor, not an AI-effects generator.

## Creative standard

Before editing, identify the communication objective, audience, brand/product evidence, source-media strengths, emotional arc, delivery formats, and references. Build a specific visual grammar for this project. Do not default to glossy gradients, centered bold captions, constant push-ins, excessive parallax, speed ramps, glow, whooshes, or visible transitions merely because they are easy to generate.

Every shot must have a purpose. Every camera move must be motivated by subject, reveal, continuity, emphasis, or emotion. Cuts are the default transition. Vary shot length by information density and performance. Keep important text native and design a real hierarchy/grid. Use room tone, foley, dynamics, accents, and silence deliberately. Preserve plausible material and camera behavior. Never add random jitter or noise as fake humanity.

Prefer authentic or licensed source evidence when it satisfies the brief. Generate only genuine coverage gaps or deliberately synthetic art direction. Keep generation provenance visible.

Before final delivery, use the human-craft review and fix blocking issues. A technically valid render is not finished if it feels templated, repetitive, generic, or sonically thin.

## Normal Chat mode

If FlickSmith tools are not available in the current chat, still do useful professional work instead of pretending to render. Analyze uploaded media and references, write the brief, coverage plan, shot map, timing, motion grammar, sound plan, typography system, generated-asset prompts, responsive variants, and exact FlickSmith operations. Produce or update `.flick.json` when file creation is available. Clearly mark rendering or local media operations that require Work/Codex or an installed FlickSmith MCP runtime.

Do not claim a render ran when no execution tool ran.

## Work / Codex / MCP mode

When FlickSmith tools are available:

1. Call `get_timeline` before project mutations and retain the returned revision.
2. Inspect source evidence before generation. Use creative coverage planning when the request spans multiple shots.
3. Build a brand-specific craft direction.
4. Make typed, revision-checked operations. Respect Semantic Locks and preserve unrelated assets.
5. Use generated scene assets as native editable layers when possible. Flattened generated video is a fallback, not the default.
6. Run generated-scene QC, design/render diagnostics, and `review_human_craft` before delivery.
7. Repair only failed ranges/layers. Do not globally regenerate a project to fix a local issue.
8. Render requested aspect ratios and verify outputs.

For image generation, use the configured OpenAI generation provider when `OPENAI_API_KEY` is available. Credentials stay in environment variables and are never written into project files.

## Revision behavior

For requests such as "change the transition at 17 seconds" or "regenerate only the background," identify the exact composition/layer/generated asset, preserve unrelated hashes, apply the smallest typed mutation, and rerender only what is invalidated when the runtime supports caching.
