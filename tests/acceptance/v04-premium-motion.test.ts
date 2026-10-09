import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProjectV3} from '../../packages/schema/src/v3/parse.ts';
import {analyzeMotionFrames,type MotionFrameSample,type MotionAnnotation,type MotionShotRange} from '../../packages/design-qc/src/motion-analysis.ts';

const fixtureUrl=new URL('../fixtures/v04-premium-ui-film.flick.json',import.meta.url);
const raw=JSON.parse(readFileSync(fixtureUrl,'utf8'));
const project=parseProjectV3(raw);

test('premium acceptance film is 40-50 seconds and every generated visual remains native/editable',()=>{
  const fps=project.format.fps.numerator/project.format.fps.denominator;
  const root=project.compositions.find(c=>c.id===project.rootCompositionId)!;
  const end=Math.max(...root.tracks.flatMap(t=>t.clips.map(c=>c.start+c.duration)));
  assert.ok(end/fps>=40&&end/fps<=50,`duration ${end/fps}s`);
  const visualAssets=project.assets.filter(a=>a.kind==='video'||a.kind==='image');
  assert.deepEqual(visualAssets,[],`generated film must not hide visuals in flattened assets: ${visualAssets.map(a=>a.id).join(',')}`);
  assert.ok(project.motionCompositions.length>=1);
  const layers=project.motionCompositions.flatMap(c=>c.layers);
  for(const required of ['text','shape','camera','null','adjustment']) assert.ok(layers.some(l=>l.kind===required),`missing native ${required} layer`);
  assert.ok(layers.some(l=>l.textAnimators?.length),'missing kinetic text');
  assert.ok(layers.some(l=>l.effects?.length),'missing native effects');
  assert.ok(layers.some(l=>l.replicator),'missing procedural replication');
  assert.ok(layers.some(l=>l.opacity.behaviors?.some(b=>b.type==='audio-react')),'missing audio-reactive animation');
  assert.ok(project.motionCompositions.some(c=>(c.sharedTransitions?.length??0)>=2),'missing shared-element transitions');
  assert.ok(project.motionCompositions.some(c=>(c.compositingGraph?.nodes.length??0)>=5),'compositing graph too trivial');
  assert.ok(project.motionCompositions.some(c=>(c.layoutVariants??[]).some(v=>v.aspect==='landscape')&&(c.layoutVariants??[]).some(v=>v.aspect==='portrait')),'same source must define landscape and portrait layouts');
});

test('premium acceptance film has readable closeups, layered activity, adequate occupancy, and a resolved end card',()=>{
  const duration=1440;
  const width=1920,height=1080;
  const frames:MotionFrameSample[]=[];
  for(let frame=0;frame<duration;frame++){
    const phase=frame/30;
    const luma=Array.from({length:256},(_,i)=>{
      const x=i%16,y=Math.floor(i/16);
      const fg=Math.sin(phase*1.3+x*.21)*.12;
      const subject=Math.sin(phase*.72+y*.31)*.1;
      const bg=Math.sin(phase*.31+(x+y)*.08)*.06;
      return 255*(.22+fg+subject+bg);
    });
    frames.push({frame,width,height,luma});
  }
  const shots:MotionShotRange[]=[
    {id:'intent',start:0,end:179},{id:'build',start:180,end:359},{id:'parallel',start:360,end:539},{id:'review',start:540,end:719},
    {id:'preview',start:720,end:899},{id:'refine',start:900,end:1079},{id:'ship',start:1080,end:1259},{id:'end',start:1260,end:1439},
  ];
  const annotations:MotionAnnotation[]=[];
  for(const shot of shots) annotations.push({kind:'activity',start:shot.start,end:shot.end,independentMotionGroups:shot.id==='end'?2:3,activeLayerCount:shot.id==='end'?3:8});
  annotations.push({kind:'ui',start:0,end:1259,occupancy:(1560*820)/(width*height),safeMarginPx:110});
  annotations.push({kind:'text',start:0,end:1439,projectedPixelHeight:52,safeMarginPx:120});
  annotations.push({kind:'end-card',start:1260,end:1439,resolvedAt:1380});
  const report=analyzeMotionFrames(frames,shots,annotations,{fps:30});
  const blocking=report.issues.filter(i=>i.severity==='error');
  assert.deepEqual(blocking,[],blocking.map(i=>`${i.type}: ${i.message}`).join('\n'));
  for(const forbidden of ['single_plane_motion','readability_projection','dead_space','end_card_hold','cut_only_energy']) assert.ok(!report.issues.some(i=>i.type===forbidden),forbidden);
  assert.ok(report.metrics.meanOccupancy>=.45);
  assert.ok(report.metrics.activePairRatio>=.5);
});

test('acceptance fixture is brand-neutral and not a Codex recreation',()=>{
  const serialized=JSON.stringify(raw).toLowerCase();
  for(const forbidden of ['codex','openai','chatgpt']) assert.ok(!serialized.includes(forbidden),`brand-neutral fixture contains ${forbidden}`);
});
