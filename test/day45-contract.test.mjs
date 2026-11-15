import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY45,DAY45_EVENT,DAY45_ENTITIES} from '../lib/day45-spring-scour.mjs';
test('Day 45 preserves a unique visible spring drainage survey',()=>{
 assert.equal(DAY45,45);
 assert.equal(DAY45_EVENT,'day45_spring_scour_survey_recorded');
 assert.equal(DAY45_ENTITIES.length,2);
 assert.equal(new Set(DAY45_ENTITIES.map(x=>x.id)).size,2);
 assert.ok(DAY45_ENTITIES.some(x=>x.type==='trail'&&x.points.length>=2));
 assert.ok(DAY45_ENTITIES.some(x=>x.type==='object'));
 for(const entity of DAY45_ENTITIES)assert.equal(entity.origin,DAY45_EVENT);
});
test('Day 45 release is guarded, idempotent and inventory-neutral',()=>{
 const src=readFileSync('netlify/functions/day45-release.mjs','utf8');
 assert.match(src,/current===DAY45/);
 assert.match(src,/current!==DAY45-1/);
 assert.match(src,/FOR UPDATE/);
 assert.match(src,/already_released:true/);
 assert.match(src,/patrols'\)::int\s*>=\s*6/);
 assert.doesNotMatch(src,/UPDATE player_inventory|DELETE FROM player_inventory|UPDATE players/);
});
