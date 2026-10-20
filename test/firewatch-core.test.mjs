import test from 'node:test';
import assert from 'node:assert/strict';
import {firewatchReport} from '../lib/firewatch-core.mjs';

test('reads wildfire, drought, pressure, and server-side project requirements', () => {
  const text = firewatchReport({weather_sim:{drought:.746},forest_pressure:{stage:'critical'},disaster_sim:{risks:{wildfire:.549},active:[]},firebreak_project:{wood:2,stone:5,woodGoal:6,stoneGoal:24,complete:false}});
  assert.match(text,/Wildfire risk 55%/);
  assert.match(text,/Drought 75%/);
  assert.match(text,/Forest critical/);
  assert.match(text,/needs 4 wood and 19 stone/);
});

test('reports active wildfire without implying firebreak is complete', () => {
  assert.match(firewatchReport({disaster_sim:{active:[{type:'wildfire'}]}}),/Active wildfire reported/);
});

test('handles missing state and completed projects without NaN', () => {
  assert.doesNotMatch(firewatchReport(),/NaN|undefined/);
  assert.match(firewatchReport({firebreak_project:{complete:true}}),/Firebreak complete/);
});


test('live gauge reads soil moisture and rain',()=>{const report=firewatchReport({weather_sim:{soilMoisture:.088,precipitation:'rain'}});assert.match(report,/Soil moisture 9%/);assert.match(report,/Weather rain/);});
