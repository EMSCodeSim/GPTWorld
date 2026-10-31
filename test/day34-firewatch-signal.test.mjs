import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY34,DAY34_EVENT,DAY34_ENTITIES,decorateDay34Firewatch} from '../lib/day34-firewatch-signal.mjs';

test('Day 34 adds three permanent non-resource marks beside the existing firewatch',()=>{
  assert.equal(DAY34,34);
  assert.equal(DAY34_EVENT,'day34_firewatch_signal_gauge');
  assert.deepEqual(DAY34_ENTITIES.map(e=>e.type),['trail','object','object']);
  assert.equal(new Set(DAY34_ENTITIES.map(e=>e.id)).size,3);
  assert.ok(DAY34_ENTITIES.slice(1).every(e=>e.origin===DAY34_EVENT&&e.x< -24&&e.z>12&&e.z<14));
});
test('live signal reacts to authoritative risk, active fire and explicit firebreak contributions without mutating history',()=>{
  const unchanged={id:'existing',type:'object',x:1,z:1};
  const entities=[...DAY34_ENTITIES,unchanged];
  const low=decorateDay34Firewatch(entities,{risks:{wildfire:.1},active:[]},{wood:0,stone:0,woodGoal:6,stoneGoal:24,complete:false},{drought:.3},{stage:'critical'});
  const high=decorateDay34Firewatch(entities,{risks:{wildfire:.82},active:[]},{wood:3,stone:8,woodGoal:6,stoneGoal:24,complete:false},{drought:.85},{stage:'critical'});
  const fire=decorateDay34Firewatch(entities,{risks:{wildfire:.1},active:[{type:'wildfire'}]},{wood:6,stone:24,woodGoal:6,stoneGoal:24,complete:true},{drought:0},{stage:'recovering'});
  assert.notEqual(low[1].color,high[1].color);
  assert.equal(high[1].color,fire[1].color);
  assert.match(high[2].history,/3\/6 wood, 8\/24 stone/);
  assert.match(fire[2].label,/complete/);
  assert.match(fire[1].label,/active wildfire/);
  assert.equal(low[3],unchanged);
  assert.equal(entities[1].label,'Firewatch warning signal');
  assert.deepEqual(decorateDay34Firewatch(null),[]);
  assert.match(decorateDay34Firewatch(DAY34_ENTITIES,{},null,null,null)[2].history,/0\/6 wood/);
});
