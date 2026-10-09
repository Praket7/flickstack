import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrateV2ToV3, parseProjectV3, animated, defaultMotionTransform, type FlickProjectV2 } from '../../schema/src/index.ts';

function v2(): FlickProjectV2 {
  return {
    version:2,id:'proc',name:'Procedural',format:{width:1920,height:1080,fps:{numerator:30,denominator:1},audioSampleRate:48000},
    assets:[],rootCompositionId:'root',compositions:[{id:'root',name:'Root',width:1920,height:1080,tracks:[]}],masks:[],
    audioBuses:[{id:'master',name:'Master',effects:[],gainDb:0,pan:0}],multicamGroups:[],perception:{providers:[]},preview:{quality:'full',preferGpu:true},markers:[],style:{captionMaxChars:42},provenance:[],checkpoints:[{id:'cp',createdAt:'2026-10-08T00:00:00Z'}],branches:[{name:'main',checkpointId:'cp'}],
  };
}

async function procedural(){
  const loaded:any = await import('../src/index.ts');
  assert.equal(typeof loaded.evaluateReplicator,'function','evaluateReplicator must exist');
  assert.equal(typeof loaded.evaluateFalloff,'function','evaluateFalloff must exist');
  assert.equal(typeof loaded.evaluateParticles,'function','evaluateParticles must exist');
  return loaded;
}

test('grid replicator produces centered deterministic transforms, stable index context, and stagger',async()=>{
  const {evaluateReplicator}=await procedural();
  const instances=evaluateReplicator({id:'grid',count:6,seed:7,distribution:{kind:'grid',columns:3,rows:2,spacing:[100,50]},positionOffset:[1,0,0],rotationOffset:[0,0,5],scaleOffset:[0.1,0.1,0],timeOffsetFrames:2});
  assert.equal(instances.length,6);
  assert.deepEqual(instances[0].position,[-100,-25,0]);
  assert.deepEqual(instances[1].position,[1,-25,0]);
  assert.deepEqual(instances[5].position,[105,25,0]);
  assert.deepEqual(instances.map((x:any)=>x.timeOffsetFrames),[0,2,4,6,8,10]);
  assert.deepEqual(instances[5].rotation,[0,0,25]);
  assert.deepEqual(instances[2].scale,[1.2,1.2,1]);
  assert.deepEqual(instances.map((x:any)=>x.context.index),[0,1,2,3,4,5]);
  assert.equal(instances[0].context.normalized,0);
  assert.equal(instances[5].context.normalized,1);
  assert.deepEqual(evaluateReplicator({id:'grid',count:6,seed:7,distribution:{kind:'grid',columns:3,rows:2,spacing:[100,50]}}),evaluateReplicator({id:'grid',count:6,seed:7,distribution:{kind:'grid',columns:3,rows:2,spacing:[100,50]}}));
});

test('radial and path distributions sample deterministic geometry without duplicate full-circle endpoints',async()=>{
  const {evaluateReplicator}=await procedural();
  const radial=evaluateReplicator({id:'ring',count:4,seed:1,distribution:{kind:'radial',radius:100,startAngle:0,endAngle:360}});
  const round=(v:number)=>Math.round(v*1000)/1000;
  assert.deepEqual(radial.map((x:any)=>x.position.map(round)),[[100,0,0],[0,100,0],[-100,0,0],[0,-100,0]]);
  const path=evaluateReplicator({id:'path',count:3,seed:2,distribution:{kind:'path',points:[[0,0],[100,0],[100,100]],closed:false}});
  assert.deepEqual(path.map((x:any)=>x.position),[[0,0,0],[100,0,0],[100,100,0]]);
});

test('falloffs provide bounded deterministic weights and combine cleanly',async()=>{
  const {evaluateFalloff,evaluateFalloffs}=await procedural();
  const circle={id:'f',kind:'circle',center:[0,0],radius:100,strength:1,graph:{type:'linear'}};
  assert.equal(evaluateFalloff(circle,[0,0]),1);
  assert.equal(evaluateFalloff(circle,[100,0]),0);
  assert.equal(evaluateFalloff(circle,[50,0]),0.5);
  const linear={id:'l',kind:'linear',center:[0,0],size:[200,1],rotation:0,strength:1,graph:{type:'linear'}};
  assert.equal(evaluateFalloffs([circle,linear],[50,0],'multiply'),0.125);
  assert.ok(evaluateFalloff({...circle,graph:{type:'smoothstep'}},[50,0])>0 && evaluateFalloff({...circle,graph:{type:'smoothstep'}},[50,0])<1);
});

test('index signals and seeded random values drive repeatable instance variation',async()=>{
  const {evaluateReplicator,indexSignal,seededRandom}=await procedural();
  const instances=evaluateReplicator({id:'variation',count:5,seed:88,distribution:{kind:'grid',columns:5,spacing:[20,20]}});
  assert.deepEqual(instances.map((x:any)=>indexSignal(x.context,0.8,1.2).toFixed(2)),['0.80','0.90','1.00','1.10','1.20']);
  const a=instances.map((x:any)=>seededRandom(x.context));
  const b=instances.map((x:any)=>seededRandom(x.context));
  assert.deepEqual(a,b);
  assert.equal(new Set(a).size,5);
});

test('particle evaluation is deterministic, lifetime bounded, and respects hard particle budgets',async()=>{
  const {evaluateParticles,MAX_PARTICLES}=await procedural();
  const def={id:'sparks',rate:30,lifetimeFrames:30,maxParticles:100,seed:42,position:[0,0,0],velocity:[2,-1,0],velocityVariance:[1,2,0],gravity:[0,0.25,0],scale:[1,0.2],rotation:[0,180],color:['#ffffff','#55aaff']};
  const a=evaluateParticles(def,45,30),b=evaluateParticles(def,45,30);
  assert.deepEqual(a,b);
  assert.ok(a.length>0 && a.length<=30);
  assert.ok(a.every((p:any)=>p.ageFrames>=0&&p.ageFrames<30&&p.normalizedAge>=0&&p.normalizedAge<=1));
  assert.throws(()=>evaluateParticles({...def,maxParticles:MAX_PARTICLES+1},1,30),/budget/i);
});

test('procedural evaluator enforces a 10,000 instance hard budget and 50,000 particle budget',async()=>{
  const {evaluateReplicator,MAX_PROCEDURAL_INSTANCES,MAX_PARTICLES}=await procedural();
  assert.equal(MAX_PROCEDURAL_INSTANCES,10_000);
  assert.equal(MAX_PARTICLES,50_000);
  assert.throws(()=>evaluateReplicator({id:'too-many',count:10_001,seed:1,distribution:{kind:'grid',columns:101,spacing:[1,1]}}),/budget/i);
});

test('v3 parser accepts valid procedural layer definitions and rejects invalid budgets/geometry',()=>{
  const base=migrateV2ToV3(v2());
  const layer:any={id:'source',kind:'shape',name:'Source',start:0,duration:90,enabled:true,locked:false,zIndex:0,transform:defaultMotionTransform(),opacity:animated(1),effects:[],masks:[],motionBlur:false,shape:{kind:'rect',width:20,height:20},replicator:{id:'rep',count:1000,seed:2,distribution:{kind:'grid',columns:40,rows:25,spacing:[24,24]},timeOffsetFrames:1},falloffs:[{id:'fall',kind:'circle',center:[0,0],radius:300,strength:1,graph:{type:'smoothstep'},combine:'multiply'}]};
  const particle:any={...structuredClone(layer),id:'particles',kind:'particle',replicator:undefined,falloffs:undefined,particle:{id:'p',rate:60,lifetimeFrames:45,maxParticles:5000,seed:4,velocity:[0,-2,0],velocityVariance:[1,1,0],gravity:[0,0.1,0],scale:[1,0],rotation:[0,180],color:['#fff','#08f']}};
  const project:any={...base,motionCompositions:[{id:'motion',name:'Motion',width:1920,height:1080,duration:90,background:'#000',layers:[layer,particle]}]};
  assert.doesNotThrow(()=>parseProjectV3(project));
  const over=structuredClone(project);over.motionCompositions[0].layers[0].replicator.count=10_001;
  assert.throws(()=>parseProjectV3(over),/replicator.*budget|count.*10000/i);
  const badPath=structuredClone(project);badPath.motionCompositions[0].layers[0].replicator={id:'r',count:3,seed:1,distribution:{kind:'path',points:[[0,0]]}};
  assert.throws(()=>parseProjectV3(badPath),/path.*two|points/i);
  const badParticle=structuredClone(project);badParticle.motionCompositions[0].layers[1].particle.maxParticles=50_001;
  assert.throws(()=>parseProjectV3(badParticle),/particle.*budget|maxParticles/i);
});

test('1,000 repeated instances stay in one render-core batch and do not become 1,000 project layers',async()=>{
  const {evaluateReplicator}=await procedural();
  const started=performance.now();
  const instances=evaluateReplicator({id:'perf',count:1000,seed:5,distribution:{kind:'grid',columns:40,rows:25,spacing:[16,16]}});
  const elapsed=performance.now()-started;
  assert.equal(instances.length,1000);
  assert.ok(elapsed<250,`reference evaluator took ${elapsed.toFixed(1)}ms`);
  const core=readFileSync(new URL('../../../crates/flick-render-core/src/instances.rs',import.meta.url),'utf8');
  assert.match(core,/struct\s+InstanceBatch/);
  assert.match(core,/Vec<InstanceTransform>/);
  assert.doesNotMatch(core,/project_layers|MotionLayer/);
});

test('Studio inspector exposes procedural controls instead of hidden JSON-only settings',()=>{
  const source=readFileSync(new URL('../../../apps/studio/src/panels/PropertyInspector.tsx',import.meta.url),'utf8');
  for(const token of ['Replicator','Distribution','Count','Time offset','Falloff','Particle rate','Lifetime','Seed']) assert.match(source,new RegExp(token,'i'));
  assert.match(source,/onProceduralChange/);
});
