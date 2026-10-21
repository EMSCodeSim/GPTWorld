import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY25,DAY25_EVENT,DAY25_ENTITIES} from '../lib/day25-winter-firewatch.mjs';
test('Day 25 winter survey persists four unique visible landmarks',()=>{
 assert.equal(DAY25,25);
 assert.equal(DAY25_EVENT,'day25_winter_firewatch_survey');
 assert.equal(DAY25_ENTITIES.length,4);
 assert.equal(new Set(DAY25_ENTITIES.map(x=>x.id)).size,4);
 assert.ok(DAY25_ENTITIES.some(x=>x.type==='trail'));
 assert.ok(DAY25_ENTITIES.filter(x=>x.type==='object').every(x=>x.origin==='day24_firewatch_gauge'));
 assert.ok(DAY25_ENTITIES.every(x=>x.type!=='resource'));
});
