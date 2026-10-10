# Human-Crafted Creative System

FlickSmith v0.5 treats “looks AI-generated” as a creative-quality failure, not as a prompt problem. The editor must be able to reject technically valid work that is generic, repetitive, over-smoothed, narratively flat, weakly branded, or sonically empty.

## Research basis

Professional-editor research on AI-generated cinematic ads identifies six dimensions that matter together: narrative progression, audiovisual coordination, temporal rhythm, pacing, continuity, and brand coherence. The practical implication is that isolated shot beauty is not enough. A professional cut needs authored relationships between shots, sound, story, and brand.

- Cao et al., *Mind the Gap: Why AI-Generated Cinematic Video Ads Still Feel Wrong to Professional Editors* (2026): https://arxiv.org/abs/2608.24329
- Li, Pei, and Katona, *AI in Disguise: Measuring the Perception and Reception of AI-Generated Ads*: https://faculty.haas.berkeley.edu/zskatona/pdf/aiads.pdf
- OpenAI image-generation guidance for structured conversational generation/editing: https://developers.openai.com/api/docs/guides/tools-image-generation

The ad-perception work also suggests that viewers infer AI authorship from visual style. More colorful, strongly visual work can be attributed to AI more often, while human presence and certain photographic cues reduce that attribution. This is not a reason to deliberately degrade work. It is a reason to ground the edit in authentic evidence, specific art direction, real material behavior, human performance when appropriate, and restrained brand logic instead of a universal synthetic gloss.

## What FlickSmith now enforces

1. **Narrative before montage.** Shots can carry explicit setup, development, turn, proof, and resolve roles. A sequence with no progression can fail the human-craft gate.
2. **Motion must have intent.** Repeated push-ins, zooms, floating cards, or uniform easing are penalized when they do not change narrative purpose.
3. **Cuts are the default.** Visible transitions consume a transition budget. Match cuts, wipes, or camera transitions should have semantic or physical motivation.
4. **Pacing is shaped, not randomized.** Shot lengths should respond to information density, anticipation, performance, proof, and release. Random jitter is not “human.”
5. **Typography is authored.** Critical copy stays native. Alignment, scale, line breaks, hierarchy, and motion come from the brand system and composition, not a generic centered-bold treatment.
6. **Sound is editorial structure.** Room tone, foley, accents, dynamics, and silence are picture decisions. Music-only coverage is a quality failure.
7. **Continuity is explicit.** Lens logic, lighting, screen direction, product geometry, action, and spatial relationships are reviewed across adjacent shots.
8. **Generation pays coverage debt.** Existing authentic footage, UI, product imagery, and evidence are preferred. Generation is justified only for a real gap or an intentional art-directed synthetic moment.
9. **Imperfection must be motivated.** Natural texture, handheld behavior, breathing room, asymmetry, and material irregularity can be preserved. Fake film grain, random shake, random timing, and “humanizer” noise are not accepted substitutes for taste.
10. **Repair is local.** A craft failure should produce a scoped repair plan rather than regenerating or rebuilding the whole film.

## Release gate

The `creative-quality` package produces a `HumanCraftReport` and localized repair plan. It checks template repetition, unmotivated motion, transition spam, pacing monotony, typography templating, sound-design weakness, generic brand language, narrative flatness, audiovisual desynchronization, continuity risk, and synthetic-evidence overuse. The agent layer can append a typed `craft_review` action after picture QC. Normal MCP/chat clients can call `plan_human_craft_v3` and `review_human_craft_v3` directly.

The target is not to hide AI use. The target is to use AI as an editable production capability while preserving the authored decisions that make professional work feel specific, coherent, restrained, and intentional.
