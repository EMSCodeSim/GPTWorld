import test from 'node:test';
import assert from 'node:assert/strict';
import {animalLandRoute,ecologyHabitatZones,ecologyRenderEntities} from '../netlify/functions/_sim-core.mjs';

const ecosystem={
  species:[
    {id:'rivergrass',kind:'plant',population:7200,habitat:'riverbank',lifeCycle:{}},
    {id:'thornbrush',kind:'plant',population:4100,habitat:'scrub',lifeCycle:{}},
    {id:'meadow-grazer',kind:'herbivore',population:380,habitat:'grassland',traits:{size:.36}},
    {id:'reed-runner',kind:'herbivore',population:240,habitat:'riverbank',traits:{size:.18}},
    {id:'ridge-stalker',kind:'predator',population:42,habitat:'ridge',traits:{size:.54}}
  ],
  plantPatches:[{id:'rivergrass-ridge-2',speciesId:'rivergrass',habitat:'ridge',population:700,stage:'developing'}]
};
const weather={season:'Spring',wind:.2,precipitationRate:0};

test('public habitat zones surround the settlement instead of centering on town',()=>{
  for(const habitat of ['grassland','riverbank','scrub','ridge']){
    const zones=ecologyHabitatZones(habitat,.5);
    assert.ok(zones.length>=4);
    assert.ok(zones.every(zone=>Math.hypot(zone.x,zone.z)>12));
  }
});

test('public plants spread across the valley outside the town core',()=>{
  const entities=ecologyRenderEntities(ecosystem,0,weather),plants=entities.filter(entity=>entity.species&&entity.part!=='creature'&&entity.part!=='trail');
  const xs=plants.map(entity=>entity.x),zs=plants.map(entity=>entity.z);
  assert.ok(plants.length>40);
  assert.ok(plants.filter(entity=>Math.hypot(entity.x,entity.z)>=12).length/plants.length>.9);
  assert.ok(Math.max(...xs)-Math.min(...xs)>45);
  assert.ok(Math.max(...zs)-Math.min(...zs)>40);
});

test('plant species have distinct readable silhouettes and names',()=>{
  const plants=ecologyRenderEntities(ecosystem,0,weather).filter(entity=>entity.species&&entity.part!=='creature'&&entity.part!=='trail');
  const rivergrass=plants.filter(entity=>entity.species==='rivergrass'),thornbrush=plants.filter(entity=>entity.species==='thornbrush');
  assert.ok(rivergrass.some(entity=>entity.part==='blade'));
  assert.ok(rivergrass.some(entity=>entity.part==='flower'&&entity.color==='#d8bd62'));
  assert.ok(thornbrush.some(entity=>entity.part==='crown'));
  assert.ok(thornbrush.some(entity=>entity.part==='flower'&&entity.color==='#b45f45'));
  assert.ok(plants.every(entity=>typeof entity.speciesName==='string'&&entity.speciesName.length>0));
});

test('food web visibly consumes plants and prey before seeking new targets',()=>{
  const frames=Array.from({length:140},(_,frame)=>ecologyRenderEntities(ecosystem,frame*800,weather));
  const plantCounts=frames.map(entities=>entities.filter(entity=>entity.clusterId).length);
  const animalCounts=frames.map(entities=>entities.filter(entity=>entity.part==='creature').length);
  const creatures=frames.flatMap(entities=>entities.filter(entity=>entity.part==='creature'));
  assert.ok(creatures.some(entity=>entity.behavior==='seeking food'&&entity.foodTarget));
  assert.ok(creatures.some(entity=>entity.behavior==='feeding'&&entity.consumedPlant));
  assert.ok(creatures.some(entity=>entity.kind==='predator'&&entity.behavior==='stalking'&&entity.foodTarget));
  assert.ok(creatures.some(entity=>entity.kind==='predator'&&entity.preyKilled));
  assert.ok(Math.min(...plantCounts)<Math.max(...plantCounts));
  assert.ok(Math.min(...animalCounts)<Math.max(...animalCounts));
  const targets=new Set(creatures.filter(entity=>entity.kind==='herbivore').map(entity=>entity.foodTarget).filter(Boolean));
  assert.ok(targets.size>2);
});

test('public animals follow long roaming routes while remaining outside town buildings',()=>{
  const first=ecologyRenderEntities(ecosystem,0,weather).filter(entity=>entity.part==='creature');
  const later=ecologyRenderEntities(ecosystem,110*800,weather).filter(entity=>entity.part==='creature');
  const laterById=new Map(later.map(entity=>[entity.animalId,entity]));
  const distances=first.map(entity=>{const next=laterById.get(entity.animalId);return Math.hypot(next.x-entity.x,next.z-entity.z);});
  assert.ok(first.every(entity=>Math.hypot(entity.x,entity.z)>=11.5));
  assert.ok(distances.filter(distance=>distance>10).length/distances.length>.75);
  for(let frame=0;frame<=440;frame+=22){
    const animals=ecologyRenderEntities(ecosystem,frame*800,weather).filter(entity=>entity.part==='creature');
    assert.ok(animals.every(entity=>Math.hypot(entity.x,entity.z)>=11.45));
  }
});

test('land animals stay on the map and cross the river only on the bridge',()=>{
  for(let frame=0;frame<=660;frame+=3){
    const animals=ecologyRenderEntities(ecosystem,frame*800,weather).filter(entity=>entity.part==='creature');
    assert.ok(animals.every(entity=>Math.abs(entity.x)<=31.2&&Math.abs(entity.z)<=31.2));
    assert.ok(animals.every(entity=>!(entity.x>-29&&entity.x<-19)||Math.abs(entity.z)<=1.45));
  }
  const samples=Array.from({length:101},(_,index)=>animalLandRoute({x:-31,z:18},{x:12,z:-20},index/100,'bridge-test'));
  assert.ok(samples.some(point=>point.x>-29&&point.x<-19&&Math.abs(point.z)<=1.45));
  assert.ok(samples.every(point=>!(point.x>-29&&point.x<-19)||Math.abs(point.z)<=1.45));
});

test('placeholder ecology trails and shelter blocks are not rendered',()=>{
  const withAnimalHomes={...ecosystem,animalGroups:[
    {id:'grazer-herd',speciesId:'meadow-grazer',type:'herd',shelterType:'nesting ground',habitat:'grassland'},
    {id:'stalker-pack',speciesId:'ridge-stalker',type:'pack',shelterType:'den',habitat:'ridge'}
  ]};
  const entities=ecologyRenderEntities(withAnimalHomes,0,weather);
  assert.ok(entities.every(entity=>!String(entity.id).startsWith('eco-trail-')));
  assert.ok(entities.every(entity=>!String(entity.id).startsWith('eco-home-')));
});
