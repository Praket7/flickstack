export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobResourceClass = 'cpu' | 'io' | 'gpu' | 'model';
export type JobRetryClass = 'safe' | 'manual' | 'never';

export interface JobInput {
  projectId: string;
  type: string;
  resourceClass: JobResourceClass;
  payload: unknown;
  idempotencyKey: string;
  dependencies: string[];
  retryClass: JobRetryClass;
}

export interface Job extends JobInput {
  id: string;
  state: JobState;
  progress: number;
  attempts: number;
  error?: string;
  result?: unknown;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobResourceLimits {
  cpu: number;
  io: number;
  gpu: number;
  model: number;
}

export type JobHandler = (job: Job, signal: AbortSignal) => Promise<unknown>;
