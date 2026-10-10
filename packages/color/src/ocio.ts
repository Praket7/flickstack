import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ColorPipeline,ColorTransformDescriptor } from './types.ts';
export function resolveOcioTransform(pipeline:ColorPipeline,inputSpace:string):ColorTransformDescriptor{
 if(inputSpace===pipeline.workingSpace&&!pipeline.outputSpace)return{status:'identity',configId:pipeline.configId,inputSpace,workingSpace:pipeline.workingSpace};
 if(!pipeline.configPath)return{status:'unsupported',configId:pipeline.configId,inputSpace,workingSpace:pipeline.workingSpace,display:pipeline.display,view:pipeline.view,diagnostic:'OCIO configPath is required for verified pixel processing'};
 let bytes:Buffer;try{bytes=readFileSync(pipeline.configPath)}catch{return{status:'unsupported',configId:pipeline.configId,inputSpace,workingSpace:pipeline.workingSpace,display:pipeline.display,view:pipeline.view,diagnostic:'OCIO config is unavailable'}}
 return{status:'ready',configId:pipeline.configId,configHash:createHash('sha256').update(bytes).digest('hex'),inputSpace,workingSpace:pipeline.workingSpace,display:pipeline.display,view:pipeline.view,...(pipeline.look?{look:pipeline.look}:{}),...(pipeline.outputSpace?{outputSpace:pipeline.outputSpace}:{})};
}
