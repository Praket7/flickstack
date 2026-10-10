export interface AutomationPoint { frame: number; value: number }
export interface AutomationLane { parameter: string; points: AutomationPoint[] }

export function createAutomationLane(parameter: string, points: AutomationPoint[]): AutomationLane {
  if (!parameter.trim()) throw new Error('Automation parameter is required');
  if (!points.length) throw new Error('Automation lane requires at least one point');
  const sorted = points.map((point) => ({ ...point })).sort((a, b) => a.frame - b.frame);
  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i]!;
    if (!Number.isInteger(point.frame) || point.frame < 0 || !Number.isFinite(point.value)) throw new Error('Invalid automation point');
    if (i && sorted[i - 1]!.frame === point.frame) throw new Error(`Duplicate automation frame ${point.frame}`);
  }
  return { parameter, points: sorted };
}

export function sampleAutomation(lane: AutomationLane, frame: number): number {
  if (!Number.isFinite(frame)) throw new Error('frame must be finite');
  const points = lane.points;
  if (!points.length) throw new Error('Automation lane is empty');
  if (frame <= points[0]!.frame) return points[0]!.value;
  if (frame >= points[points.length - 1]!.frame) return points[points.length - 1]!.value;
  for (let i = 1; i < points.length; i++) {
    const right = points[i]!;
    if (frame <= right.frame) {
      const left = points[i - 1]!;
      const t = (frame - left.frame) / (right.frame - left.frame);
      return left.value + (right.value - left.value) * t;
    }
  }
  return points[points.length - 1]!.value;
}

export function analyzeLoudnessPlan(input: { measuredLufs: number; targetLufs: number; truePeakDbtp: number }) {
  for (const [key, value] of Object.entries(input)) if (!Number.isFinite(value)) throw new Error(`${key} must be finite`);
  const rawGain = input.targetLufs - input.measuredLufs;
  const limiterCeilingDbtp = -1;
  const maxSafeGain = limiterCeilingDbtp - input.truePeakDbtp;
  return {
    measuredLufs: input.measuredLufs,
    targetLufs: input.targetLufs,
    gainDb: Math.min(rawGain, maxSafeGain < rawGain ? maxSafeGain : rawGain),
    requestedGainDb: rawGain,
    limiterCeilingDbtp,
    requiresLimiter: input.truePeakDbtp + rawGain > limiterCeilingDbtp,
  };
}

export type AudioRepairStep =
  | { kind: 'denoise'; strength: number }
  | { kind: 'declip'; strength: number }
  | { kind: 'dialogue-eq'; preset: 'clarity' }
  | { kind: 'room-tone-match'; strength: number };

export function buildAudioRepairPlan(input: { noise: number; clipping: boolean; dialogue: boolean }) {
  const steps: AudioRepairStep[] = [];
  if (input.noise > 0.2) steps.push({ kind: 'denoise', strength: Math.min(1, Math.max(0, input.noise)) });
  if (input.clipping) steps.push({ kind: 'declip', strength: 0.8 });
  if (input.dialogue) steps.push({ kind: 'dialogue-eq', preset: 'clarity' });
  if (input.dialogue && input.noise > 0.45) steps.push({ kind: 'room-tone-match', strength: 0.5 });
  return { destructive: false as const, steps };
}
