import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync(new URL('../netlify/functions/survival.mjs',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../migrations/011_farming_hunting.sql',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../private-world.js',import.meta.url),'utf8');

test('survival endpoint enforces private ownership, range and idempotency',()=>{
  assert.match(api,/w\.owner_player_id=p\.id/);assert.match(api,/current_world_type/);assert.match(api,/survival_action_receipts/);assert.match(api,/sqrt\(power/);
});
test('migration is additive and has no destructive resets',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS private_farm_plots/);assert.match(migration,/CREATE TABLE IF NOT EXISTS private_hunting_state/);assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE/);
});
test('mobile private world exposes contextual farming and hunting actions',()=>{
  assert.match(ui,/prepare_plot/);assert.match(ui,/harvest_crop/);assert.match(ui,/animal_out_of_range/);assert.match(ui,/openSurvival\(nearest\)/);
});
test('harvested food connects to cooking without a second inventory',()=>{
  assert.match(api,/cookStew/);assert.match(api,/item_key IN \('raw-meat','carrot'\)/);assert.match(api,/itemKey:'trail-rations'/);
  assert.match(api,/skill_key='cooking'/);assert.match(ui,/Cook camp stew/);
});
