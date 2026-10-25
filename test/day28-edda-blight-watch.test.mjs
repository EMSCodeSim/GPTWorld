import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY28,DAY28_EVENT,DAY28_ENTITIES} from '../lib/day28-edda-blight-watch.mjs';

test('Day 28 marks the winter garden blight without granting resources or changing autonomous systems', () => {
 assert.equal(DAY28,28);
 assert.equal(DAY28_EVENT,'day28_edda_blight_watch');
 assert.equal(DAY28_ENTITIES.length,3);
 assert.equal(new Set(DAY28_ENTITIES.map(e=>e.id)).size,DAY28_ENTITIES.length);
 assert.equal(DAY28_ENTITIES.filter(e=>e.type==='trail').length,1);
 assert.equal(DAY28_ENTITIES.filter(e=>e.type==='terrain').length,1);
 assert.equal(DAY28_ENTITIES.filter(e=>e.type==='object').length,1);
 assert.ok(DAY28_ENTITIES.every(e=>!['resource','building'].includes(e.type)));
 assert.ok(DAY28_ENTITIES.filter(e=>e.type!=='trail').every(e=>e.origin===DAY28_EVENT && e.history.length>40));
 assert.ok(DAY28_ENTITIES.every(Object.isFrozen));
});
