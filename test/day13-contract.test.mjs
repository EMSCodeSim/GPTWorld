import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const client=readFileSync(new URL('../day8-firebreak.js',import.meta.url),'utf8');
const release=readFileSync(new URL('../netlify/functions/day13-release.mjs',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('firebreak staging reads server-authoritative pack',()=>{
  assert.match(client,/serverPack=/);
  assert.match(client,/if\(data\.me\)serverPack=/);
  assert.match(client,/Server pack:/);
  assert.doesNotMatch(client,/Number\(g\.inventory\?\.stone/);
});

test('Day 13 release is guarded and leaves a persistent staging mark',()=>{
  assert.match(release,/const DAY=13/);
  assert.match(release,/firebreak-staging-cairn/);
  assert.match(release,/currentDay!==DAY-1/);
  assert.match(release,/day13_firebreak_staging_opened/);
  assert.match(index,/day8-firebreak\.js\?v=day13-staging-1/);
});
