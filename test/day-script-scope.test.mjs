import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('classic day scripts do not collide on shared const names',async()=>{
  const [day3,day8,index]=await Promise.all([
    readFile(new URL('../day3.js',import.meta.url),'utf8'),
    readFile(new URL('../day8-firebreak.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(day3,/^const GAME_KEY=/m);
  assert.match(day8,/^\(function\(\)\{/m);
  assert.match(day8,/const GAME_KEY=/);
  assert.match(index,/day8-firebreak\.js\?v=day8-scope-1/);
});
