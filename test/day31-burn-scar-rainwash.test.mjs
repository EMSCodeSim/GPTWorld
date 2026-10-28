import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY31,DAY31_EVENT,DAY31_ENTITIES} from '../lib/day31-burn-scar-rainwash.mjs';
test('Day 31 records four unique visible rainwash landmarks without granting resources',()=>{
 assert.equal(DAY31,31);
 assert.equal(DAY31_EVENT,'day31_burn_scar_rainwash_survey');
 assert.equal(DAY31_ENTITIES.length,4);
 assert.equal(new Set(DAY31_ENTITIES.map(e=>e.id)).size,DAY31_ENTITIES.length);
 assert.deepEqual(DAY31_ENTITIES.map(e=>e.type),['trail','terrain','object','object']);
 assert.ok(DAY31_ENTITIES.every(e=>e.type!=='resource'));
 assert.ok(DAY31_ENTITIES.filter(e=>e.type==='trail').every(e=>e.points.length>=2));
 assert.ok(DAY31_ENTITIES.filter(e=>e.type!=='trail').every(e=>e.origin===DAY31_EVENT&&e.history&&e.x<0&&e.z>18));
 assert.ok(DAY31_ENTITIES.some(e=>e.type==='terrain'));
});
