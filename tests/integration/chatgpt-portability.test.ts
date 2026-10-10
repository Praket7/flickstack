import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('repository is packaged for execution-capable ChatGPT environments',()=>{
  const manifest=JSON.parse(readFileSync('plugin.json','utf8'));
  assert.equal(manifest.name,'flicksmith');
  assert.match(manifest.version,/^0\.5\./);
  assert.equal(manifest.extensions?.['com.openai']?.onboardingSkill,'./skills/flicksmith-setup/SKILL.md');
  assert.ok(existsSync('skills/flicksmith-setup/SKILL.md'));
  assert.ok(existsSync('scripts/bootstrap-chatgpt.sh'));
  assert.ok(existsSync('scripts/smoke-chatgpt.sh'));
  const market=JSON.parse(readFileSync('.agents/plugins/marketplace.json','utf8'));
  assert.ok(market.plugins.some((p:any)=>p.name==='flicksmith'));
});
