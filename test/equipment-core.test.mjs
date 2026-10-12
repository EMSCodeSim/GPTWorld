import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_DEFINITIONS,
  equipmentDefinition,
  slotsForItemKey,
  equipmentBonuses,
  compareEquipment,
  huntingRangeFor,
  huntingDamageFor,
  enrichItemView,
  isBowWeapon
} from '../netlify/lib/equipment-core.mjs';
import {huntingRange, resolveHuntAttempt} from '../netlify/lib/hunting-core.mjs';
import {craftingRecipe, CRAFTING_RECIPES} from '../netlify/lib/crafting-core.mjs';
import {transportForPlayer} from '../netlify/lib/progression-core.mjs';

test('equipment catalog covers required starter gear and seven slots', () => {
  assert.deepEqual(EQUIPMENT_SLOTS, ['head', 'chest', 'legs', 'feet', 'back', 'mainHand', 'offHand']);
  for (const key of [
    'basic-bow',
    'reinforced-bow',
    'composite-bow',
    'leather-tunic',
    'leather-boots',
    'traveler-backpack',
    'iron-chestplate',
    'wooden-shield'
  ]) {
    assert.ok(EQUIPMENT_DEFINITIONS[key], `missing definition ${key}`);
    assert.equal(equipmentDefinition(key).slot, slotsForItemKey(key)[0]);
  }
  assert.equal(equipmentDefinition('basic-bow').damage, 12);
  assert.equal(equipmentDefinition('reinforced-bow').range, 6.2);
  assert.equal(equipmentDefinition('leather-tunic').defense, 2);
  assert.equal(equipmentDefinition('iron-chestplate').defense, 6);
  assert.equal(equipmentDefinition('traveler-backpack').carryingCapacity, 20);
  assert.equal(equipmentDefinition('wooden-shield').slot, 'offHand');
});

test('armor bonuses require equipped keys and never ownership alone', () => {
  const ownedOnly = equipmentBonuses([]);
  assert.equal(ownedOnly.defense, 0);
  assert.equal(ownedOnly.carryingCapacity, 0);
  const equipped = equipmentBonuses(['leather-tunic', 'leather-boots', 'wooden-shield', 'traveler-backpack', 'reinforced-bow']);
  assert.equal(equipped.defense, 6);
  assert.equal(equipped.carryingCapacity, 20);
  assert.equal(equipped.damage, 18);
  assert.equal(equipped.range, 6.2);
  assert.equal(equipped.defenseAffectsCombat, false);
  assert.equal(equipped.carryingAffectsTransport, true);
});

test('equipment comparison reports deltas before replace', () => {
  const cmp = compareEquipment('leather-tunic', 'iron-chestplate');
  assert.equal(cmp.delta.defense, 4);
  assert.equal(cmp.candidateName, 'Iron Chestplate');
});

test('bow hunting range and damage come from shared definitions', () => {
  assert.equal(huntingRange('basic-bow'), huntingRangeFor('basic-bow'));
  assert.equal(huntingRange('composite-bow'), 7.5);
  assert.equal(huntingDamageFor('reinforced-bow'), 18);
  assert.ok(isBowWeapon('basic-bow'));
  const shot = resolveHuntAttempt({
    key: 'test:bow',
    equipment: 'composite-bow',
    skill: 40,
    distance: 3
  });
  assert.equal(shot.ok, true);
  assert.equal(shot.weaponDamage, 26);
  assert.equal(shot.maxRange, 7.5);
});

test('craft recipes exist for starter wearable equipment', () => {
  for (const key of ['leather-tunic', 'leather-boots', 'traveler-backpack', 'iron-chestplate', 'wooden-shield']) {
    const recipe = craftingRecipe(key);
    assert.ok(recipe, key);
    assert.ok(recipe.equipSlot);
    assert.ok(CRAFTING_RECIPES.some(entry => entry.key === key));
  }
});

test('traveler backpack capacity bonus only applies when passed as equipped bonus', () => {
  const base = transportForPlayer({hasCart: false, cartLoad: 0});
  assert.equal(base.capacity, 40);
  const boosted = transportForPlayer({hasCart: false, cartLoad: 10, capacityBonus: 20});
  assert.equal(boosted.capacity, 60);
  assert.equal(boosted.capacityBonus, 20);
  assert.equal(boosted.name, 'Traveler Backpack');
});

test('enrichItemView exposes equippable stats for avatar UI', () => {
  const view = enrichItemView({
    id: 9,
    item_key: 'basic-bow',
    display_name: 'Basic Bow',
    quality: 'standard',
    durability: 40,
    max_durability: 45,
    quantity: 1
  });
  assert.deepEqual(view.eligibleSlots, ['mainHand']);
  assert.equal(view.damage, 12);
  assert.equal(view.category, 'weapon');
});
