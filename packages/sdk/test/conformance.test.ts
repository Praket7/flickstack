import test from 'node:test';
import assert from 'node:assert/strict';
import {runExtensionConformance} from '../src/conformance.ts';
const manifest={id:'example.qc',name:'Example QC',version:'1.0.0',apiVersion:1 as const,kinds:['qc-rule' as const],entry:'dist/index.js',permissions:['read-project-assets' as const],capabilities:{rules:['safe-area']}};
test('conformance passes only when requested permission is granted',()=>{assert.equal(runExtensionConformance(manifest,{extensionId:'example.qc',permissions:['read-project-assets']}).ok,true);assert.equal(runExtensionConformance(manifest,{extensionId:'example.qc',permissions:[]}).ok,false)});
