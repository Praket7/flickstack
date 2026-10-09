import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type MemoryKind = 'caption_max_chars'|'avoid_transition'|'max_pause_ms'|'hook_pacing'|'cta_end_frames';
export interface EditPreference { id: string; kind: MemoryKind; value: string|number|boolean; source: 'user'|'project'|'learned'; note?: string }
export interface CompiledPreferences {
  captionMaxChars?: number;
  avoidedTransitions: string[];
  maxPauseMs?: number;
  hookPacing?: string;
  ctaEndFrames?: number;
}

export class EditMemoryStore {
  #path: string;
  #rules: EditPreference[];
  constructor(path: string) {
    this.#path = path;
    this.#rules = existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : [];
  }
  #save(): void {
    mkdirSync(dirname(this.#path), { recursive:true });
    writeFileSync(this.#path, JSON.stringify(this.#rules, null, 2) + '\n');
  }
  set(rule: EditPreference): void {
    const index = this.#rules.findIndex(r => r.id === rule.id);
    if (index >= 0) this.#rules[index] = structuredClone(rule); else this.#rules.push(structuredClone(rule));
    this.#rules.sort((a,b)=>a.id.localeCompare(b.id));
    this.#save();
  }
  remove(id: string): void { this.#rules = this.#rules.filter(r=>r.id!==id); this.#save(); }
  list(): EditPreference[] { return structuredClone(this.#rules); }
  compile(): CompiledPreferences {
    const compiled: CompiledPreferences = { avoidedTransitions: [] };
    for (const rule of this.#rules) {
      if (rule.kind === 'caption_max_chars' && typeof rule.value === 'number') compiled.captionMaxChars = rule.value;
      if (rule.kind === 'avoid_transition' && typeof rule.value === 'string') compiled.avoidedTransitions.push(rule.value);
      if (rule.kind === 'max_pause_ms' && typeof rule.value === 'number') compiled.maxPauseMs = rule.value;
      if (rule.kind === 'hook_pacing' && typeof rule.value === 'string') compiled.hookPacing = rule.value;
      if (rule.kind === 'cta_end_frames' && typeof rule.value === 'number') compiled.ctaEndFrames = rule.value;
    }
    compiled.avoidedTransitions.sort();
    return compiled;
  }
}
