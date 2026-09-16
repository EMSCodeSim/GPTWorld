import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advancePrivateEcology,generatePrivateWorld,normalizePosition,ownsWorld,seedFromPlayerId} from '../netlify/lib/private-world-core.mjs';

test('each player receives a stable, distinct generation seed',()=>{
  assert.equal(seedFromPlayerId(42),seedFromPlayerId(42));
  assert.notEqual(seedFromPlayerId(42),seedFromPlayerId(43));
});

test('private terrain generation is deterministic and contains required biomes',()=>{
  const first=generatePrivateWorld(12345),again=generatePrivateWorld(12345),other=generatePrivateWorld(67890);
  assert.deepEqual(first,again);
  assert.notDeepEqual(first.objects,other.objects);
  assert.ok(first.water);
  assert.ok(first.farmland.fertility>0);
  assert.ok(first.clearing.radius>=8);
  assert.ok(first.objects.some(item=>item.kind==='tree'));
  assert.ok(first.objects.some(item=>item.kind==='rock'));
  assert.ok(first.objects.some(item=>item.kind==='wildlife'));
});

test('world ownership denies a different player',()=>{
  assert.equal(ownsWorld(7,7),true);
  assert.equal(ownsWorld('7',7),true);
  assert.equal(ownsWorld(8,7),false);
});

test('offline ecology is elapsed-time based and bounded',()=>{
  const now=new Date('2026-09-16T12:00:00Z');
  const sixHoursAgo='2026-09-16T06:00:00Z';
  const one=advancePrivateEcology({seed:9,tick:0,season:'Spring',seasonDay:1,weather:'clear',soilMoisture:.6},sixHoursAgo,now);
  assert.equal(one.steps,1);
  const yearsAgo=advancePrivateEcology(one.state,'2020-01-01T00:00:00Z',now);
  assert.equal(yearsAgo.steps,120);
  assert.equal(yearsAgo.capped,true);
});

test('server position normalization prevents leaving world bounds',()=>{
  assert.deepEqual(normalizePosition(500,-500),{x:33,z:-33});
  assert.deepEqual(normalizePosition('bad',null,{x:4,z:5}),{x:4,z:0});
});

test('foundation migration is additive and includes travel idempotency',async()=>{
  const sql=(await readFile(new URL('../migrations/001_living_worlds_foundation.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists player_worlds/);
  assert.match(sql,/primary key \(player_id, idempotency_key\)/);
  assert.doesNotMatch(sql,/\bdrop\s+(table|column|database)\b/);
  assert.doesNotMatch(sql,/\btruncate\b/);
});
