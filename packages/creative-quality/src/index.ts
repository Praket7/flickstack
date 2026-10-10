export interface CraftDirectionInput {
  brand: string;
  audience: string;
  objective: string;
  references?: string[];
}

export interface CraftDirection {
  brand: string;
  audience: string;
  objective: string;
  references: string[];
  forbidGenericAiAesthetic: true;
  rules: string[];
}

export interface CraftShot {
  durationFrames: number;
  transition: string;
  cameraMove: string;
  purpose: string;
}

export interface HumanCraftInput {
  shots: CraftShot[];
  typographyStyles: string[];
  soundEvents: string[];
  brandSpecificChoices: number;
}

export interface CraftIssue {
  code: 'template-repetition' | 'unmotivated-motion' | 'transition-spam' | 'pacing-monotony' | 'typography-template' | 'weak-sound-design' | 'generic-brand-language';
  severity: 'warning' | 'error';
  message: string;
  repair: string;
}

export interface HumanCraftReport {
  score: number;
  issues: CraftIssue[];
  metrics: {
    durationVariation: number;
    nonCutTransitionRatio: number;
    repeatedPatternRatio: number;
    soundEventsPerShot: number;
    brandSpecificChoices: number;
  };
}

export function buildCraftDirection(input: CraftDirectionInput): CraftDirection {
  for (const key of ['brand', 'audience', 'objective'] as const) if (!input[key]?.trim()) throw new Error(`${key} is required`);
  return {
    ...input,
    references: [...(input.references ?? [])],
    forbidGenericAiAesthetic: true,
    rules: [
      'Every camera move must be motivated by subject, story, reveal, or emotional emphasis; motion is not decoration.',
      'Build a brand-specific visual grammar from references, product geometry, audience, and message instead of a universal AI-ad look.',
      'Prefer editorial cuts, match cuts, motivated wipes, and physical transitions; avoid transition spam and repeated zoom/push presets.',
      'Vary shot duration by narrative function and performance rather than mechanically equal beats.',
      'Typography must follow an authored hierarchy and grid; keep critical copy native and avoid generic centered bold captions.',
      'Sound design must carry room tone, tactile foley, transitions, dynamics, and purposeful silence instead of music-only coverage.',
      'Preserve believable imperfections when they communicate material, camera, performance, or environment; never add random jitter as fake humanity.',
      'Use generation to solve a specific coverage problem, not to replace available authentic footage by default.',
      'Require continuity of lighting, lens logic, screen direction, product geometry, and action across adjacent shots.',
      'Finish with a human-craft review that can reject technically valid edits for weak taste, repetition, or generic styling.',
    ],
  };
}

const ratio = (n: number, d: number) => d <= 0 ? 0 : n / d;

export function evaluateHumanCraft(input: HumanCraftInput): HumanCraftReport {
  const issues: CraftIssue[] = [];
  const shots = input.shots;
  if (!shots.length) return { score: 0, issues: [{ code: 'generic-brand-language', severity: 'error', message: 'No authored shots exist.', repair: 'Create a shot plan with explicit narrative purposes.' }], metrics: { durationVariation: 0, nonCutTransitionRatio: 0, repeatedPatternRatio: 0, soundEventsPerShot: 0, brandSpecificChoices: input.brandSpecificChoices } };

  const durations = shots.map((shot) => shot.durationFrames);
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / durations.length;
  const durationVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const nonCutTransitionRatio = ratio(shots.filter((shot) => shot.transition !== 'cut').length, shots.length);
  const patterns = new Map<string, number>();
  for (const shot of shots) {
    const key = `${shot.transition}|${shot.cameraMove}|${shot.purpose}`;
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  const repeatedPatternRatio = ratio(Math.max(...patterns.values()), shots.length);
  const moving = shots.filter((shot) => shot.cameraMove !== 'static');
  const movingKinds = new Set(moving.map((shot) => shot.cameraMove));
  const purposeKinds = new Set(shots.map((shot) => shot.purpose));
  const soundEventsPerShot = ratio(input.soundEvents.length, shots.length);

  if (shots.length >= 3 && repeatedPatternRatio >= 0.66) issues.push({ code: 'template-repetition', severity: 'error', message: 'The same transition, camera move, and shot purpose repeats like a template.', repair: 'Re-author shot functions first, then choose motion and transitions that serve each function.' });
  if (moving.length >= 3 && movingKinds.size === 1 && purposeKinds.size <= 1) issues.push({ code: 'unmotivated-motion', severity: 'error', message: 'Camera motion repeats without changing narrative purpose.', repair: 'Remove decorative movement and motivate each move from subject or story.' });
  if (nonCutTransitionRatio > 0.5) issues.push({ code: 'transition-spam', severity: 'warning', message: 'More than half of edits use visible transitions.', repair: 'Default to cuts and reserve visible transitions for semantic or physical motivation.' });
  if (shots.length >= 3 && durationVariation < 0.12) issues.push({ code: 'pacing-monotony', severity: 'warning', message: 'Shot lengths are mechanically uniform.', repair: 'Shape duration around information density, performance, anticipation, and release.' });
  if (input.typographyStyles.length >= 3 && new Set(input.typographyStyles).size <= 1) issues.push({ code: 'typography-template', severity: 'warning', message: 'Typography repeats one generic treatment.', repair: 'Create an intentional hierarchy with brand-specific alignment, scale, rhythm, and restraint.' });
  if (soundEventsPerShot < 0.5) issues.push({ code: 'weak-sound-design', severity: 'error', message: 'The cut lacks enough authored sonic events to support picture rhythm and materiality.', repair: 'Add selective foley, ambience, accents, dynamics, and silence tied to picture events.' });
  if (input.brandSpecificChoices < 2) issues.push({ code: 'generic-brand-language', severity: 'error', message: 'Too few decisions are specific to this brand, product, or audience.', repair: 'Derive palette, type, motion, framing, texture, and recurring motifs from brand evidence.' });

  const penalties: Record<CraftIssue['code'], number> = {
    'template-repetition': 24,
    'unmotivated-motion': 18,
    'transition-spam': 12,
    'pacing-monotony': 12,
    'typography-template': 10,
    'weak-sound-design': 16,
    'generic-brand-language': 20,
  };
  const score = Math.max(0, Math.min(100, 100 - issues.reduce((sum, issue) => sum + penalties[issue.code], 0)));
  return { score, issues, metrics: { durationVariation, nonCutTransitionRatio, repeatedPatternRatio, soundEventsPerShot, brandSpecificChoices: input.brandSpecificChoices } };
}

export function assertHumanCraftRelease(report: HumanCraftReport, minimumScore = 80): void {
  if (report.score < minimumScore) throw new Error(`Human-craft release gate failed: ${report.score} < ${minimumScore}`);
  const errors = report.issues.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`Human-craft release gate has ${errors.length} blocking issue(s): ${errors.map((issue) => issue.code).join(', ')}`);
}
