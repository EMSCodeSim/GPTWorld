import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advancePlant,growthStageForAge,harvestPlant,normalizePlant,resourceLifecycle} from '../lib/plant-lifecycle.mjs';
import {advancePlantIndividuals} from '../lib/individual-plants.mjs';

test('growth stages transition in order and dead plants stay dead',()=>{
  assert.deepEqual([0,1,2,4,14,22].map(age=>growthStageForAge(age,100)),['seed','sprout','young','mature','old','dead']);
  assert.equal(growthStageForAge(6,0),'dead');
});

test('legacy visible plants are promoted to mature without changing their identity',()=>{
  const state={simulatedYear:5,climate:{rainfall:.7},species:[{id:'rivergrass',kind:'plant',population:100}],plantIndividuals:[{id:'plant-rivergrass-5-0',speciesId:'rivergrass',slot:0,age:0,stage:'seed',health:1,resources:0}]};
  advancePlantIndividuals(state,5);
  assert.equal(state.plantIndividuals[0].id,'plant-rivergrass-5-0');
  assert.equal(state.plantIndividuals[0].stage,'mature');
  assert.equal(state.plantIndividuals[0].resources,1);
  const snapshot=structuredClone(state.plantIndividuals);advancePlantIndividuals(state,5);assert.deepEqual(state.plantIndividuals,snapshot);
});

test('simulation advances age, stage, health, and resources once per year',()=>{
  const young=normalizePlant(null,{id:'p',speciesId:'wild-herb',year:0,maxResources:3,legacyMature:false});
  const next=advancePlant(young,{year:2,moisture:.8});
  assert.equal(next.stage,'young');assert.ok(next.health>young.health-1);assert.ok(next.resources>0);
  assert.deepEqual(advancePlant(next,{year:2,moisture:.8}),next);
});

test('harvest reduces exactly one plant and records history',()=>{
  const plant=normalizePlant(null,{id:'p',speciesId:'wild-herb',year:4,maxResources:3,legacyMature:true});
  const result=harvestPlant(plant,{amount:1,year:4,playerId:7});
  assert.equal(result.ok,true);assert.equal(result.plant.resources,2);assert.equal(result.plant.harvestHistory.length,1);assert.equal(plant.resources,3);
});

test('a depleted plant rejects repeat harvests and a felled tree is a stump',()=>{
  const herb=normalizePlant({lifecycleVersion:2,id:'h',speciesId:'wild-herb',age:6,health:100,resources:0,maxResources:3,stage:'mature'},{id:'h'});
  assert.equal(harvestPlant(herb).error,'plant_depleted');
  const tree=normalizePlant({lifecycleVersion:2,id:'t',speciesId:'pine-tree',age:6,health:100,resources:1,maxResources:6,stage:'mature'},{id:'t'});
  const felled=harvestPlant(tree);assert.equal(felled.plant.stage,'dead');assert.equal(felled.plant.state,'stump');assert.equal(felled.plant.resources,0);
});

test('resource recovery uses persisted elapsed time and reload cannot multiply it',()=>{
  const start=new Date('2026-01-01T00:00:00Z'),later=new Date('2026-01-01T00:10:00Z');
  const node=resourceLifecycle({plant:{lifecycleVersion:2,id:'h',speciesId:'wild-herb',age:6,health:100,resources:0,maxResources:3,stage:'mature'},lastGrowthAt:start.toISOString()},{nodeId:'herb-0',resource:'herbs',max:3,now:start});
  const grown=resourceLifecycle(node,{nodeId:'herb-0',resource:'herbs',max:3,now:later});
  const reload=resourceLifecycle(grown,{nodeId:'herb-0',resource:'herbs',max:3,now:later});
  assert.equal(grown.remaining,1);assert.equal(reload.remaining,grown.remaining);assert.equal(reload.plant.id,grown.plant.id);
});

test('dead tree does not regrow and replacement gets a new stable identity',()=>{
  const dead={plant:{lifecycleVersion:2,id:'tree-0:plant:1',speciesId:'pine-tree',age:6,health:0,resources:0,maxResources:6,stage:'dead'},generation:1,lastGrowthAt:'2026-01-01T00:00:00Z',replacementAt:'2026-01-02T00:00:00Z'};
  const before=resourceLifecycle(dead,{nodeId:'tree-0',resource:'wood',max:6,now:new Date('2026-01-01T12:00:00Z')});assert.equal(before.plant.stage,'dead');assert.equal(before.remaining,0);
  const after=resourceLifecycle(dead,{nodeId:'tree-0',resource:'wood',max:6,now:new Date('2026-01-03T00:00:00Z')});assert.equal(after.plant.stage,'seed');assert.equal(after.plant.id,'tree-0:plant:2');assert.equal(after.remaining,0);
});

test('world identity isolates otherwise identical plant sites',()=>{
  const a=normalizePlant(null,{id:'private-10:tree-0:plant:1',speciesId:'pine-tree',legacyMature:true,maxResources:6});
  const b=normalizePlant(null,{id:'private-11:tree-0:plant:1',speciesId:'pine-tree',legacyMature:true,maxResources:6});
  const changed=harvestPlant(a).plant;assert.equal(changed.resources,5);assert.equal(b.resources,6);assert.notEqual(a.id,b.id);
});

test('server endpoints enforce receipts, range, ownership, and inventory-only-on-change',()=>{
  const publicSource=fs.readFileSync(new URL('../netlify/functions/resource-state.mjs',import.meta.url),'utf8');
  const privateSource=fs.readFileSync(new URL('../netlify/functions/private-world.mjs',import.meta.url),'utf8');
  assert.match(publicSource,/public_resource_action_receipts/);assert.match(publicSource,/resource_out_of_range/);assert.match(publicSource,/FROM changed/);
  assert.match(publicSource,/plant'->>'resources'/);assert.match(publicSource,/resource_changed/);
  assert.match(privateSource,/owner_player_id=\$\{player\.id\}/);assert.match(privateSource,/sqrt\(power\(s\.private_x-r\.x/);assert.match(privateSource,/FROM gathered/);
});
