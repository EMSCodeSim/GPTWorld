import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY44,DAY44_EVENT,DAY44_ENTITIES} from '../lib/day44-thaw-crossing.mjs';
test('Day 44 marks are unique, durable and renderable',()=>{
 assert.equal(DAY44,44);
 assert.equal(DAY44_EVENT,'day44_thaw_crossing_recorded');
 assert.equal(DAY44_ENTITIES.length,2);
 assert.equal(new Set(DAY44_ENTITIES.map(x=>x.id)).size,2);
 for(const mark of DAY44_ENTITIES){assert.equal(mark.origin,DAY44_EVENT);assert.ok(mark.history);assert.ok(mark.type==='trail'||mark.type==='object');}
});
