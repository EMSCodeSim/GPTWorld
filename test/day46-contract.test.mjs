import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAY46,DAY46_EVENT,DAY46_ENTITIES} from '../lib/day46-dry-watch.mjs';
test('Day 46 preserves a unique visible dry-weather watch route',()=>{
 assert.equal(DAY46,46);
 assert.equal(DAY46_EVENT,'day46_dry_watch_recorded');
 assert.equal(DAY46_ENTITIES.length,2);
 assert.equal(new Set(DAY46_ENTITIES.map(x=>x.id)).size,2);
 assert.ok(DAY46_ENTITIES.some(x=>x.type==='trail'&&x.points.length>=2));
 assert.ok(DAY46_ENTITIES.some(x=>x.type==='object'));
 for(const entity of DAY46_ENTITIES)assert.equal(entity.origin,DAY46_EVENT);
});
test('Day 46 release is guarded, idempotent and inventory-neutral',()=>{
 const src=readFileSync('netlify/functions/day46-release.mjs','utf8');
 assert.match(src,/current===DAY46/);
 assert.match(src,/current!==DAY46-1/);
 assert.match(src,/FOR UPDATE/);
 assert.match(src,/already_released:true/);
 assert.match(src,/patrols'\)::int\s*>=\s*7/);
 assert.doesNotMatch(src,/UPDATE player_inventory|DELETE FROM player_inventory|UPDATE players/);
});
