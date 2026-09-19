import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPrecipitation} from '../lib/weather-visuals.mjs';
import {RESOURCE_DEFAULTS,privateKindToResource} from '../lib/resource-defaults.mjs';

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
  assert.deepEqual(RESOURCE_DEFAULTS.stone,{max:4,regrowMinutes:90});
  assert.deepEqual(RESOURCE_DEFAULTS.herbs,{max:3,regrowMinutes:20});
  assert.equal(privateKindToResource('tree'),'wood');
  assert.equal(privateKindToResource('rock'),'stone');
  assert.equal(privateKindToResource('herbs'),'herbs');
});
