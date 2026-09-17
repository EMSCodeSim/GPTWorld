import test from 'node:test';
import assert from 'node:assert/strict';
import {ecologyHabitatZones,ecologyRenderEntities} from '../netlify/functions/_sim-core.mjs';

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
