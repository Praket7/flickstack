import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  renameSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class ProjectFileLock {
  #fd: number | null;
  readonly lockPath: string;

  private constructor(lockPath: string, fd: number) {
    this.lockPath = lockPath;
    this.#fd = fd;
  }

  static acquire(projectPath: string): ProjectFileLock {
    const lockPath = `${projectPath}.flicksmith.lock`;
    try {
      const fd = openSync(lockPath, 'wx', 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      fsyncSync(fd);
      return new ProjectFileLock(lockPath, fd);
    } catch (error: any) {
      if (error?.code === 'EEXIST') throw new Error(`Project is locked by another writer: ${projectPath}`);
      throw error;
    }
  }

  release(): void {
    if (this.#fd === null) return;
    closeSync(this.#fd);
    this.#fd = null;
    try { unlinkSync(this.lockPath); } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

export class AtomicProjectWrite {
  readonly targetPath: string;
  readonly tempPath: string;
  #closed = false;

  private constructor(targetPath: string, tempPath: string) {
    this.targetPath = targetPath;
    this.tempPath = tempPath;
  }

  static prepare(targetPath: string, content: string | Uint8Array): AtomicProjectWrite {
    const dir = dirname(targetPath);
    const tempPath = join(dir, `.${basename(targetPath)}.${randomUUID()}.tmp`);
    const fd = openSync(tempPath, 'wx', 0o600);
    try {
      writeFileSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return new AtomicProjectWrite(targetPath, tempPath);
  }

  commit(): void {
    if (this.#closed) throw new Error('Atomic write is already closed');
    renameSync(this.tempPath, this.targetPath);
    // Persist the directory entry on POSIX. Some platforms reject opening directories;
    // the file replacement is still atomic there, so only ignore platform-specific failures.
    try {
      const dirFd = openSync(dirname(this.targetPath), 'r');
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    } catch (error: any) {
      if (process.platform !== 'win32') throw error;
    }
    this.#closed = true;
  }

  abort(): void {
    if (this.#closed) return;
    this.#closed = true;
    rmSync(this.tempPath, { force: true });
  }

  static recoverOrphans(targetPath: string): number {
    const dir = dirname(targetPath);
    const prefix = `.${basename(targetPath)}.`;
    let removed = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.tmp')) continue;
      rmSync(join(dir, entry.name), { force: true });
      removed++;
    }
    return removed;
  }
}
export * from './process.ts';
