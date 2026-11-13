import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY43,DAY43_EVENT,DAY43_ENTITIES} from '../lib/day43-firewatch-embers.mjs';

test('Day 43 adds exactly two unique dryland landmarks for the fifth patrol',()=>{
 assert.equal(DAY43,43);
 assert.equal(DAY43_ENTITIES.length,2);
 assert.equal(new Set(DAY43_ENTITIES.map(e=>e.id)).size,2);
 assert.ok(DAY43_ENTITIES.every(e=>e.origin===DAY43_EVENT));
 assert.ok(DAY43_ENTITIES.some(e=>e.type==='trail'&&e.points.length>=3));
 assert.ok(DAY43_ENTITIES.some(e=>e.type==='object'&&e.x < -29.6));
 assert.ok(DAY43_ENTITIES.every(e=>e.type!=='object'||e.x < -29.6));
});
