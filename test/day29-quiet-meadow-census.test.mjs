import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY29,DAY29_EVENT,DAY29_ENTITIES} from '../lib/day29-quiet-meadow-census.mjs';
test('Day 29 census marks are unique and non-resource',()=>{
 assert.equal(DAY29,29);
 assert.equal(DAY29_EVENT,'day29_quiet_meadow_census');
 assert.equal(DAY29_ENTITIES.length,4);
 assert.equal(new Set(DAY29_ENTITIES.map(e=>e.id)).size,4);
 assert.ok(DAY29_ENTITIES.every(e=>e.type==='trail'||e.type==='object'));
});
