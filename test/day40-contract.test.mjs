import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY40,DAY40_EVENT,DAY40_ENTITIES} from '../lib/day40-third-watch.mjs';
test('Day 40 marks third patrol without touching inventory',()=>{
 assert.equal(DAY40,40);
 assert.equal(DAY40_EVENT,'day40_third_watch_circuit_recorded');
 assert.equal(DAY40_ENTITIES.length,2);
 assert.equal(new Set(DAY40_ENTITIES.map(e=>e.id)).size,2);
 assert.ok(DAY40_ENTITIES.every(e=>e.origin===DAY40_EVENT));
 assert.ok(DAY40_ENTITIES.some(e=>e.type==='trail'&&e.points.length>=3));
 assert.ok(DAY40_ENTITIES.every(e=>e.x===undefined||e.x < -29));
});
test('Day 40 release requires authorization and guarded day advancement',()=>{
 const src=readFileSync('netlify/functions/day40-release.mjs','utf8');
 assert.match(src,/GPTWORLD_RELEASE_TOKEN/);
 assert.match(src,/FOR UPDATE/);
 assert.match(src,/NOT EXISTS/);
 assert.match(src,/already_released:true/);
 assert.match(src,/patrols'\)::int >= 3/);
 assert.doesNotMatch(src,/DELETE FROM|TRUNCATE|DROP TABLE/i);
});
