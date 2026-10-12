import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const avatarApi = fs.readFileSync(new URL('../netlify/functions/avatar.mjs', import.meta.url), 'utf8');
const avatarUi = fs.readFileSync(new URL('../avatar-ui.js', import.meta.url), 'utf8');
const avatarCss = fs.readFileSync(new URL('../avatar-ui.css', import.meta.url), 'utf8');
const equip3d = fs.readFileSync(new URL('../lib/avatar-equipment-3d.mjs', import.meta.url), 'utf8');
const privateWorld = fs.readFileSync(new URL('../private-world.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const survival = fs.readFileSync(new URL('../netlify/functions/survival.mjs', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../migrations/014_player_equipped_items.sql', import.meta.url), 'utf8');

test('avatar API validates ownership, slots, and never duplicates items', () => {
  assert.match(avatarApi, /player_equipped_items/);
  assert.match(avatarApi, /item_not_in_backpack/);
  assert.match(avatarApi, /wrong_equipment_slot/);
  assert.match(avatarApi, /DELETE FROM player_equipped_items WHERE player_id=\$\{actor\.id\} AND item_id=/);
  assert.match(avatarApi, /equipmentBonuses/);
  assert.match(avatarApi, /enrichItemView/);
  assert.doesNotMatch(avatarApi, /DELETE FROM player_crafted_items/);
});

test('avatar UI uses live 3D preview and shared character model', () => {
  assert.match(avatarUi, /createPixelHumanoid/);
  assert.match(avatarUi, /applyAvatarEquipment/);
  assert.match(avatarUi, /avatarPreview/);
  assert.match(avatarUi, /avatarStats/);
  assert.match(avatarUi, /Compare/);
  assert.match(avatarCss, /#avatarPreview/);
  assert.match(avatarCss, /\.avatar-stats/);
});

test('public and private worlds apply the same equipment attachments', () => {
  assert.match(main, /applyAvatarEquipment/);
  assert.match(privateWorld, /applyAvatarEquipment/);
  assert.match(privateWorld, /equippedMainHand/);
  assert.match(equip3d, /attachments/);
  assert.match(equip3d, /attachMainHand|mainHand/);
  assert.match(equip3d, /CHARACTER_LAYER/);
  assert.match(equip3d, /markOnCharacterLayer/);
});

test('hunting requires equipped main-hand weapon server-side', () => {
  assert.match(survival, /player_equipped_items/);
  assert.match(survival, /equippedMainHand/);
  assert.match(survival, /equipment_not_equipped|equipment_required/);
  assert.match(survival, /weaponDamage|shotPower/);
});

test('equipment persistence migration defines seven slots', () => {
  assert.match(migration, /player_equipped_items/);
  assert.match(migration, /mainHand/);
  assert.match(migration, /offHand/);
  assert.match(migration, /UNIQUE \(player_id, item_id\)/);
});
