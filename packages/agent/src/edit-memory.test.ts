import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditMemoryStore } from './edit-memory.ts';

test('edit memory is local, inspectable, removable, and deterministic', () => {
  const dir = mkdtempSync(join(tmpdir(),'flicksmith-memory-'));
  const store = new EditMemoryStore(join(dir,'memory.json'));
  store.set({id:'captions', kind:'caption_max_chars', value:42, source:'user'});
  store.set({id:'no-zoom', kind:'avoid_transition', value:'zoom', source:'user'});
  assert.deepEqual(store.list().map(r=>r.id), ['captions','no-zoom']);
  assert.deepEqual(store.compile(), { captionMaxChars:42, avoidedTransitions:['zoom'] });
  store.remove('no-zoom');
  assert.deepEqual(store.compile(), { captionMaxChars:42, avoidedTransitions:[] });
});
