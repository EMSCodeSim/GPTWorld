import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('town upgrades spend only settlement stockpile and unlock interiors at level 2',async()=>{
  const [upgrades,stockpile,day3,info,town]=await Promise.all([
    readFile(new URL('../netlify/functions/town-upgrades.mjs',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/stockpile.mjs',import.meta.url),'utf8'),
    readFile(new URL('../day3.js',import.meta.url),'utf8'),
    readFile(new URL('../info-center.js',import.meta.url),'utf8'),
    readFile(new URL('../town.html',import.meta.url),'utf8')
  ]);
  assert.match(upgrades,/settlement_stockpile/);
  assert.doesNotMatch(upgrades,/player_inventory/);
  assert.match(upgrades,/FOR UPDATE/);
  assert.match(stockpile,/action==='deposit'|action:"deposit"|'deposit'/);
  assert.match(day3,/Deposit 1 wood/);
  assert.match(day3,/depositing/);
  assert.match(info,/info-tabs/);
  assert.match(info,/Living Memory/);
  assert.match(town,/Interior unlocks at Level 2/);
  assert.match(town,/Enter \$\{building\.name\}|Enter /);
});
