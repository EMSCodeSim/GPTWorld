import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resource=readFileSync(new URL('../netlify/functions/resource-state.mjs',import.meta.url),'utf8');
const world=readFileSync(new URL('../netlify/functions/world-v2.mjs',import.meta.url),'utf8');
const client=readFileSync(new URL('../day8-firebreak.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('dynamic resources carry authoritative coordinates',()=>{
  assert.match(resource,/const x=safeCoordinate\(entity\.x\),z=safeCoordinate\(entity\.z\)/);
  assert.match(resource,/if\(x===null\|\|z===null\)continue/);
  assert.match(resource,/regrowMinutes:safeInt\(entity\.regrowMinutes,defaults\.regrowMinutes,1,10080\),\s*x,z/);
});

test('Day 8 firebreak uses server-authoritative project action',()=>{
  assert.match(world,/body\.action === 'contribute_firebreak'/);
  assert.match(world,/UPDATE player_inventory pi SET wood=wood-calc\.accepted_wood,stone=stone-calc\.accepted_stone/);
  assert.match(world,/western_firebreak_completed/);
  assert.match(world,/'western-firebreak','type','trail'/);
});

test('Day 8 stays hidden before authoritative day 8',()=>{
  assert.match(client,/if\(day<8\|\|!clientId\(\)\|\|!nearFirebreak\(g\)\)/);
  assert.match(index,/day8-firebreak\.js/);
  assert.doesNotMatch(index,/PUBLIC WORLD · DAY 5/);
});
