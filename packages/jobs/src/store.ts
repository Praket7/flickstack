import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Job, JobInput, JobState } from './types.ts';

function now(): string { return new Date().toISOString(); }

function rowToJob(row: any): Job {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    resourceClass: row.resource_class,
    payload: JSON.parse(row.payload_json),
    idempotencyKey: row.idempotency_key,
    dependencies: JSON.parse(row.dependencies_json),
    retryClass: row.retry_class,
    state: row.state,
    progress: row.progress,
    attempts: row.attempts,
    ...(row.error_text ? { error: row.error_text } : {}),
    ...(row.result_json ? { result: JSON.parse(row.result_json) } : {}),
    createdAt: row.created_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}

export class JobStore {
  #db: DatabaseSync;

  constructor(path = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        resource_class TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        dependencies_json TEXT NOT NULL,
        retry_class TEXT NOT NULL,
        state TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        error_text TEXT,
        result_json TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        UNIQUE(project_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS jobs_state_created ON jobs(state, created_at);
    `);
  }

  enqueue(input: JobInput): Job {
    const existing = this.#db.prepare(
      'SELECT * FROM jobs WHERE project_id=? AND idempotency_key=?'
    ).get(input.projectId, input.idempotencyKey) as any;
    if (existing) return rowToJob(existing);

    const id = randomUUID();
    const createdAt = now();
    this.#db.prepare(`
      INSERT INTO jobs(
        id,project_id,type,resource_class,payload_json,idempotency_key,
        dependencies_json,retry_class,state,progress,attempts,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, input.projectId, input.type, input.resourceClass,
      JSON.stringify(input.payload ?? null), input.idempotencyKey,
      JSON.stringify(input.dependencies ?? []), input.retryClass,
      'queued', 0, 0, createdAt
    );
    return this.get(id)!;
  }

  get(id: string): Job | undefined {
    const row = this.#db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as any;
    return row ? rowToJob(row) : undefined;
  }

  list(states?: JobState[]): Job[] {
    if (!states || states.length === 0) {
      return (this.#db.prepare('SELECT * FROM jobs ORDER BY created_at,id').all() as any[]).map(rowToJob);
    }
    const placeholders = states.map(() => '?').join(',');
    return (this.#db.prepare(`SELECT * FROM jobs WHERE state IN (${placeholders}) ORDER BY created_at,id`).all(...states) as any[]).map(rowToJob);
  }

  markRunning(id: string): void {
    this.#db.prepare(`UPDATE jobs SET state='running', started_at=?, attempts=attempts+1, error_text=NULL WHERE id=?`).run(now(), id);
  }

  markCompleted(id: string, result?: unknown): void {
    this.#db.prepare(`UPDATE jobs SET state='completed', progress=1, result_json=?, completed_at=?, error_text=NULL WHERE id=?`).run(
      result === undefined ? null : JSON.stringify(result), now(), id
    );
  }

  markFailed(id: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.#db.prepare(`UPDATE jobs SET state='failed', error_text=?, completed_at=? WHERE id=?`).run(message, now(), id);
  }

  markCancelled(id: string): void {
    this.#db.prepare(`UPDATE jobs SET state='cancelled', completed_at=? WHERE id=? AND state NOT IN ('completed','failed')`).run(now(), id);
  }

  updateProgress(id: string, progress: number): void {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new Error('progress must be between 0 and 1');
    this.#db.prepare('UPDATE jobs SET progress=? WHERE id=?').run(progress, id);
  }

  recoverInterrupted(): number {
    const running = this.list(['running']);
    let changed = 0;
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      for (const job of running) {
        if (job.retryClass === 'safe') {
          this.#db.prepare(`UPDATE jobs SET state='queued', started_at=NULL, error_text='recovered after interruption' WHERE id=?`).run(job.id);
        } else {
          this.#db.prepare(`UPDATE jobs SET state='failed', error_text='interrupted and not safe to retry', completed_at=? WHERE id=?`).run(now(), job.id);
        }
        changed++;
      }
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
    return changed;
  }

  close(): void { this.#db.close(); }
}
