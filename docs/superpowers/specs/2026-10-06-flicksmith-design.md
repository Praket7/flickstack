# FlickSmith Architecture Specification

## Product
**Name:** FlickSmith  
**Tagline:** The agent-native video editor.  
**License:** Apache-2.0 for FlickSmith-owned code.

## Goal
Build a local-first, agent-native video editor that can be driven directly by Codex, Claude Code, or any MCP client. It must require no paid APIs, subscriptions, cloud services, or proprietary editing software for its base workflow.

Users point FlickSmith at local footage and ask for outcomes such as a polished launch ad, product demo, talking-head edit, or short-form clip. They can then issue granular revisions without rebuilding the whole project.

## Product thesis
FlickSmith is not a Premiere clone with chat bolted on and not a React-video framework. Its source of truth is a typed, deterministic, serializable timeline and media graph.

The host agent reasons about intent. FlickSmith provides validated media understanding, deterministic edit operations, rendering, motion primitives, quality control, provenance, and reversibility.

## Core differentiators
1. Timeline as data, not generated code.
2. Semantic coverage planning before edit execution.
3. Edit Memory that learns local preferences and style rules.
4. Video Git branches, checkpoints, diffs, compare and merge.
5. Renderer-independent motion graph with reusable motion components.
6. Localized quality review and segment repair.
7. Rights-aware internet media provenance.
8. Shared typed tool surface across MCP, CLI, UI, Codex, and Claude Code.

## Architecture
TypeScript owns the project model, timeline operations, CLI, MCP, orchestration, motion definitions, and desktop/web UI integration. FFmpeg and ffprobe provide deterministic media transforms and inspection. Python is optional only where ecosystem support is materially better.

The canonical project format is `project.flick.json`. Time is stored as integer frame ticks and rational frame rates, never floating-point seconds.

## Core project model
`FlickProject` contains:
- version
- id
- name
- format: width, height, fps rational, audio sample rate
- assets
- tracks
- markers
- style
- provenance
- checkpoints
- branches

## Editing verbs
- create_project
- import_asset
- inspect_asset
- analyze_asset
- search_assets
- get_timeline
- add_clip
- remove_clip
- split_clip
- trim_clip
- move_clip
- ripple_delete
- set_speed
- add_transition
- add_text
- add_caption_track
- add_motion_graphic
- set_volume
- duck_audio
- remove_silence
- sync_to_beats
- checkpoint
- undo
- branch_project
- diff_branches
- merge_branch
- render_proxy
- review_render
- repair_segment
- render_final
- export_otio

Every mutation returns a structured diff, warnings, and checkpoint identifier.

## Media intelligence pipeline
media → ffprobe → proxy → scene detection → audio extraction → ASR → keyframes → visual description → quality analysis → local search index

Preferred local components:
- FFmpeg/ffprobe
- whisper.cpp
- PySceneDetect or a native detector
- SQLite
- optional Ollama-compatible local vision models, with model-license checks

Semantic search examples:
- strongest prototype opening
- drone entering frame
- strongest sentence
- clearest closeup
- pointing to screen

## Agent workflow
Logical roles:
- DIRECTOR: brief, narrative beats, coverage and style
- EDITOR: concrete typed operations
- REVIEWER: quality and localized repair

These are logical roles and may run through one host model initially. Do not require a large multi-agent swarm.

First-class artifacts:
- `brief.json`
- `coverage.json`
- `edit-plan.json`
- `project.flick.json`
- `review.json`

## Rendering
Ordinary footage, audio, captions and deterministic transforms route through FFmpeg.

Motion graphics route through FlickSmith's renderer-neutral motion graph. Initial backend preference is Glissade because it is permissively licensed, but FlickSmith must depend only on its own `MotionRenderer` interface so backends can change.

Interface:
- validate()
- renderFrame()
- render()

Potential later adapters:
- GitFrames
- Motion Canvas
- Remotion as optional adapter only

Remotion is not a required dependency.

## Motion system
Initial reusable components:
- kinetic-title
- lower-third
- product-card
- stat-counter
- animated-chart
- callout-arrow
- code-reveal
- feature-list
- logo-reveal
- comparison-card
- caption-highlight

Generated motion components pass:
AST validation → dependency whitelist → TypeScript compile → low-resolution smoke render → frame inspection → accept or repair

Successful components may be saved to a local reusable library.

## Style and Edit Memory
A style package captures:
- typography hierarchy
- caption rules
- transitions
- pacing
- motion curves
- graphic density
- music behavior
- CTA behavior
- color
- layout

Edit Memory stores local editing preferences only and can be reviewed or disabled.

Examples:
- remove pauses over 450 ms
- captions under 42 characters per line
- first five seconds use faster pacing
- avoid zoom transitions
- CTA ends in final 2.5 seconds

## Video Git
Commands support:
- checkpoints
- named branches such as cinematic, energetic, minimal
- timeline diffs
- branch comparison
- later merge support

Branches share original source media and store timeline-level changes.

## Rights-aware media
External media sources use provider interfaces:
- search
- inspect
- download

Each asset tracks:
- provider
- creator
- original URL
- license
- commercial-use permission
- attribution requirement
- retrieval timestamp

FlickSmith warns or refuses when rights are uncertain.

## Audio
Support:
- speech extraction
- silence detection
- music
- SFX
- ducking
- fades
- beat detection
- loudness analysis
- clipping checks
- voice-over alignment

## Quality control
Proxy review first.

Checks:
- duration
- resolution
- aspect ratio
- missing media
- black or frozen frames
- audio clipping
- loudness
- caption overflow
- safe zones
- dead air
- duplicate/repetitive shots
- extreme crops
- bad transitions
- missing attribution
- render failure

Reviewer output includes timestamp, severity, type and repair suggestion. Repairs should target segments, not rebuild the whole project.

## CLI
```bash
flicksmith init launch-ad
flicksmith ingest ./footage
flicksmith create --brief "..." --aspect 9:16
flicksmith preview
flicksmith render
flicksmith mcp
```

## Security
- validated operations only
- permitted filesystem roots
- generated motion imports whitelisted
- no arbitrary fs/process/network/eval/native access from motion components
- download and job limits
- originals never overwritten

## Repository
```text
flicksmith/
  apps/
    cli/
    mcp/
    studio/
  packages/
    schema/
    timeline/
    media/
    render-ffmpeg/
    motion/
    intelligence/
    search/
    audio/
    providers/
    qc/
    otio/
    agent/
  motion/
    components/
    templates/
  skills/
    create-video/
    edit-footage/
    marketing-video/
    talking-head/
    product-demo/
    short-form/
    reference-style/
  examples/
    launch-ad/
    talking-head/
    motion-demo/
  docs/
    architecture/
    research/
    licensing/
    tools/
  tests/
    fixtures/
    integration/
    golden/
  AGENTS.md
  CLAUDE.md
  README.md
  LICENSE
```

## v0.1 success criteria
On a new machine with local clips, Codex or Claude Code can:
1. ingest and analyze footage
2. semantically search it
3. create a multi-track structured timeline
4. trim and reorder clips
5. create captions
6. add music
7. add at least five polished motion components
8. render a proxy
9. run QC
10. repair a localized issue
11. render a final MP4
12. save and apply a style package
13. create and compare timeline branches
14. do all of the above without a paid API

## Non-goals for v0.1
- replacing every Premiere or DaVinci feature
- training a video-generation model
- unauthorized downloading from YouTube or other sources
- paid API dependency
- mandatory cloud
- huge multi-agent swarm
- making generated source code the timeline source of truth
