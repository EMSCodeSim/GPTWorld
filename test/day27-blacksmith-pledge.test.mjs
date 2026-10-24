import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY27,DAY27_EVENT,DAY27_ENTITIES} from '../lib/day27-blacksmith-pledge.mjs';
test('Day 27 is one visible blacksmith-contribution evolution with unique stable IDs', () => {
 assert.equal(DAY27,27);
 assert.equal(DAY27_EVENT,'day27_blacksmith_pledge_yard');
 assert.equal(DAY27_ENTITIES.length,3);
 assert.equal(new Set(DAY27_ENTITIES.map(e=>e.id)).size,3);
 assert.equal(DAY27_ENTITIES.filter(e=>e.type==='trail').length,1);
 assert.equal(DAY27_ENTITIES.filter(e=>e.type==='object').length,2);
 assert.ok(DAY27_ENTITIES.every(e=>e.type!=='resource' && e.type!=='building'));
 assert.ok(DAY27_ENTITIES.filter(e=>e.type==='object').every(e=>e.origin===DAY27_EVENT && e.history.length>30));
 assert.ok(DAY27_ENTITIES.every(e=>Object.isFrozen(e)));
});
