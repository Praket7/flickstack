# FlickSmith v0.4 professional-motion benchmark corpus

These ten editable Project v3 fixtures are permanent release gates for the native motion engine. They intentionally stress typography, dense UI readability, responsive layout, nested masks/mattes, independent 2.5D depth, depth of field and motion blur, compositing effects, shared-element transitions, procedural duplication/falloffs, and audio-driven animation.

Generated visual content in this corpus must remain editable FlickSmith layers. Flattened Python/Pillow/HTML/video proxies are not accepted as benchmark evidence. CPU output is the semantic reference; GPU output must meet the tolerances in `expected/manifest.json` or declare an explicit CPU fallback.

Premium-motion QC thresholds are also pinned in the manifest so the failure mode of the v0.3 Codex film cannot silently pass again.
