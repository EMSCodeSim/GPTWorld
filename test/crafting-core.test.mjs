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

test('functional crafted items use additive owner-scoped persistence',async()=>{
  const sql=(await readFile(new URL('../migrations/005_functional_crafted_items.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists crafted_item_storage/);
  assert.match(sql,/item_id bigint primary key references player_crafted_items/);
  assert.match(sql,/player_id bigint not null references players/);
  assert.match(sql,/check \(wood \+ stone \+ herbs <= capacity\)/);
  assert.match(sql,/create table if not exists crafted_item_use_receipts/);
  assert.doesNotMatch(sql,/drop table|truncate|delete from/);
});

test('campfire and crate actions are proximity checked and server authoritative',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/async function campfireAction/);
  assert.match(server,/async function crateTransfer/);
  assert.match(server,/inventory\.wood>=1/);
  assert.match(server,/ecology_state->>'weather'.*<>'heavy rain'/s);
  assert.match(server,/sqrt\(power\(session\.private_x-item\.placed_x/);
  assert.match(server,/crafted_item_use_receipts/);
  assert.match(server,/wood\+storage\.stone\+storage\.herbs\+\$\{amount\}<=storage\.capacity/);
});

test('private world exposes usable campfires and crates on mobile',async()=>{
  const [html,client,css]=await Promise.all([
    readFile(new URL('../private-world.html',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8'),
    readFile(new URL('../private-world.css',import.meta.url),'utf8')
  ]);
  assert.match(html,/id="craftedUsePanel"/);
  assert.match(client,/light_campfire/);
  assert.match(client,/crate_transfer/);
  assert.match(client,/Warmth, light, and wildlife protection/);
  assert.match(client,/data\.behavior='avoiding fire'/);
  assert.match(css,/\.crafted-use-panel\{position:fixed;z-index:1100/);
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
  const [html,client,shell,css]=await Promise.all([
    readFile(new URL('../private-world.html',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8'),
    readFile(new URL('../private-world-shell.js',import.meta.url),'utf8'),
    readFile(new URL('../private-world.css',import.meta.url),'utf8')
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
  assert.match(html,/private-world-shell\.js/);
  assert.match(shell,/panel\.hidden=false/);
  assert.match(shell,/capture:true/);
  assert.match(css,/\.crafting-panel\{position:fixed;z-index:1000/);
  assert.match(css,/\.crafting-panel\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.crafting-recipes/);
  assert.match(client,/gesturestart/);
  assert.match(client,/action:'gather_resource'/);
});
