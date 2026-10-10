import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGenerationQC} from '../src/index.ts';

test('generation QC rejects flicker and camera misses when camera adherence is required',()=>{const r=evaluateGenerationQC({segmentationStability:.95,temporalConsistency:.9,flickerScore:.35,cameraAdherence:.4,productOccupancy:.5,promptAdherence:.9},{requireCameraAdherence:true});assert.equal(r.approved,false);assert.ok(r.issues.some(x=>x.code==='excessive_flicker'));assert.ok(r.issues.some(x=>x.code==='camera_miss'))});

test('generation QC accepts coherent local video candidate',()=>{const r=evaluateGenerationQC({segmentationStability:.95,temporalConsistency:.94,flickerScore:.05,cameraAdherence:.88,productOccupancy:.5,promptAdherence:.9},{requireCameraAdherence:true});assert.equal(r.approved,true);assert.ok(r.score>.8)});
