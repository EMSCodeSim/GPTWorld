import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY41,DAY41_EVENT,DAY41_ENTITIES} from '../lib/day41-winter-watch.mjs';
test('Day 41 preserves the fourth patrol as two unique visible marks',()=>{
 assert.equal(DAY41,41);assert.equal(DAY41_ENTITIES.length,2);
 assert.equal(new Set(DAY41_ENTITIES.map(e=>e.id)).size,2);
 assert.ok(DAY41_ENTITIES.every(e=>e.origin===DAY41_EVENT));
 assert.ok(DAY41_ENTITIES.some(e=>e.type==='trail'&&e.points.length>=3));
 assert.ok(DAY41_ENTITIES.every(e=>e.x===undefined||e.x < -29));
});
test('Day 41 release is guarded, idempotent, non-destructive',()=>{
 const src=readFileSync('netlify/functions/day41-release.mjs','utf8');
 for(const marker of ['GPTWORLD_RELEASE_TOKEN','FOR UPDATE','NOT EXISTS','already_released:true','render_entities','world_events'])assert.ok(src.includes(marker));
 assert.match(src,/patrols'\)::int >= 4/);
 assert.doesNotMatch(src,/DELETE FROM|TRUNCATE|DROP TABLE/i);
});
