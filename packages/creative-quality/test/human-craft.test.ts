import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCraftDirection, evaluateHumanCraft } from '../src/index.ts';

test('craft direction rejects generic AI-ad defaults and requires authored visual logic', () => {
  const direction = buildCraftDirection({
    brand: 'Northstar',
    audience: 'design professionals',
    objective: 'launch a precision tool',
    references: ['restrained documentary product film'],
  });
  assert.equal(direction.forbidGenericAiAesthetic, true);
  assert.ok(direction.rules.some((rule) => rule.includes('motivat')));
  assert.ok(direction.rules.some((rule) => rule.includes('brand')));
  assert.ok(direction.rules.some((rule) => rule.includes('sound')));
});

test('human-craft QC penalizes template repetition, unmotivated motion, transition spam and weak audiovisual intent', () => {
  const report = evaluateHumanCraft({
    shots: [
      { durationFrames: 60, transition: 'zoom', cameraMove: 'push', purpose: 'hero' },
      { durationFrames: 60, transition: 'zoom', cameraMove: 'push', purpose: 'hero' },
      { durationFrames: 60, transition: 'zoom', cameraMove: 'push', purpose: 'hero' },
    ],
    typographyStyles: ['centered-bold', 'centered-bold', 'centered-bold'],
    soundEvents: [],
    brandSpecificChoices: 0,
  });
  assert.ok(report.score < 60);
  assert.ok(report.issues.some((issue) => issue.code === 'template-repetition'));
  assert.ok(report.issues.some((issue) => issue.code === 'unmotivated-motion'));
  assert.ok(report.issues.some((issue) => issue.code === 'weak-sound-design'));
});

test('human-craft QC rewards purposeful variation instead of random jitter', () => {
  const report = evaluateHumanCraft({
    shots: [
      { durationFrames: 18, transition: 'cut', cameraMove: 'static', purpose: 'establish' },
      { durationFrames: 42, transition: 'cut', cameraMove: 'handheld-subtle', purpose: 'proof' },
      { durationFrames: 24, transition: 'match-cut', cameraMove: 'track', purpose: 'reveal' },
      { durationFrames: 75, transition: 'cut', cameraMove: 'static', purpose: 'resolve' },
    ],
    typographyStyles: ['editorial-left', 'caption-small', 'product-lockup'],
    soundEvents: ['room-tone', 'foley-click', 'music-accent', 'breath'],
    brandSpecificChoices: 5,
  });
  assert.ok(report.score >= 80);
});
