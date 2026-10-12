/**
 * Shared equipment definitions for Avatar & Pack, 3D attachments, and hunting.
 * Bonuses apply only when an item is equipped — never from mere ownership.
 */

const freeze = (value) => Object.freeze(value);

export const EQUIPMENT_SLOTS = freeze([
  'head',
  'chest',
  'legs',
  'feet',
  'back',
  'mainHand',
  'offHand'
]);

export const EQUIPMENT_SLOT_LABELS = freeze({
  head: 'Head',
  chest: 'Chest',
  legs: 'Legs',
  feet: 'Feet',
  back: 'Back',
  mainHand: 'Main Hand',
  offHand: 'Off Hand'
});

/** Expandable catalog: weapons, armor, clothing, accessories. */
export const EQUIPMENT_DEFINITIONS = freeze({
  'basic-bow': freeze({
    key: 'basic-bow',
    name: 'Basic Bow',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'bow',
    visual: 'bow',
    quality: 'standard',
    durability: 45,
    defense: 0,
    damage: 12,
    range: 5,
    speedModifier: 1,
    carryingCapacity: 0,
    skillRequirements: freeze({ hunting: 0 }),
    description: 'A simple hunting bow for basic ranged attacks.'
  }),
  'reinforced-bow': freeze({
    key: 'reinforced-bow',
    name: 'Reinforced Bow',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'bow',
    visual: 'bow',
    quality: 'fine',
    durability: 75,
    defense: 0,
    damage: 18,
    range: 6.2,
    speedModifier: 1,
    carryingCapacity: 0,
    skillRequirements: freeze({ hunting: 30 }),
    description: 'A steadier bow with improved range and damage.'
  }),
  'composite-bow': freeze({
    key: 'composite-bow',
    name: 'Composite Bow',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'bow',
    visual: 'bow',
    quality: 'exceptional',
    durability: 105,
    defense: 0,
    damage: 26,
    range: 7.5,
    speedModifier: 1,
    carryingCapacity: 0,
    skillRequirements: freeze({ hunting: 70 }),
    description: 'An expert hunting bow built for accuracy and power.'
  }),
  'hunting-trap': freeze({
    key: 'hunting-trap',
    name: 'Hunting Trap',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'trap',
    visual: 'trap',
    quality: 'standard',
    durability: 60,
    defense: 0,
    damage: 10,
    range: 3.2,
    speedModifier: 0.9,
    carryingCapacity: 0,
    skillRequirements: freeze({ hunting: 55 }),
    description: 'A reusable short-range trail trap.'
  }),
  'leather-tunic': freeze({
    key: 'leather-tunic',
    name: 'Leather Tunic',
    slot: 'chest',
    category: 'armor',
    weaponClass: null,
    visual: 'leather-chest',
    quality: 'standard',
    durability: 50,
    defense: 2,
    damage: 0,
    range: 0,
    speedModifier: 1,
    carryingCapacity: 0,
    skillRequirements: freeze({ tailoring: 5 }),
    description: 'Light leather chest armor. +2 defense when equipped.'
  }),
  'leather-boots': freeze({
    key: 'leather-boots',
    name: 'Leather Boots',
    slot: 'feet',
    category: 'armor',
    weaponClass: null,
    visual: 'leather-boots',
    quality: 'standard',
    durability: 40,
    defense: 1,
    damage: 0,
    range: 0,
    speedModifier: 1.02,
    carryingCapacity: 0,
    skillRequirements: freeze({ tailoring: 0 }),
    description: 'Sturdy trail boots. +1 defense when equipped.'
  }),
  'traveler-backpack': freeze({
    key: 'traveler-backpack',
    name: 'Traveler Backpack',
    slot: 'back',
    category: 'accessory',
    weaponClass: null,
    visual: 'backpack',
    quality: 'standard',
    durability: 70,
    defense: 0,
    damage: 0,
    range: 0,
    speedModifier: 1,
    carryingCapacity: 20,
    skillRequirements: freeze({ tailoring: 10 }),
    description: 'A framed pack that expands carrying capacity when worn.'
  }),
  'iron-chestplate': freeze({
    key: 'iron-chestplate',
    name: 'Iron Chestplate',
    slot: 'chest',
    category: 'armor',
    weaponClass: null,
    visual: 'iron-chest',
    quality: 'fine',
    durability: 110,
    defense: 6,
    damage: 0,
    range: 0,
    speedModifier: 0.96,
    carryingCapacity: 0,
    skillRequirements: freeze({ blacksmithing: 25 }),
    description: 'Forged iron plate for the torso. +6 defense when equipped.'
  }),
  'wooden-shield': freeze({
    key: 'wooden-shield',
    name: 'Wooden Shield',
    slot: 'offHand',
    category: 'armor',
    weaponClass: 'shield',
    visual: 'shield',
    quality: 'standard',
    durability: 55,
    defense: 3,
    damage: 0,
    range: 0,
    speedModifier: 0.98,
    carryingCapacity: 0,
    skillRequirements: freeze({ carpentry: 15 }),
    description: 'A wooden off-hand shield. +3 defense when equipped.'
  }),
  // Prepared weapon classes for future melee systems.
  'forged-knife': freeze({
    key: 'forged-knife',
    name: 'Forged Knife',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'dagger',
    visual: 'blade',
    quality: 'standard',
    durability: 60,
    defense: 0,
    damage: 8,
    range: 1.6,
    speedModifier: 1.05,
    carryingCapacity: 0,
    skillRequirements: freeze({ blacksmithing: 10 }),
    description: 'A short blade. Melee combat not yet live — visual equip only.'
  }),
  'hand-axe': freeze({
    key: 'hand-axe',
    name: 'Hand Axe',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'axe',
    visual: 'axe',
    quality: 'standard',
    durability: 80,
    defense: 0,
    damage: 14,
    range: 1.8,
    speedModifier: 0.95,
    carryingCapacity: 0,
    skillRequirements: freeze({ blacksmithing: 30 }),
    description: 'A compact axe. Melee combat not yet live — visual equip only.'
  }),
  'stone-hammer': freeze({
    key: 'stone-hammer',
    name: 'Stone Hammer',
    slot: 'mainHand',
    category: 'weapon',
    weaponClass: 'hammer',
    visual: 'hammer',
    quality: 'standard',
    durability: 55,
    defense: 0,
    damage: 10,
    range: 1.7,
    speedModifier: 0.92,
    carryingCapacity: 0,
    skillRequirements: freeze({ masonry: 0 }),
    description: 'A heavy camp hammer. Melee combat not yet live — visual equip only.'
  })
});

const HEURISTIC_SLOTS = freeze([
  [/bow|sword|knife|dagger|axe|spear|staff|club|hammer|pickaxe|mace|wand|crossbow/, ['mainHand']],
  [/shield|buckler|torch|lantern/, ['offHand']],
  [/helmet|helm|hood|hat|cap/, ['head']],
  [/tunic|shirt|robe|armor|armour|vest|coat|chestplate/, ['chest']],
  [/pants|trousers|leggings|greaves|skirt/, ['legs']],
  [/boots|shoes|sandals/, ['feet']],
  [/cloak|cape|backpack|satchel|quiver/, ['back']]
]);

export function equipmentDefinition(key) {
  return EQUIPMENT_DEFINITIONS[String(key || '')] || null;
}

export function slotsForItemKey(key) {
  const def = equipmentDefinition(key);
  if (def?.slot) return [def.slot];
  const name = String(key || '').toLowerCase();
  for (const [pattern, slots] of HEURISTIC_SLOTS) {
    if (pattern.test(name)) return slots;
  }
  return [];
}

export function isEquippable(key) {
  return slotsForItemKey(key).length > 0;
}

export function huntingRangeFor(equipmentKey = 'basic-bow') {
  const def = equipmentDefinition(equipmentKey);
  if (def?.range) return Number(def.range);
  if (equipmentKey === 'composite-bow') return 7.5;
  if (equipmentKey === 'reinforced-bow') return 6.2;
  if (equipmentKey === 'hunting-trap') return 3.2;
  return 5;
}

export function huntingDamageFor(equipmentKey = 'basic-bow') {
  const def = equipmentDefinition(equipmentKey);
  return Number(def?.damage || (equipmentKey === 'composite-bow' ? 26 : equipmentKey === 'reinforced-bow' ? 18 : 12));
}

export function huntingChanceBonus(equipmentKey = 'basic-bow') {
  if (equipmentKey === 'composite-bow') return 0.26;
  if (equipmentKey === 'reinforced-bow') return 0.18;
  if (equipmentKey === 'hunting-trap') return 0.12;
  return 0;
}

export function isBowWeapon(key) {
  const def = equipmentDefinition(key);
  return def?.weaponClass === 'bow' || String(key || '').endsWith('-bow');
}

/**
 * Aggregate bonuses from equipped item keys (not ownership).
 * Defense is displayed now; player HP combat may consume it later.
 * Carrying capacity feeds the existing transport backpack baseline.
 */
export function equipmentBonuses(equippedKeys = []) {
  let defense = 0;
  let damage = 0;
  let range = 0;
  let carryingCapacity = 0;
  let speedModifier = 1;
  const weapons = [];
  const armor = [];
  for (const key of equippedKeys) {
    const def = equipmentDefinition(key);
    if (!def) continue;
    defense += Number(def.defense || 0);
    carryingCapacity += Number(def.carryingCapacity || 0);
    speedModifier *= Number(def.speedModifier || 1);
    if (def.category === 'weapon') {
      weapons.push(def);
      damage = Math.max(damage, Number(def.damage || 0));
      range = Math.max(range, Number(def.range || 0));
    } else if (def.category === 'armor' || def.category === 'accessory') {
      armor.push(def);
    }
  }
  return freeze({
    defense: Number(defense.toFixed(1)),
    damage,
    range,
    carryingCapacity,
    speedModifier: Number(speedModifier.toFixed(3)),
    weapons,
    armor,
    // Explicit: defense is shown but player HP combat is not yet live.
    defenseAffectsCombat: false,
    carryingAffectsTransport: true
  });
}

export function compareEquipment(currentKey, candidateKey) {
  const current = equipmentDefinition(currentKey) || {
    defense: 0, damage: 0, range: 0, carryingCapacity: 0, speedModifier: 1, name: 'Empty'
  };
  const next = equipmentDefinition(candidateKey);
  if (!next) return null;
  return freeze({
    currentName: current.name || 'Empty',
    candidateName: next.name,
    delta: freeze({
      defense: Number(next.defense || 0) - Number(current.defense || 0),
      damage: Number(next.damage || 0) - Number(current.damage || 0),
      range: Number(next.range || 0) - Number(current.range || 0),
      carryingCapacity: Number(next.carryingCapacity || 0) - Number(current.carryingCapacity || 0),
      speedModifier: Number(((next.speedModifier || 1) - (current.speedModifier || 1)).toFixed(3))
    })
  });
}

export function enrichItemView(row) {
  const key = row.item_key || row.key;
  const def = equipmentDefinition(key);
  const eligibleSlots = slotsForItemKey(key);
  return {
    id: String(row.id),
    key,
    name: row.display_name || row.name || def?.name || key,
    quality: row.quality || def?.quality || 'standard',
    durability: Number(row.durability ?? def?.durability ?? 0),
    maxDurability: Number(row.max_durability ?? row.maxDurability ?? def?.durability ?? 0),
    quantity: Math.max(1, Number(row.quantity || 1)),
    placed: Boolean(row.placed_at ?? row.placed),
    eligibleSlots,
    category: def?.category || (eligibleSlots.length ? 'gear' : 'item'),
    weaponClass: def?.weaponClass || null,
    visual: def?.visual || null,
    defense: Number(def?.defense || 0),
    damage: Number(def?.damage || 0),
    range: Number(def?.range || 0),
    speedModifier: Number(def?.speedModifier || 1),
    carryingCapacity: Number(def?.carryingCapacity || 0),
    skillRequirements: def?.skillRequirements || {},
    description: def?.description || row.description || ''
  };
}
