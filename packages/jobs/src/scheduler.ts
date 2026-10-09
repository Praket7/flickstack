import type { Job, JobHandler, JobResourceClass, JobResourceLimits } from './types.ts';
import { JobStore } from './store.ts';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class JobScheduler {
  #handlers = new Map<string, JobHandler>();
  #controllers = new Map<string, AbortController>();
  #running = new Map<string, Promise<void>>();
  #activeByResource = new Map<JobResourceClass, number>();
  #cancelled = new Set<string>();

  constructor(privateStore: JobStore, privateLimits: JobResourceLimits) {
    this.store = privateStore;
    this.limits = privateLimits;
    for (const resource of ['cpu','io','gpu','model'] as JobResourceClass[]) this.#activeByResource.set(resource, 0);
  }

  readonly store: JobStore;
  readonly limits: JobResourceLimits;

  register(type: string, handler: JobHandler): void {
    if (!type.trim()) throw new Error('job type is required');
    this.#handlers.set(type, handler);
  }

  cancel(id: string): boolean {
    const job = this.store.get(id);
    if (!job || ['completed','failed','cancelled'].includes(job.state)) return false;
    this.#cancelled.add(id);
    this.#controllers.get(id)?.abort();
    this.store.markCancelled(id);
    return true;
  }

  async runUntilIdle(): Promise<void> {
    for (;;) {
      let started = false;
      for (const job of this.store.list(['queued'])) {
        if (this.#cancelled.has(job.id)) continue;
        if (!this.#dependenciesSatisfied(job)) continue;
        if (!this.#hasResourceCapacity(job.resourceClass)) continue;
        this.#start(job);
        started = true;
      }

      if (this.#running.size === 0) {
        // Stop if there is no runnable work. Queued jobs with unmet/failed dependencies remain queued.
        return;
      }

      if (!started) await Promise.race(this.#running.values());
      else await sleep(0);
    }
  }

  #dependenciesSatisfied(job: Job): boolean {
    for (const id of job.dependencies) {
      const dep = this.store.get(id);
      if (!dep || dep.state !== 'completed') return false;
    }
    return true;
  }

  #hasResourceCapacity(resource: JobResourceClass): boolean {
    return (this.#activeByResource.get(resource) ?? 0) < this.limits[resource];
  }

  #start(job: Job): void {
    const handler = this.#handlers.get(job.type);
    if (!handler) {
      this.store.markFailed(job.id, new Error(`No handler registered for job type ${job.type}`));
      return;
    }
    const controller = new AbortController();
    this.#controllers.set(job.id, controller);
    this.#activeByResource.set(job.resourceClass, (this.#activeByResource.get(job.resourceClass) ?? 0) + 1);
    this.store.markRunning(job.id);
    const fresh = this.store.get(job.id)!;

    const promise = (async () => {
      try {
        const result = await handler(fresh, controller.signal);
        const current = this.store.get(job.id);
        if (current?.state === 'cancelled' || controller.signal.aborted) return;
        this.store.markCompleted(job.id, result);
      } catch (error) {
        const current = this.store.get(job.id);
        if (current?.state === 'cancelled' || controller.signal.aborted) return;
        this.store.markFailed(job.id, error);
      } finally {
        this.#controllers.delete(job.id);
        this.#activeByResource.set(job.resourceClass, Math.max(0, (this.#activeByResource.get(job.resourceClass) ?? 1) - 1));
        this.#running.delete(job.id);
      }
    })();
    this.#running.set(job.id, promise);
  }
}
