import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advancePrivateEcology,generatePrivateWorld,initialPrivateEcology,normalizePosition,ownsWorld,privateResourceSeeds,privateResourceView,seedFromPlayerId,synchronizePrivateLivingState} from '../netlify/lib/private-world-core.mjs';
import {createPrivateWorldSnapshot,normalizeCachedPosition,snapshotToPrivateWorldPayload} from '../private-world-cache.mjs';
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
  assert.equal(first.farmland.prepared,false);
  assert.deepEqual(first.structures,[]);
  assert.ok(first.clearing.radius>=8);
  assert.ok(first.objects.some(item=>item.kind==='tree'));
  assert.ok(first.objects.some(item=>item.kind==='rock'));
  assert.ok(first.objects.some(item=>item.kind==='wildlife'));
});

test('personal world begins undeveloped and wildlife faces its movement axis',async()=>{
  const client=(await readFile(new URL('../private-world.js',import.meta.url),'utf8'));
  assert.doesNotMatch(client,/buildHomestead\(\)/);
  assert.doesNotMatch(client,/new THREE\.BoxGeometry\(terrain\.farmland\.width/);
  assert.match(client,/body\.scale\.set\(\.72,\.78,1\.45\)/);
  assert.match(client,/for\(const x of\[-\.22,\.22\]\)for\(const z of\[-\.4,\.4\]\)/);
});

test('personal terrain produces persistent gatherable resource nodes',()=>{
  const terrain=generatePrivateWorld(321),resources=privateResourceSeeds(terrain);
  assert.equal(resources.length,38+14+12);
  assert.equal(resources.filter(node=>node.resourceType==='wood').length,38);
  assert.equal(resources.filter(node=>node.resourceType==='stone').length,14);
  assert.equal(resources.filter(node=>node.resourceType==='herbs').length,12);
  assert.ok(resources.every(node=>node.metadata.regrowMinutes>0));
  assert.ok(resources.filter(node=>node.resourceType==='wood').every(node=>node.maxAmount===6&&node.metadata.regrowMinutes===60));
  assert.ok(resources.filter(node=>node.resourceType==='stone').every(node=>node.metadata.regrowMinutes===90));
  assert.ok(resources.filter(node=>node.resourceType==='herbs').every(node=>node.metadata.regrowMinutes===20));
  assert.equal(new Set(resources.map(node=>node.nodeId)).size,resources.length);
});

test('database resource rows normalize for the private-world client',()=>{
  assert.deepEqual(privateResourceView([{node_id:'tree-1',resource_type:'wood',x:'2.5',z:'-4',max_amount:'5',remaining:'3',regrow_at:null,generation:'2'}]),[
    {nodeId:'tree-1',resource:'wood',x:2.5,z:-4,maxAmount:5,remaining:3,regrowAt:null,generation:2}
  ]);
});

test('local snapshot caches world visuals and position but never authoritative inventory',()=>{
  const payload={
    world:{id:9,name:'Test World',seed:7,terrain:{spawn:{x:0,z:8}},ecology:{version:2}},
    session:{position:{x:4,z:-3}},
    inventory:{wood:999,stone:999,herbs:999},
    catchUp:{steps:4}
  };
  const snapshot=createPrivateWorldSnapshot(payload,'traveler-1',1234),cached=snapshotToPrivateWorldPayload(snapshot);
  assert.equal(snapshot.inventory,undefined);
  assert.equal(cached.inventory,null);
  assert.deepEqual(cached.session.position,{x:4,z:-3});
  assert.equal(cached.fromCache,true);
  assert.deepEqual(normalizeCachedPosition({x:500,z:-500}),{x:33,z:-33});
});

test('private offline shell caches only the private-world experience',async()=>{
  const worker=await readFile(new URL('../private-world-sw.js',import.meta.url),'utf8');
  assert.match(worker,/private-world\.html/);
  assert.match(worker,/private-world-cache\.mjs/);
  assert.match(worker,/three@0\.180\.0/);
  assert.doesNotMatch(worker,/index\.html/);
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

test('personal world synchronizes public weather, plants, and animal populations',()=>{
  const local=initialPrivateEcology(9123);
  const weather={tick:44,worldHour:20,season:'Autumn',seasonDay:12,temperatureC:7.5,precipitation:'heavy rain',precipitationRate:.85,wind:.7,soilMoisture:.92,drought:.05,snowCover:0};
  const ecosystem={simulatedYear:4,species:[
    {id:'rivergrass',kind:'plant',population:7000,lifeCycle:{waterStress:.1,grazingPressure:.2}},
    {id:'reed-runner',kind:'herbivore',population:240}
  ],plantPatches:[{id:'patch-1'}],animalGroups:[{id:'herd-1'}]};
  const synced=synchronizePrivateLivingState(local,weather,ecosystem);
  assert.equal(synced.weather,'heavy rain');
  assert.equal(synced.worldHour,20);
  assert.equal(synced.season,'Autumn');
  assert.equal(synced.temperatureC,7.5);
  assert.equal(synced.sharedWeatherTick,44);
  assert.equal(synced.sharedEcologyYear,4);
  assert.equal(synced.wildlife,240);
  assert.deepEqual(synced.species,ecosystem.species);
  assert.notEqual(synced.species,ecosystem.species);
});

test('private world uses the public living simulation and refreshes while occupied',async()=>{
  const [server,client,publicResources]=await Promise.all([
    readFile(new URL('../netlify/functions/private-world.mjs',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/resource-state.mjs',import.meta.url),'utf8')
  ]);
  assert.match(server,/ecologyRenderEntities\(living\.ecosystem/);
  assert.match(server,/world_state WHERE key IN \('weather_sim','ecosystem','forest_pressure'\)/);
  assert.match(server,/regrow_minutes/);
  assert.match(client,/syncLivingEntities\(data\.world\.livingEntities/);
  assert.match(client,/if\(time-lastLivingRefresh>12000\)refreshLivingWorld\(\)/);
  assert.match(publicResources,/wood:\{max:6,regrowMinutes:60\}/);
  assert.match(publicResources,/stone:\{max:4,regrowMinutes:90\}/);
  assert.match(publicResources,/herbs:\{max:3,regrowMinutes:20\}/);
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

test('private gathering migration is additive and idempotent',async()=>{
  const sql=(await readFile(new URL('../migrations/002_private_world_gathering.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists private_world_action_receipts/);
  assert.match(sql,/primary key \(player_id, idempotency_key\)/);
  assert.doesNotMatch(sql,/\bdrop\s+(table|column|database)\b/);
  assert.doesNotMatch(sql,/\btruncate\b/);
});

test('private gathering remains server-authoritative and records world history',async()=>{
  const server=await readFile(new URL('../netlify/functions/private-world.mjs',import.meta.url),'utf8');
  assert.match(server,/current_world_type='private'/);
  assert.match(server,/owner_player_id=\$\{player\.id\}/);
  assert.match(server,/private_world_action_receipts/);
  assert.match(server,/'resource_gathered'/);
  assert.match(server,/player_inventory\.wood\+EXCLUDED\.wood/);
});

test('personal-world archway sits at the far end of the bridge and supports walk-through entry',()=>{
  assert.equal(WORLD_GATEWAY.x,-30.8);
  assert.equal(WORLD_GATEWAY.z,0);
  assert.equal(isInsideWorldGateway(-30.8,0),true);
  assert.equal(isInsideWorldGateway(-29.7,0),false);
  assert.equal(isInsideWorldGateway(-30.8,1.4),false);
});
