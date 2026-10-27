import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY30,DAY30_EVENT,DAY30_ENTITIES} from '../lib/day30-storehouse-relief.mjs';
test('Day 30 preserves three unique, visible non-resource delivery marks',()=>{
 assert.equal(DAY30,30);
 assert.equal(DAY30_EVENT,'day30_storehouse_relief_sorting');
 assert.equal(DAY30_ENTITIES.length,3);
 assert.equal(new Set(DAY30_ENTITIES.map(e=>e.id)).size,3);
 assert.ok(DAY30_ENTITIES.every(e=>['trail','object'].includes(e.type)));
 assert.ok(DAY30_ENTITIES.filter(e=>e.type==='object').every(e=>e.origin===DAY30_EVENT&&e.history));
 assert.ok(DAY30_ENTITIES.filter(e=>e.type==='trail').every(e=>e.points.length>=2));
 assert.ok(DAY30_ENTITIES.filter(e=>e.type==='object').every(e=>e.x>6.5&&e.z>8));
});
