import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advancePrivateEcology,generatePrivateWorld,initialPrivateEcology,normalizePosition,ownsWorld,seedFromPlayerId} from '../netlify/lib/private-world-core.mjs';
import {WORLD_GATEWAY,isInsideWorldGateway} from '../world-gateway.mjs';

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

test('living ecology produces deterministic weather, growth, and wildlife state',()=>{
  const state=initialPrivateEcology(9123);
  const from='2026-09-16T06:00:00Z',now=new Date('2026-09-16T18:00:00Z');
  const first=advancePrivateEcology(state,from,now),again=advancePrivateEcology(state,from,now);
  assert.deepEqual(first,again);
  assert.equal(first.steps,2);
  assert.equal(first.state.worldHour,20);
  assert.match(first.state.weather,/^(clear|rain|heavy rain|snow)$/);
  assert.ok(first.state.plantGrowth>=.25&&first.state.plantGrowth<=1);
  assert.ok(first.state.soilMoisture>=.08&&first.state.soilMoisture<=1);
  assert.ok(first.state.wildlife>=2);
});

test('legacy private ecology upgrades without advancing simulation time',()=>{
  const now=new Date('2026-09-16T12:00:00Z');
  const result=advancePrivateEcology({version:1,seed:44,tick:3,season:'Autumn'},now.toISOString(),now);
  assert.equal(result.steps,0);
  assert.equal(result.upgraded,true);
  assert.equal(result.state.version,2);
  assert.equal(result.state.worldHour,8);
  assert.equal(result.state.wildlife,7);
  assert.equal(result.state.soilMoisture,.64);
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

test('personal-world archway sits at the far end of the bridge and supports walk-through entry',()=>{
  assert.equal(WORLD_GATEWAY.x,-30.8);
  assert.equal(WORLD_GATEWAY.z,0);
  assert.equal(isInsideWorldGateway(-30.8,0),true);
  assert.equal(isInsideWorldGateway(-29.7,0),false);
  assert.equal(isInsideWorldGateway(-30.8,1.4),false);
});
