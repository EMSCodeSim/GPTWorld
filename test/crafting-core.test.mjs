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
  assert.equal(craftingChance(0,0),1);
  assert.equal(craftingChance(0,4),1);
  assert.ok(craftingChance(0,12)<1);
  assert.ok(first.chance>=.18&&first.chance<=.98);
  assert.ok(first.skillGain>=.1&&first.skillGain<=.4);
  assert.equal(resolveCraftAttempt({skillValue:100,difficulty:14,key:'master'}).skillGain,0);
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

test('crafted item placement migration is additive and persistent',async()=>{
  const sql=(await readFile(new URL('../migrations/004_crafted_item_placement.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/add column if not exists placed_x/);
  assert.match(sql,/add column if not exists placed_at/);
  assert.match(sql,/crafted_item_action_receipts/);
  assert.doesNotMatch(sql,/\bdrop\s+(table|column|database)\b|\btruncate\b/);
});

test('crafting endpoint requires private ownership and atomically changes materials',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/current_world_type='private'/);
  assert.match(server,/w\.owner_player_id=\$\{actor\.id\}/);
  assert.match(server,/UPDATE player_inventory SET wood=wood-/);
  assert.match(server,/crafting_action_receipts/);
  assert.match(server,/item_crafted/);
  assert.match(server,/\$\{recipe\.key\}::text/);
  assert.match(server,/crafting_transaction_failed/);
  assert.match(server,/place_item/);
  assert.match(server,/pickup_item/);
});

test('private-world client exposes a mobile crafting ledger',async()=>{
  const [html,client]=await Promise.all([
    readFile(new URL('../private-world.html',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8')
  ]);
  assert.match(html,/id="craftButton"/);
  assert.match(html,/id="craftingPanel"/);
  assert.match(html,/id="craftingResult"/);
  assert.match(html,/user-scalable=no/);
  assert.match(client,/function renderCrafting/);
  assert.match(client,/function showCraftingResult/);
  assert.match(client,/function showCraftingError/);
  assert.match(client,/assets\/crafting/);
  assert.match(client,/className='recipe-icon'/);
  assert.match(client,/function placeCraftedItem/);
  assert.match(client,/function pickupCraftedItem/);
  assert.match(client,/craftingPanel\.hidden=false/);
  assert.match(client,/Opening your bag/);
  assert.match(client,/gesturestart/);
  assert.match(client,/action:'gather_resource'/);
});
