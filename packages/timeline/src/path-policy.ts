import { resolve, sep } from 'node:path';

export function validatePermittedPath(inputPath: string, roots: string[]): string {
  if (!roots.length) throw new Error('No permitted media roots configured');
  const candidate = resolve(inputPath);
  const allowed = roots.some(root => {
    const normalizedRoot = resolve(root);
    return candidate === normalizedRoot || candidate.startsWith(normalizedRoot + sep);
  });
  if (!allowed) throw new Error(`Path is outside permitted media roots: ${inputPath}`);
  return candidate;
}
