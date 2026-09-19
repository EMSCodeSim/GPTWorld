import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPrecipitation} from '../lib/weather-visuals.mjs';
import {RESOURCE_DEFAULTS,privateKindToResource,isValidStoneDepositPosition,proposeStoneDeposit} from '../lib/resource-defaults.mjs';
import {readFile} from 'node:fs/promises';

test('precipitation classification is consistent across storm, rain, snow, and fog',()=>{
  assert.equal(classifyPrecipitation('storm').wet,true);
  assert.equal(classifyPrecipitation('heavy rain').wet,true);
  assert.equal(classifyPrecipitation('light shower').wet,true);
  assert.equal(classifyPrecipitation('snow').snow,true);
  assert.equal(classifyPrecipitation('overcast').cloudy,true);
  assert.equal(classifyPrecipitation('fog').foggy,true);
  assert.equal(classifyPrecipitation('clear').clear,true);
});

test('resource defaults match across wood, stone, and herbs',()=>{
  assert.deepEqual(RESOURCE_DEFAULTS.wood,{max:6,regrowMinutes:60});
  assert.deepEqual(RESOURCE_DEFAULTS.stone,{max:12,regrowMinutes:480});
  assert.deepEqual(RESOURCE_DEFAULTS.herbs,{max:3,regrowMinutes:20});
  assert.equal(privateKindToResource('tree'),'wood');
  assert.equal(privateKindToResource('rock'),'stone');
  assert.equal(privateKindToResource('herbs'),'herbs');
});

test('stone deposits reject water, town buildings, and crowded sites',()=>{
  assert.equal(isValidStoneDepositPosition(-24,0),false);
  assert.equal(isValidStoneDepositPosition(4,7),false);
  assert.equal(isValidStoneDepositPosition(0,0),false);
  assert.equal(isValidStoneDepositPosition(18,-12),true);
  const forced=proposeStoneDeposit({seed:1,existing:[],now:0});
  if(forced){
    assert.equal(forced.resource,'stone');
    assert.equal(forced.max,12);
    assert.ok(isValidStoneDepositPosition(forced.x,forced.z));
  }
});

test('public resource gather sets stone regrowth instead of permanent null timers',async()=>{
  const source=await readFile(new URL('../netlify/functions/resource-state.mjs',import.meta.url),'utf8');
  assert.match(source,/make_interval\(mins=>\$\{cfg\.regrowMinutes\}\)/);
  assert.match(source,/proposeStoneDeposit/);
  assert.match(source,/maybeSpawnStoneDeposit/);
  assert.doesNotMatch(source,/'regrowAt','null'::jsonb/);
});

test('plant individuals advance on the world sim and harvest through resource-state',async()=>{
  const [world,resources,plants]=await Promise.all([
    readFile(new URL('../netlify/functions/world.mjs',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/resource-state.mjs',import.meta.url),'utf8'),
    readFile(new URL('../lib/individual-plants.mjs',import.meta.url),'utf8')
  ]);
  assert.match(world,/advancePlantIndividuals/);
  assert.match(world,/harvestIndividualPlant/);
  assert.match(resources,/gatherIndividualPlant/);
  assert.match(resources,/nodeId\.startsWith\('plant-'\)/);
  assert.match(plants,/export function harvestIndividualPlant/);
  assert.match(plants,/Seed|stage|dead|normalizePlant/);
});
