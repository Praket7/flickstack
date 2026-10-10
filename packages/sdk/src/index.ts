export type ExtensionKind = 'generation-provider' | 'media-provider' | 'effect' | 'analyzer' | 'exporter' | 'qc-rule';
export type ExtensionPermission = 'network' | 'read-project-assets' | 'write-staging' | 'gpu' | 'model-runtime' | 'credential-handle';

export interface ExtensionManifest {
  id: string;
  version: string;
  apiVersion: number;
  kind: ExtensionKind;
  permissions: ExtensionPermission[];
  entrypoint: string;
  description?: string;
}

const kinds = new Set<ExtensionKind>(['generation-provider','media-provider','effect','analyzer','exporter','qc-rule']);
const permissions = new Set<ExtensionPermission>(['network','read-project-assets','write-staging','gpu','model-runtime','credential-handle']);

export function validateExtensionManifest(input: ExtensionManifest): ExtensionManifest {
  if (!input || typeof input !== 'object') throw new Error('Extension manifest is required');
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(input.id)) throw new Error('Extension id is invalid');
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(input.version)) throw new Error('Extension version must be semver');
  if (!Number.isInteger(input.apiVersion) || input.apiVersion < 1) throw new Error('Extension API version is invalid');
  if (!kinds.has(input.kind)) throw new Error(`Unsupported extension kind ${String(input.kind)}`);
  if (!Array.isArray(input.permissions)) throw new Error('Extension permissions must be an array');
  for (const permission of input.permissions) if (!permissions.has(permission)) throw new Error(`Unsupported extension permission ${String(permission)}`);
  if (!input.entrypoint?.trim() || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(input.entrypoint) || /^https?:/i.test(input.entrypoint)) throw new Error('Extension entrypoint must be a local package-relative path');
  return structuredClone(input);
}

export class ExtensionRegistry {
  readonly apiVersion: number;
  #extensions = new Map<string, ExtensionManifest>();
  constructor(options: { apiVersion: number }) {
    if (!Number.isInteger(options.apiVersion) || options.apiVersion < 1) throw new Error('Registry API version is invalid');
    this.apiVersion = options.apiVersion;
  }
  register(input: ExtensionManifest): ExtensionManifest {
    const manifest = validateExtensionManifest(input);
    if (manifest.apiVersion !== this.apiVersion) throw new Error(`Extension API version ${manifest.apiVersion} is incompatible with host API version ${this.apiVersion}`);
    if (this.#extensions.has(manifest.id)) throw new Error(`Extension ${manifest.id} is already registered`);
    this.#extensions.set(manifest.id, manifest);
    return structuredClone(manifest);
  }
  get(id: string): ExtensionManifest | undefined {
    const value = this.#extensions.get(id);
    return value ? structuredClone(value) : undefined;
  }
  list(kind?: ExtensionKind): ExtensionManifest[] {
    return [...this.#extensions.values()].filter((value) => !kind || value.kind === kind).map((value) => structuredClone(value));
  }
  assertPermission(id: string, permission: ExtensionPermission): void {
    const manifest = this.#extensions.get(id);
    if (!manifest) throw new Error(`Unknown extension ${id}`);
    if (!manifest.permissions.includes(permission)) throw new Error(`Extension ${id} lacks permission ${permission}`);
  }
}

export function extensionConformance(manifest: ExtensionManifest): { ok: boolean; checks: string[] } {
  const validated = validateExtensionManifest(manifest);
  const checks = ['manifest-valid','no-shell-authority','no-general-project-write','package-relative-entrypoint'];
  if (validated.permissions.includes('credential-handle')) checks.push('opaque-credential-handle-only');
  return { ok: true, checks };
}
