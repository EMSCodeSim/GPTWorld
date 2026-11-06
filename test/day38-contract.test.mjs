import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY38,DAY38_ENTITIES,DAY38_EVENT} from '../lib/day38-fire-scar.mjs';
const release=readFileSync(new URL('../netlify/functions/day38-release.mjs',import.meta.url),'utf8');
test('Day 38 wildfire observation leaves two dryland marks',()=>{
 assert.equal(DAY38,38);assert.equal(DAY38_ENTITIES.length,2);
 assert.ok(DAY38_ENTITIES.every(e=>e.type==='trail'?e.points.every(p=>p[0]<-38):e.x<-38));
 assert.equal(new Set(DAY38_ENTITIES.map(e=>e.id)).size,2);
});
test('Day 38 is gated by the prior day and real autonomous wildfire history',()=>{
 assert.match(release,/current!==DAY38-1/);
 assert.match(release,/disaster_tick/);
 assert.match(release,/wildfire/);
 assert.match(release,/already_released:true/);
 assert.match(release,/FOR UPDATE/);
 assert.equal(DAY38_EVENT,'day38_firebreak_wildfire_scar_recorded');
});
