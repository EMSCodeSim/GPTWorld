import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY37,DAY37_ENTITIES,DAY37_EVENT} from '../lib/day37-first-patrol.mjs';
const release=readFileSync(new URL('../netlify/functions/day37-release.mjs',import.meta.url),'utf8');
test('Day 37 preserves first patrol visibly on dry land',()=>{
 assert.equal(DAY37,37);assert.equal(DAY37_ENTITIES.length,2);
 assert.ok(DAY37_ENTITIES.every(e=>e.type==='trail'?e.points.every(p=>p[0]<-38):e.x<-38));
 assert.equal(new Set(DAY37_ENTITIES.map(e=>e.id)).size,2);
});
test('Day 37 requires prior chapter and actual patrol, with idempotent release',()=>{
 assert.match(release,/current!==DAY37-1/);
 assert.match(release,/firebreak_watch/);
 assert.match(release,/already_released:true/);
 assert.match(release,/world_events WHERE event_type/);
 assert.match(release,/FOR UPDATE/);
 assert.match(release,/const DAY37_EVENT|DAY37_EVENT/);
 assert.equal(DAY37_EVENT,'day37_first_firebreak_patrol_recorded');
});
