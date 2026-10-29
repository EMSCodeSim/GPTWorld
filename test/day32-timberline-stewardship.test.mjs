import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY32,DAY32_EVENT,DAY32_ENTITIES} from '../lib/day32-timberline-stewardship.mjs';

test('Day 32 creates a unique persistent timberline stewardship fork',()=>{
 assert.equal(DAY32,32);
 assert.equal(DAY32_EVENT,'day32_timberline_stewardship_fork');
 assert.equal(DAY32_ENTITIES.length,4);
 assert.equal(new Set(DAY32_ENTITIES.map(e=>e.id)).size,4);
 assert.deepEqual(DAY32_ENTITIES.map(e=>e.type),['trail','terrain','object','object']);
 assert.ok(DAY32_ENTITIES.every(e=>e.type!=='resource'));
 assert.ok(DAY32_ENTITIES.filter(e=>e.type==='trail').every(e=>e.points.length>=2));
 assert.ok(DAY32_ENTITIES.filter(e=>e.type!=='trail').every(e=>e.origin===DAY32_EVENT&&e.history&&e.x<0&&e.z>8));
 assert.ok(DAY32_ENTITIES.some(e=>e.history?.includes('existing forest response system')));
 assert.ok(DAY32_ENTITIES.some(e=>e.history?.includes('does not plant or grant a tree')));
});
