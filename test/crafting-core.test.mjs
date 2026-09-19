import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  CRAFTING_RECIPES,
  CRAFTING_SKILL_KEYS,
  HOUSE_BLUEPRINT,
  HOUSE_SUCCESS_CURVE,
  craftingChance,
  craftingRecipe,
  houseMaterialLoss,
  housePreview,
  houseSuccessChance,
  isValidHomesteadSite,
  qualityDurability,
  recentlyUnlockedRecipes,
  recipeUnlocked,
  recipesForSkillView,
  resolveCraftAttempt,
  resolveHouseAttempt,
  spentInputs
} from '../netlify/lib/crafting-core.mjs';

test('crafting professions include construction and preserve starter recipes',()=>{
  assert.ok(CRAFTING_SKILL_KEYS.includes('construction'));
  assert.ok(CRAFTING_SKILL_KEYS.includes('blacksmithing'));
  assert.ok(CRAFTING_RECIPES.length>=10);
  assert.ok(['carpentry','masonry','herbalism'].every(skill=>CRAFTING_RECIPES.some(recipe=>recipe.skill===skill)));
  assert.ok(CRAFTING_RECIPES.every(recipe=>Object.keys(recipe.inputs).every(resource=>['wood','stone','herbs'].includes(resource))));
  assert.equal(craftingRecipe('campfire-kit').minSkill,0);
  assert.equal(craftingRecipe('wooden-beam').component,true);
  assert.equal(craftingRecipe('not-real'),null);
});

test('recipe skill gates and progressive unlock bands',()=>{
  assert.equal(recipeUnlocked(craftingRecipe('wooden-crate'),9),false);
  assert.equal(recipeUnlocked(craftingRecipe('wooden-crate'),10),true);
  assert.equal(resolveCraftAttempt({skillValue:5,difficulty:12,key:'locked',minSkill:10}).locked,true);
  const view=recipesForSkillView([{key:'carpentry',value:15},{key:'masonry',value:0}]);
  assert.equal(view.find(recipe=>recipe.key==='wooden-crate').unlocked,true);
  assert.equal(view.find(recipe=>recipe.key==='wooden-beam').unlocked,false);
  assert.ok(view.find(recipe=>recipe.key==='wooden-beam').requiredSkill===20);
});

test('anti-grind reduces XP for trivial crafts while hard crafts still train',()=>{
  const trivial=resolveCraftAttempt({skillValue:80,difficulty:0,key:'trivial'});
  const challenging=resolveCraftAttempt({skillValue:20,difficulty:22,key:'hard'});
  assert.ok(trivial.grindScale<=.2);
  assert.ok(trivial.skillGain<challenging.skillGain||challenging.skillGain>0);
  assert.equal(resolveCraftAttempt({skillValue:100,difficulty:14,key:'master'}).skillGain,0);
});

test('craft outcomes are reproducible and improve with skill',()=>{
  const first=resolveCraftAttempt({skillValue:22,difficulty:14,key:'player:recipe:request'});
  const again=resolveCraftAttempt({skillValue:22,difficulty:14,key:'player:recipe:request'});
  assert.deepEqual(first,again);
  assert.ok(craftingChance(70,14)>craftingChance(0,14));
  assert.equal(craftingChance(0,0),1);
  assert.equal(craftingChance(0,4),1);
  assert.ok(first.chance>=.18&&first.chance<=.98);
});

test('failed attempts consume only part of the recipe and quality affects durability',()=>{
  const recipe=craftingRecipe('stone-hearth');
  assert.deepEqual(spentInputs(recipe,false),{wood:1,stone:5,herbs:0});
  assert.deepEqual(spentInputs(recipe,true),recipe.inputs);
  assert.ok(qualityDurability(50,'exceptional')>qualityDurability(50,'fine'));
  assert.ok(qualityDurability(50,'fine')>qualityDurability(50,'standard'));
});

test('house success curve is configurable and interpolated',()=>{
  assert.equal(houseSuccessChance(79),0);
  assert.equal(houseSuccessChance(80),.25);
  assert.equal(houseSuccessChance(85),.4);
  assert.equal(houseSuccessChance(90),.6);
  assert.equal(houseSuccessChance(95),.8);
  assert.equal(houseSuccessChance(100),.95);
  assert.ok(houseSuccessChance(82)> .25&&houseSuccessChance(82)<.4);
  assert.deepEqual(HOUSE_SUCCESS_CURVE[0],[80,.25]);
  const loss=houseMaterialLoss(HOUSE_BLUEPRINT,false);
  assert.equal(loss.wood,14);
  assert.equal(loss.stone,10);
  assert.deepEqual(houseMaterialLoss(HOUSE_BLUEPRINT,true),HOUSE_BLUEPRINT.materials);
});

test('house preview and site validation gate construction',()=>{
  const ready=housePreview([{key:'construction',value:80}],{wood:50,stone:30,herbs:5},['wooden-beam','wooden-beam','wooden-door','stone-foundation','iron-fittings']);
  assert.equal(ready.canAttempt,true);
  assert.equal(ready.chance,.25);
  const locked=housePreview([{key:'construction',value:79}],{wood:50,stone:30,herbs:5},['wooden-beam','wooden-beam','wooden-door','stone-foundation','iron-fittings']);
  assert.equal(locked.canAttempt,false);
  assert.equal(isValidHomesteadSite(0,3,{existing:[],water:{x:-19,z:-10,radius:6.5}}),true);
  assert.equal(isValidHomesteadSite(0,3,{existing:[{x:1,z:2,width:7}]}),false);
  assert.equal(isValidHomesteadSite(-19,-10,{existing:[],water:{x:-19,z:-10,radius:6.5}}),false);
  const attempt=resolveHouseAttempt({skillValue:80,key:'same'});
  assert.deepEqual(attempt,resolveHouseAttempt({skillValue:80,key:'same'}));
});

test('unlock notifications fire when crossing skill thresholds',()=>{
  const unlocks=recentlyUnlockedRecipes([{key:'construction',value:80}],[{key:'construction',value:79}]);
  assert.equal(unlocks.length,1);
  assert.match(unlocks[0].message,/Construction reached 80/);
  assert.match(unlocks[0].message,/Basic Homestead/);
  const crate=recentlyUnlockedRecipes([{key:'carpentry',value:10}],[{key:'carpentry',value:9}]);
  assert.ok(crate.some(entry=>entry.recipeKey==='wooden-crate'));
});

test('construction 2 migration is additive and preserves skills',async()=>{
  const sql=(await readFile(new URL('../migrations/008_crafting_construction_2.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/blacksmithing/);
  assert.match(sql,/construction/);
  assert.match(sql,/private_construction_receipts/);
  assert.match(sql,/private_building_furniture/);
  assert.match(sql,/add column if not exists width/);
  assert.doesNotMatch(sql,/\btruncate\b|\bdrop table\b/);
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

test('crafting endpoint gates recipes and builds houses server-side',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/recipe_locked/);
  assert.match(server,/async function buildHouse/);
  assert.match(server,/action==='build_house'/);
  assert.match(server,/private_construction_receipts/);
  assert.match(server,/place_interior_furniture/);
  assert.match(server,/house_already_built/);
  assert.match(server,/HOUSE_BLUEPRINT/);
  assert.match(server,/owner_player_id=\$\{actor\.id\}/);
  assert.match(server,/async function campfireAction/);
  assert.match(server,/async function crateTransfer/);
});

test('private world payload exposes persistent buildings',async()=>{
  const server=await readFile(new URL('../netlify/functions/private-world.mjs',import.meta.url),'utf8');
  assert.match(server,/private_world_buildings/);
  assert.match(server,/buildings:/);
});

test('campfire and crate actions are proximity checked and server authoritative',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/inventory\.wood>=1/);
  assert.match(server,/ecology_state->>'weather'.*<>'heavy rain'/s);
  assert.match(server,/sqrt\(power\(session\.private_x-item\.placed_x/);
  assert.match(server,/crafted_item_use_receipts/);
  assert.match(server,/wood\+storage\.stone\+storage\.herbs\+\$\{amount\}<=storage\.capacity/);
  assert.match(server,/Math\.min\(60,Math\.floor/);
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
  assert.match(client,/function makeCampfireFlame/);
  assert.match(client,/group\.position\.set\(item\.x,1,item\.z\)/);
  assert.match(client,/THREE\.AdditiveBlending/);
  assert.match(client,/emberSeeds/);
  assert.match(client,/function openPlacedCraftFromTap/);
  assert.match(client,/Store all \(\$\{storeAll\}\)/);
  assert.match(client,/function refreshCrateStorageLabel/);
  assert.match(css,/\.crate-actions\{display:grid/);
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

test('private-world client exposes skill-aware crafting and construction',async()=>{
  const [html,client,shell,css]=await Promise.all([
    readFile(new URL('../private-world.html',import.meta.url),'utf8'),
    readFile(new URL('../private-world.js',import.meta.url),'utf8'),
    readFile(new URL('../private-world-shell.js',import.meta.url),'utf8'),
    readFile(new URL('../private-world.css',import.meta.url),'utf8')
  ]);
  assert.match(html,/id="craftButton"/);
  assert.match(html,/id="craftingPanel"/);
  assert.match(html,/id="craftingResult"/);
  assert.match(html,/id="constructionPanel"/);
  assert.match(html,/id="houseBlueprint"/);
  assert.match(html,/user-scalable=no/);
  assert.match(client,/function renderCrafting/);
  assert.match(client,/function showCraftingResult/);
  assert.match(client,/function showCraftingError/);
  assert.match(client,/function addHomesteadBuilding/);
  assert.match(client,/function enterHomestead/);
  assert.match(client,/function buildHouse/);
  assert.match(client,/function installInteriorFurniture/);
  assert.match(client,/action:'build_house'/);
  assert.match(client,/place_interior_furniture/);
  assert.match(client,/private-interior/);
  assert.match(client,/gptworld-private-spawn|PRIVATE_INTERIOR_SPAWN_KEY/);
  assert.match(client,/metadata\?\.interior===true/);
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
  assert.match(css,/\.recipe-card\.locked/);
  assert.match(css,/\.construction-panel/);
  assert.match(client,/gesturestart/);
  assert.match(client,/action:'gather_resource'/);
});
