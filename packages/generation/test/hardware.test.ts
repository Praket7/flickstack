import test from 'node:test';
import assert from 'node:assert/strict';
import {clampCandidateCount,localHardwareCapabilities} from '../src/index.ts';

test('hardware profiles scale local generation honestly',()=>{assert.equal(localHardwareCapabilities('cpu').localVideo,false);assert.equal(localHardwareCapabilities('low-vram').maxPreviewResolution,'480p');assert.equal(localHardwareCapabilities('standard-gpu').maxPreviewResolution,'720p');assert.equal(localHardwareCapabilities('high-vram').maxPreviewResolution,'1080p');assert.equal(clampCandidateCount('standard-gpu',99),4);assert.equal(clampCandidateCount('high-vram'),4)});
