export interface RenderWorkerJob {
  id: string;
  engineVersion: string;
  projectHash: string;
  cacheKey: string;
  output: { format: string; path: string };
}
export interface RenderWorkerRuntime { engineVersion: string; workerId?: string }
export interface RenderWorkerEnvelope { job: RenderWorkerJob; workerId?: string; editorAuthority: false; immutable: true }
export interface RenderWorkerResult { jobId: string; engineVersion: string; projectHash: string; cacheKey: string; outputHash: string }

function hash(value: string, label: string): void {
  if (!/^sha256:[a-fA-F0-9]+$/.test(value)) throw new Error(`${label} must be a sha256 content hash`);
}

export function validateWorkerJob(job: RenderWorkerJob, runtime: RenderWorkerRuntime): RenderWorkerJob {
  if (!job.id?.trim()) throw new Error('Render worker job id is required');
  if (job.engineVersion !== runtime.engineVersion) throw new Error(`Render worker engine version mismatch: job=${job.engineVersion}, worker=${runtime.engineVersion}`);
  hash(job.projectHash, 'project hash');
  hash(job.cacheKey, 'cache key');
  if (!job.output?.format?.trim() || !job.output.path?.trim()) throw new Error('Render worker output is required');
  return structuredClone(job);
}

export function createWorkerEnvelope(job: RenderWorkerJob, runtime: RenderWorkerRuntime): RenderWorkerEnvelope {
  return { job: validateWorkerJob(job, runtime), ...(runtime.workerId ? { workerId: runtime.workerId } : {}), editorAuthority: false, immutable: true };
}

export function acceptWorkerResult(job: RenderWorkerJob, result: RenderWorkerResult): RenderWorkerResult {
  if (result.jobId !== job.id) throw new Error('Render worker result job id mismatch');
  if (result.engineVersion !== job.engineVersion) throw new Error('Render worker result engine version mismatch');
  if (result.projectHash !== job.projectHash) throw new Error('Render worker result project hash mismatch');
  if (result.cacheKey !== job.cacheKey) throw new Error('Render worker result cache key mismatch');
  hash(result.outputHash, 'output hash');
  return structuredClone(result);
}
