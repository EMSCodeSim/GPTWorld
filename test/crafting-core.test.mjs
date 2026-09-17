import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CRAFTING_RECIPES,craftingChance,craftingRecipe,qualityDurability,resolveCraftAttempt,spentInputs} from '../netlify/lib/crafting-core.mjs';

test('starter crafting professions use existing private-world resources',()=>{
  assert.ok(CRAFTING_RECIPES.length>=6);
  assert.deepEqual(new Set(CRAFTING_RECIPES.map(recipe=>recipe.skill)),new Set(['carpentry','masonry','herbalism']));
  assert.ok(CRAFTING_RECIPES.every(recipe=>Object.keys(recipe.inputs).every(resource=>['wood','stone','herbs'].includes(resource))));
  assert.equal(craftingRecipe('stone-hammer').skill,'masonry');
  assert.equal(craftingRecipe('not-real'),null);
});

test('craft outcomes are reproducible and improve with skill',()=>{
  const first=resolveCraftAttempt({skillValue:22,difficulty:14,key:'player:recipe:request'});
  const again=resolveCraftAttempt({skillValue:22,difficulty:14,key:'player:recipe:request'});
  assert.deepEqual(first,again);
  assert.ok(craftingChance(70,14)>craftingChance(0,14));
  assert.ok(first.chance>=.18&&first.chance<=.98);
  assert.ok(first.skillGain>=0&&first.skillGain<=.6);
});

test('failed attempts consume only part of the recipe and quality affects durability',()=>{
  const recipe=craftingRecipe('stone-hearth');
  assert.deepEqual(spentInputs(recipe,false),{wood:1,stone:5,herbs:0});
  assert.deepEqual(spentInputs(recipe,true),recipe.inputs);
  assert.ok(qualityDurability(50,'exceptional')>qualityDurability(50,'fine'));
  assert.ok(qualityDurability(50,'fine')>qualityDurability(50,'standard'));
});

test('crafting migration is additive and preserves player ownership',async()=>{
  const sql=(await readFile(new URL('../migrations/003_private_world_crafting.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists player_crafting_skills/);
  assert.match(sql,/create table if not exists player_crafted_items/);
  assert.match(sql,/create table if not exists crafting_action_receipts/);
  assert.match(sql,/primary key \(player_id, idempotency_key\)/);
  assert.doesNotMatch(sql,/\bdrop\s+(table|column|database)\b|\btruncate\b/);
});

test('crafting endpoint requires private ownership and atomically changes materials',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/current_world_type='private'/);
  assert.match(server,/w\.owner_player_id=\$\{actor\.id\}/);
  assert.match(server,/UPDATE player_inventory SET wood=wood-/);
  assert.match(server,/crafting_action_receipts/);
  assert.match(server,/item_crafted/);
});

test('private-world client exposes a mobile crafting ledger',async()=>{
  const [html,client]=await Promise.all([
    readFile(new URL('../private-world.html',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8')
  ]);
  assert.match(html,/id="craftButton"/);
  assert.match(html,/id="craftingPanel"/);
  assert.match(html,/user-scalable=no/);
  assert.match(client,/function renderCrafting/);
  assert.match(client,/gesturestart/);
  assert.match(client,/action:'gather_resource'/);
});
