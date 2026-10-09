import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('release metadata identifies FlickSmith v0.4 and preserves earlier changelog history',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 const readme=readFileSync('README.md','utf8');
 const changelog=readFileSync('CHANGELOG.md','utf8');
 assert.equal(pkg.version,'0.4.0');
 assert.match(readme,/Current v0\.4 professional motion engine/);
 assert.doesNotMatch(readme,/## Current v0\.2 engine/);
 assert.match(changelog,/## \[0\.4\.0\]/); assert.match(changelog,/## \[0\.3\.0\]/);
});
