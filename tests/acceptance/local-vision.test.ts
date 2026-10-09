import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  EvidenceStore,
  LocalHistogramEmbeddingProvider,
  TesseractOcrProvider,
  type VisualEvidence,
} from '../../packages/vision/src/index.ts';

function run(command:string,args:string[]){
  const r=spawnSync(command,args,{encoding:null,maxBuffer:16*1024*1024});
  assert.equal(r.status,0,`${command} failed: ${Buffer.from(r.stderr??[]).toString('utf8')}`);
  return r;
}

test('local perception acceptance uses real image bytes OCR embeddings and provenance invalidation', async (t)=>{
  const dir=mkdtempSync(join(tmpdir(),'flicksmith-local-vision-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const png=join(dir,'vision.png');

  run('ffmpeg',['-y','-f','lavfi','-i','color=c=black:s=640x240:d=1',
    '-vf',"drawtext=text='FLICKSMITH VISION 42':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2",
    '-frames:v','1',png]);

  const raw=run('ffmpeg',['-v','error','-i',png,'-f','rawvideo','-pix_fmt','rgba','-frames:v','1','pipe:1']).stdout;
  assert.equal(raw.length,640*240*4);

  const embeddingProvider=new LocalHistogramEmbeddingProvider();
  const embeddingCaps=await embeddingProvider.capabilities();
  assert.equal(embeddingCaps.available,true);
  const embedding=await embeddingProvider.embed({width:640,height:240,rgba:new Uint8Array(raw)});
  assert.equal(embedding.length,12);
  const norm=Math.sqrt(embedding.reduce((s,x)=>s+x*x,0));
  assert.ok(Math.abs(norm-1)<1e-9,'embedding must be normalized');
  assert.ok(embedding.some(x=>x>0));

  const ocrProvider=new TesseractOcrProvider();
  const ocrCaps=await ocrProvider.capabilities();
  if(!ocrCaps.available){
    t.skip(`Tesseract unavailable: ${ocrCaps.detail??'no detail'}`);
    return;
  }
  const text=(await ocrProvider.ocr(png)).toUpperCase();
  assert.match(text,/FLICKSMITH/);
  assert.match(text,/VISION/);
  assert.match(text,/42/);

  const db=join(dir,'evidence.sqlite');
  const store=new EvidenceStore(db);
  t.after(()=>store.close());
  const evidence:VisualEvidence={
    id:'ocr-1',assetId:'asset-vision',start:0,end:1,kind:'ocr',text,
    confidence:0.99,provider:'tesseract',model:'tesseract-cli',version:'5.x',
    sourceHash:'sha256:old',createdAt:new Date(0).toISOString(),metadata:{path:png},
  };
  store.put(evidence);
  const persisted=store.list('asset-vision');
  assert.equal(persisted.length,1);
  assert.equal(persisted[0].provider,'tesseract');
  assert.equal(persisted[0].model,'tesseract-cli');
  assert.equal(persisted[0].sourceHash,'sha256:old');
  assert.equal(store.invalidateSource('asset-vision','sha256:new'),1);
  assert.equal(store.list('asset-vision').length,0);
});
