import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY23_ENTITIES} from '../lib/day23-firewatch.mjs';

test('Day 23 leaves distinct persistent and inspectable marks by the firebreak', () => {
  const ids=DAY23_ENTITIES.map(e=>e.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.includes('day23-firewatch-readiness-board'));
  assert.ok(DAY23_ENTITIES.some(e=>e.origin==='day23_firewatch'&&e.history));
  assert.ok(DAY23_ENTITIES.every(e=>e.type!=='resource'&&e.type!=='building'));
  assert.ok(DAY23_ENTITIES.filter(e=>e.x!=null).every(e=>e.x<=-26&&e.z>=5&&e.z<=16));
});
