# Human-Crafted Video Quality Gate

FlickSmith v0.5 treats "does not look like a generic AI ad" as a creative-quality requirement, not as an attempt to hide provenance. Generated assets remain fully traceable. The goal is authored craft: brand-specific choices, motivated motion, editorial rhythm, continuity, sound design, and professional finishing.

## Research basis

- **Evaluating AI-Generated Cinematic Video Ads from Professional Editors' Perspective (arXiv:2608.24329)** reports that professional editors consistently notice awkward transitions, visual inconsistencies, pacing problems, weak typography/graphics, thin sound design, and incoherent narrative progression. The paper argues that clip-level visual fidelity is not enough; the full edited sequence has to be evaluated as an editorial artifact.
- **Timeline-Bench (arXiv:2609.35143)** evaluates editing agents on raw-footage-to-final-cut workflows and highlights the importance of long-horizon planning, correct timeline operations, verification, and professional-quality completion rather than isolated tool calls.
- **FilmBench (arXiv:2607.24241)** evaluates film-grade quality across shot composition, visual continuity, camera motion, color/lighting, and related dimensions that ordinary text/video similarity metrics miss.
- Professional production guidance from Adobe, StudioBinder, Artlist, Boris FX, and Motion Array converges on intentional pacing, motivated transitions, sound design, continuity, and brand-specific motion language rather than effect density.

## Product rules derived from the research

1. **No universal AI-ad style.** Director must derive a visual grammar from the actual brand, audience, references, product geometry, and message.
2. **Motion requires a reason.** Camera pushes, parallax, zooms, wipes, and text animation are rejected when they repeat as decoration rather than serving reveal, emphasis, continuity, or emotion.
3. **Cuts are the default.** Visible transitions are scarce and motivated by physical movement, graphic match, semantic connection, or time/place change.
4. **Rhythm is authored.** Shot duration follows information density, performance, anticipation, release, and music/sound structure. Mechanical equal-length beats are a QC failure.
5. **Typography is editorial.** Critical copy remains native text with an intentional hierarchy/grid. Generic centered bold captions are not the default.
6. **Sound carries materiality.** Room tone, tactile foley, transients, dynamics, and purposeful silence are part of the edit, not an afterthought beneath music.
7. **Continuity beats novelty.** Lens logic, screen direction, lighting, product geometry, and action continuity are release-gating dimensions.
8. **Imperfection must be causal.** Realistic texture, handheld movement, focus behavior, or performance variation can be preserved when motivated by capture or story. Random jitter/noise is not "humanization."
9. **Generation solves coverage gaps.** Existing authentic/licensed evidence is preferred when it satisfies the shot. Generation is used deliberately and remains provenance-tagged.
10. **Taste is testable.** `@flicksmith/creative-quality` scores repetition, decorative motion, transition spam, pacing monotony, typography templating, weak sound design, and lack of brand-specific decisions. A technically valid render can still fail the human-craft release gate.

## Acceptance target

Release candidates should score at least 80/100 on the human-craft gate with no blocking errors, while also passing existing technical QC, provenance, rights, and render-parity checks. This score is a guardrail, not a claim that aesthetics can be fully automated.
