import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../../packages/expressions/src/index.ts';
import { applyV3Operation } from '../../packages/timeline/src/v3.ts';
import { importStructuredLottie, importStructuredSvg, assertNativeOfxExecutionAllowed } from '../../packages/interchange/src/index.ts';
import { validateDirectorPlan } from '../../packages/agent/src/director.ts';
import { motionV03Project } from '../fixtures/motion-v03-project.ts';

test('v0.3 expressions, mutation payloads, interchange and director plans preserve the no-arbitrary-execution boundary',()=>{
 for(const source of ['process.exit(1)','globalThis.fetch(1)','constructor.constructor(1)','fetch(1)','while(1)'])assert.throws(()=>compileExpression(source),/forbidden|unknown|unexpected/i,source);
 const p=motionV03Project();assert.throws(()=>applyV3Operation(p,{type:'add_motion_behavior',compositionId:'motion-ui',layerId:'title',path:'opacity',behavior:{id:'bad',type:'wiggle',enabled:true,params:{accessToken:'secret'}}} as any),/credential|secret/i);assert.equal(p.motionCompositions[0].layers.find(l=>l.id==='title')!.opacity.behaviors?.length,1);
 assert.throws(()=>importStructuredSvg('<svg><foreignObject><script>fetch("x")</script></foreignObject></svg>'),/unsafe|active/i);assert.throws(()=>importStructuredLottie({v:'5.0',fr:30,ip:0,op:10,w:100,h:100,layers:[{x:'time*10'}]}),/expression/i);assert.throws(()=>assertNativeOfxExecutionAllowed(),/disabled/i);
 const catalog={componentIds:new Set<string>(),motionStyleIds:new Set(['ui-native']),compositionIds:new Set(['motion-ui'])};const bad:any={version:1,brief:{id:'b',objective:'Demo',audience:'Editors',durationFrames:60,aspect:'portrait',message:'Ship',constraints:[]},grammar:{id:'g',motionStyleIds:['ui-native'],transitionKinds:['hard-cut'],textEntrances:[],cameraLanguage:[],rules:[]},storyboard:[{id:'s',start:0,duration:60,purpose:'Show',focus:'UI',rationale:'Clear',constraints:[],props:{script:'rm -rf /'}}],shots:[{id:'shot',sceneId:'s',start:0,duration:60,compositionId:'motion-ui',focusLayerIds:[]}],sound:[]};assert.throws(()=>validateDirectorPlan(bad,catalog),/executable|script/i);
});
