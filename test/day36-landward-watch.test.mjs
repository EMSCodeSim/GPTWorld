import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY36,DAY36_EVENT,DAY36_ENTITIES,decorateDay36LandwardWatch} from '../lib/day36-landward-watch.mjs';
import {DAY35_ENTITIES} from '../lib/day35-firebreak-watch.mjs';
import {readFileSync} from 'node:fs';

test('Day 36 creates three unique persistent dryland marks west of the river',()=>{
  assert.equal(DAY36,36);
  assert.equal(DAY36_EVENT,'day36_landward_firebreak_muster');
  assert.deepEqual(DAY36_ENTITIES.map(e=>e.type),['trail','terrain','object']);
  assert.equal(new Set(DAY36_ENTITIES.map(e=>e.id)).size,3);
  assert.ok(DAY36_ENTITIES.every(e=>e.origin===DAY36_EVENT));
  for(const e of [...DAY35_ENTITIES,...DAY36_ENTITIES]){
    if(e.points)assert.ok(e.points.every(([x])=>x<=-30),e.id);
    else assert.ok(e.x<=-30,e.id);
  }
});
test('patrol traffic visibly wears the route without changing authoritative state',()=>{
  const watch={patrols:5,lastInspector:'Ranger'};
  const risk={risks:{wildfire:.9},active:[{type:'wildfire'}]};
  const result=decorateDay36LandwardWatch(DAY36_ENTITIES,watch,risk);
  assert.ok(result[0].width>DAY36_ENTITIES[0].width);
  assert.match(result[0].label,/5 watches/);
  assert.match(result[2].history,/Ranger/);
  assert.match(result[2].history,/90\/100/);
  assert.notEqual(result[2].color,DAY36_ENTITIES[2].color);
  assert.deepEqual(watch,{patrols:5,lastInspector:'Ranger'});
  assert.deepEqual(decorateDay36LandwardWatch(null,watch,risk),[]);
});
test('release is gated, idempotent and never advances the autonomous clock',()=>{
  const source=readFileSync(new URL('../netlify/functions/day36-release.mjs',import.meta.url),'utf8');
  assert.match(source,/current===DAY36/);
  assert.match(source,/current!==DAY36-1/);
  assert.match(source,/FOR UPDATE/);
  assert.match(source,/NOT EXISTS/);
  assert.match(source,/world_events/);
  assert.doesNotMatch(source,/weather_sim|disaster_sim|world_aging/);
});
