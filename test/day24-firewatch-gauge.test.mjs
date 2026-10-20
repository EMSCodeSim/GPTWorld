import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY24,DAY24_ENTITIES} from '../lib/day24-firewatch-gauge.mjs';

test('Day 24 gauge leaves unique inspectable world marks',()=>{
 assert.equal(DAY24,24);
 assert.equal(new Set(DAY24_ENTITIES.map(x=>x.id)).size,DAY24_ENTITIES.length);
 assert.ok(DAY24_ENTITIES.some(x=>x.type==='trail'));
 assert.ok(DAY24_ENTITIES.some(x=>x.origin==='day24_firewatch_gauge'));
});
