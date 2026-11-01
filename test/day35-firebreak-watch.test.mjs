import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY35,DAY35_EVENT,DAY35_ENTITIES,decorateDay35FirebreakWatch} from '../lib/day35-firebreak-watch.mjs';

test('Day 35 places three unique permanent marks on the completed firebreak',()=>{
  assert.equal(DAY35,35);
  assert.equal(DAY35_EVENT,'day35_firebreak_first_watch');
  assert.deepEqual(DAY35_ENTITIES.map(e=>e.type),['trail','object','object']);
  assert.equal(new Set(DAY35_ENTITIES.map(e=>e.id)).size,3);
  assert.ok(DAY35_ENTITIES.slice(1).every(e=>e.origin===DAY35_EVENT));
});
test('patrol board reflects server-authoritative counts, completion, and autonomous wildfire state without mutation',()=>{
  const other={id:'existing',type:'object',x:2,z:2};
  const entities=[...DAY35_ENTITIES,other];
  const watch={patrols:3,lastInspector:'Traveler'};
  const calm=decorateDay35FirebreakWatch(entities,{complete:true},watch,{risks:{wildfire:.2},active:[]},{drought:.3});
  const fire=decorateDay35FirebreakWatch(entities,{complete:true},watch,{risks:{wildfire:.9},active:[{type:'wildfire'}]},{drought:.91});
  assert.match(calm[2].label,/3 patrols/);
  assert.match(calm[2].history,/24\/24 stone/);
  assert.match(fire[2].history,/active wildfire/);
  assert.notEqual(calm[1].color,fire[1].color);
  assert.equal(calm[3],other);
  assert.deepEqual(watch,{patrols:3,lastInspector:'Traveler'});
  assert.equal(entities[1].label,'Firebreak patrol post');
  assert.deepEqual(decorateDay35FirebreakWatch(null),[]);
});
