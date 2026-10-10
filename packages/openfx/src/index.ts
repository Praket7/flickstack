import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';

export interface OpenFxRenderRequest {
  pluginPath: string;
  effectId: string;
  inputPath: string;
  outputPath: string;
  frame: number;
  parameters?: Record<string, number | string | boolean>;
}

export interface OpenFxRenderResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  stderr: string;
}

export interface OpenFxHostOptions {
  hostExecutable: string;
  hostArguments?: string[];
  permittedPluginRoots: string[];
  timeoutMs?: number;
}

function within(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export class IsolatedOpenFxHost {
  readonly #hostExecutable: string;
  readonly #hostArguments: string[];
  readonly #roots: string[];
  readonly #timeoutMs: number;

  constructor(options: OpenFxHostOptions) {
    if (!options.hostExecutable.trim()) throw new Error('OpenFX host executable is required');
    if (!options.permittedPluginRoots.length) throw new Error('At least one permitted OpenFX plugin root is required');
    this.#hostExecutable = options.hostExecutable;
    this.#hostArguments = [...(options.hostArguments ?? [])];
    this.#roots = options.permittedPluginRoots.map(resolve);
    this.#timeoutMs = Math.max(100, options.timeoutMs ?? 30_000);
  }

  async render(request: OpenFxRenderRequest): Promise<OpenFxRenderResult> {
    if (!this.#roots.some((root) => within(root, request.pluginPath))) throw new Error('OpenFX plugin path is outside permitted roots');
    if (!Number.isInteger(request.frame) || request.frame < 0) throw new Error('OpenFX frame must be a non-negative integer');
    const args = [
      ...this.#hostArguments,
      '--plugin', resolve(request.pluginPath),
      '--effect', request.effectId,
      '--input', resolve(request.inputPath),
      '--output', resolve(request.outputPath),
      '--frame', String(request.frame),
      '--parameters-json', JSON.stringify(request.parameters ?? {}),
    ];

    return await new Promise((resolveResult, reject) => {
      const child = spawn(this.#hostExecutable, args, {
        shell: false,
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.#timeoutMs);
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr += String(chunk).slice(0, Math.max(0, 16_384 - stderr.length)); });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`OpenFX host failed to start: ${error.message}`));
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        resolveResult({ ok: !timedOut && code === 0, exitCode: code, timedOut, stderr });
      });
    });
  }
}
