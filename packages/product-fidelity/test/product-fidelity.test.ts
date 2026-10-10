import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateProductFidelity,levenshteinSimilarity,planDeterministicBrandFinish,type ProductIdentityPackage} from '../src/index.ts';

const identity:ProductIdentityPackage={id:'sprite',name:'Sprite Zero Sugar',approvedAssetIds:['front'],expectedOcrStrings:['Sprite','Zero Sugar'],logoReferenceAssetIds:['logo'],silhouetteReferenceAssetId:'silhouette',protectedColors:[{name:'green',referenceLab:[80,-60,40]}],protectedRegionAssetIds:['label'],thresholds:{overall:.8}};

test('product fidelity rejects malformed brand candidates',()=>{const report=evaluateProductFidelity(identity,{observedOcrStrings:['Sprte','Zro Suger'],logoSimilarity:.55,silhouetteSimilarity:.72,colorSimilarity:.70,segmentationStability:.9,temporalConsistency:.75,flickerScore:.3,cameraAdherence:.9,productOccupancy:.5});assert.equal(report.approved,false);assert.ok(report.issues.some(i=>i.code==='ocr_drift'));assert.ok(report.issues.some(i=>i.code==='logo_drift'));assert.ok(report.issues.some(i=>i.code==='flicker'))});

test('product fidelity accepts stable product and exact native finishing stays locked',()=>{const report=evaluateProductFidelity(identity,{observedOcrStrings:['Sprite','Zero Sugar'],logoSimilarity:.99,silhouetteSimilarity:.98,colorSimilarity:.97,segmentationStability:.97,temporalConsistency:.95,flickerScore:.05,cameraAdherence:.9,productOccupancy:.48});assert.equal(report.approved,true);assert.ok(report.score>.9);const finish=planDeterministicBrandFinish(identity,'generated-plate');assert.equal(finish.forbidGeneratedBrandText,true);assert.ok(finish.instructions.every(x=>x.locked&&x.generatedByModel===false));assert.ok(finish.instructions.some(x=>x.kind==='text'&&x.text==='Sprite'))});

test('OCR similarity is normalized and typo-sensitive',()=>{assert.equal(levenshteinSimilarity('Sprite','Sprite'),1);assert.ok(levenshteinSimilarity('Sprite','Sprte')<1);assert.ok(levenshteinSimilarity('Sprite','Cola')<.4)});
