import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY26,DAY26_EVENT,DAY26_ENTITIES} from '../lib/day26-core.mjs';

test('Day 26 creates three unique persistent and inspectable winter herb relay marks',()=>{
 assert.equal(DAY26,26);
 assert.equal(DAY26_EVENT,'day26_edda_winter_herb_relay');
 assert.equal(DAY26_ENTITIES.length,3);
 assert.equal(new Set(DAY26_ENTITIES.map(e=>e.id)).size,3);
 assert.ok(DAY26_ENTITIES.every(e=>e.id.startsWith('day26-')));
 assert.ok(DAY26_ENTITIES.every(e=>e.label));
 assert.equal(DAY26_ENTITIES.filter(e=>e.type==='trail').length,1);
 assert.ok(DAY26_ENTITIES.filter(e=>e.type==='object').every(e=>e.origin===DAY26_EVENT && e.history));
 assert.ok(DAY26_ENTITIES.every(e=>e.type!=='resource'));
});
