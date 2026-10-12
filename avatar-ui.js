// Shared public/private Avatar & Pack sheet — same equipment definitions and
// the same stylized 3D humanoid used in-world.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import {createPixelHumanoid, animatePixelHumanoid} from './lib/pixel-beings.mjs?v=pixar-cartoon-3';
import {applyAvatarEquipment} from './lib/avatar-equipment-3d.mjs?v=pixar-cartoon-3';
import {CHARACTER_LAYER} from './lib/retro-visuals.mjs';

const API = '/.netlify/functions/avatar';
const CLIENT_KEY = 'gptworld-client-id';
const SLOT_NAMES = {
  head: 'Head',
  chest: 'Chest',
  legs: 'Legs',
  feet: 'Feet',
  back: 'Back',
  mainHand: 'Main Hand',
  offHand: 'Off Hand'
};
const SYMBOLS = {head: '🪖', chest: '🦺', legs: '👖', feet: '🥾', back: '🎒', mainHand: '⚔️', offHand: '🛡️'};

const iconFor = key => {
  if (/bow|crossbow/.test(key)) return '🏹';
  if (/knife|dagger|sword/.test(key)) return '🗡️';
  if (/axe|hammer|pickaxe/.test(key)) return '🪓';
  if (/shield/.test(key)) return '🛡️';
  if (/boots|shoes/.test(key)) return '🥾';
  if (/tunic|chestplate|armor|armour/.test(key)) return '🦺';
  if (/backpack|satchel/.test(key)) return '🎒';
  if (/herb|poultice|elixir/.test(key)) return '🌿';
  if (/wood|beam/.test(key)) return '🪵';
  if (/stone|brick/.test(key)) return '🪨';
  if (/meat|ration/.test(key)) return '🍖';
  return '📦';
};

const fmtDelta = (value, suffix = '') => {
  const n = Number(value) || 0;
  if (!n) return '—';
  return `${n > 0 ? '+' : ''}${n}${suffix}`;
};

let data = null;
let busy = false;
let filter = '';
let preview = null;
let previewRaf = 0;

const root = document.createElement('div');
root.id = 'avatarRoot';
root.innerHTML = `
<button id="avatarOpen" type="button" aria-haspopup="dialog" aria-controls="avatarPanel">Avatar & Pack</button>
<section id="avatarPanel" class="avatar-overlay" role="dialog" aria-modal="true" aria-labelledby="avatarHeading" hidden>
 <div class="avatar-sheet">
  <header class="avatar-header">
    <div>
      <span class="avatar-eyebrow">GPTWORLD · YOUR CHARACTER</span>
      <h2 id="avatarHeading">Avatar & Backpack</h2>
      <p id="avatarStatus" role="status" aria-live="polite">Loading your character…</p>
    </div>
    <button id="avatarClose" type="button" aria-label="Close avatar">✕</button>
  </header>
  <div class="avatar-content">
   <section class="avatar-character" aria-label="Character equipment">
    <div class="avatar-preview-wrap">
      <canvas id="avatarPreview" width="280" height="360" aria-label="Live 3D character preview"></canvas>
    </div>
    <div class="avatar-side">
      <div id="avatarStats" class="avatar-stats" aria-live="polite"></div>
      <div id="avatarSlots" class="avatar-slots"></div>
      <div id="avatarCompare" class="avatar-compare" hidden></div>
    </div>
   </section>
   <section class="avatar-backpack" aria-label="Backpack contents">
    <div class="avatar-backpack-header"><h3>Backpack</h3><input id="avatarSearch" placeholder="Find an item…" type="search" aria-label="Search backpack"/></div>
    <div id="avatarResources" class="avatar-resources"></div>
    <div id="avatarItems" class="avatar-items"></div>
   </section>
  </div>
 </div>
</section>`;
document.body.append(root);

const el = id => root.querySelector('#' + id);
const panel = el('avatarPanel');
const status = el('avatarStatus');
const slots = el('avatarSlots');
const items = el('avatarItems');
const statsEl = el('avatarStats');
const compareEl = el('avatarCompare');
const canvas = el('avatarPreview');

function ensurePreview() {
  if (preview) return preview;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(canvas.clientWidth || 280, canvas.clientHeight || 360, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(32, (canvas.clientWidth || 280) / (canvas.clientHeight || 360), 0.1, 20);
  camera.position.set(1.55, 1.55, 3.1);
  camera.lookAt(0, 1.15, 0);
  camera.layers.enable(CHARACTER_LAYER);
  const hemi = new THREE.HemisphereLight(0xf2e6c9, 0x2a3a30, 1.05);
  const key = new THREE.DirectionalLight(0xfff1d0, 1.15);
  key.position.set(2.2, 4.2, 2.4);
  const fill = new THREE.DirectionalLight(0x9ec2ff, 0.35);
  fill.position.set(-2.5, 1.5, -1.5);
  hemi.layers.enable(CHARACTER_LAYER);
  key.layers.enable(CHARACTER_LAYER);
  fill.layers.enable(CHARACTER_LAYER);
  scene.add(hemi, key, fill);
  const character = createPixelHumanoid(THREE, {
    outfit: 0x526f62,
    skin: 0xdca77d,
    hair: 0x553824,
    accent: 0x3d4850,
    pack: false
  });
  scene.add(character);
  preview = {renderer, scene, camera, character, t: 0};
  return preview;
}

function stopPreviewLoop() {
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

function startPreviewLoop() {
  stopPreviewLoop();
  const run = () => {
    if (panel.hidden || !preview) return;
    preview.t += 16;
    animatePixelHumanoid(preview.character, true, preview.t, 0.85);
    preview.character.rotation.y = Math.sin(preview.t * 0.00045) * 0.35;
    preview.renderer.render(preview.scene, preview.camera);
    previewRaf = requestAnimationFrame(run);
  };
  previewRaf = requestAnimationFrame(run);
}

function syncPreview() {
  const p = ensurePreview();
  if (data?.slots && Array.isArray(data.items)) applyAvatarEquipment(THREE, p.character, data);
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 360;
  p.renderer.setSize(w, h, false);
  p.camera.aspect = w / h;
  p.camera.updateProjectionMatrix();
}

async function request(body) {
  const clientId = localStorage.getItem(CLIENT_KEY);
  if (!clientId) throw Error('Create or restore your traveler before opening your backpack.');
  const response = await fetch(
    body ? API : `${API}?clientId=${encodeURIComponent(clientId)}`,
    body
      ? {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({...body, clientId})}
      : {cache: 'no-store'}
  );
  const next = await response.json();
  if (!response.ok || !next.ok) throw Error(next.error || 'Cannot load equipment');
  return next;
}

function paintStats() {
  const b = data?.bonuses || {defense: 0, damage: 0, range: 0, carryingCapacity: 0};
  const slotsReady = Boolean(data?.slots);
  statsEl.innerHTML = `
    <div class="avatar-stat"><span>Defense</span><strong>${b.defense || 0}</strong></div>
    <div class="avatar-stat"><span>Weapon dmg</span><strong>${b.damage || 0}</strong></div>
    <div class="avatar-stat"><span>Hunt range</span><strong>${b.range || 0}</strong></div>
    <div class="avatar-stat"><span>Carry bonus</span><strong>+${b.carryingCapacity || 0}</strong></div>
    <p class="avatar-stat-note">${slotsReady
      ? 'Defense is shown from equipped armor. Player HP combat is not live yet — hunting uses weapon range and damage. Carry bonus applies when a backpack is equipped.'
      : 'Live stylized preview ready. Sign in as a traveler to load and equip backpack gear.'}</p>
  `;
  if (!slotsReady) {
    slots.replaceChildren();
    for (const [key, label] of Object.entries(SLOT_NAMES)) {
      const row = document.createElement('div');
      row.className = 'avatar-slot';
      const name = document.createElement('span');
      name.textContent = `${SYMBOLS[key]} ${label}`;
      const value = document.createElement('strong');
      value.textContent = 'Empty';
      row.append(name, value);
      slots.append(row);
    }
  }
}

function showCompare(candidate, currentKey) {
  if (!candidate) {
    compareEl.hidden = true;
    compareEl.replaceChildren();
    return;
  }
  const cur = (data.items || []).find(item => item.key === currentKey) || {defense: 0, damage: 0, range: 0, carryingCapacity: 0, name: 'Empty'};
  compareEl.hidden = false;
  compareEl.innerHTML = `
    <strong>Compare · ${candidate.name}</strong>
    <div class="avatar-compare-grid">
      <span>Defense</span><span>${fmtDelta((candidate.defense || 0) - (cur.defense || 0))}</span>
      <span>Damage</span><span>${fmtDelta((candidate.damage || 0) - (cur.damage || 0))}</span>
      <span>Range</span><span>${fmtDelta((candidate.range || 0) - (cur.range || 0))}</span>
      <span>Carry</span><span>${fmtDelta((candidate.carryingCapacity || 0) - (cur.carryingCapacity || 0))}</span>
    </div>
  `;
}

function itemDetail(item) {
  const bits = [];
  if (item.defense) bits.push(`+${item.defense} def`);
  if (item.damage) bits.push(`${item.damage} dmg`);
  if (item.range) bits.push(`${item.range} range`);
  if (item.carryingCapacity) bits.push(`+${item.carryingCapacity} carry`);
  bits.push(`${item.quality} · ${item.durability}/${item.maxDurability} dur`);
  return bits.join(' · ');
}

function paint() {
  if (!data) return;
  const equippedIds = new Set(Object.values(data.slots).filter(Boolean));
  const byId = new Map(data.items.map(item => [item.id, item]));
  slots.replaceChildren();
  for (const [key, label] of Object.entries(SLOT_NAMES)) {
    const item = byId.get(data.slots[key]);
    const row = document.createElement('div');
    row.className = 'avatar-slot';
    const name = document.createElement('span');
    name.textContent = `${SYMBOLS[key]} ${label}`;
    const value = document.createElement('strong');
    value.textContent = item?.name || 'Empty';
    row.append(name, value);
    if (item) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Unequip';
      remove.disabled = busy;
      remove.setAttribute('aria-label', `Unequip ${item.name} from ${label}`);
      remove.addEventListener('click', () => mutate({action: 'unequip', slot: key}));
      row.append(remove);
    }
    slots.append(row);
  }

  paintStats();
  el('avatarResources').textContent =
    `🪵 ${Number(data.resources.wood || 0)} wood  ·  🪨 ${Number(data.resources.stone || 0)} stone  ·  🌿 ${Number(data.resources.herbs || 0)} herbs  ·  🪙 ${Number(data.resources.coins || 0)} coins`;

  items.replaceChildren();
  const remaining = data.items.filter(
    item => !item.placed && item.name.toLowerCase().includes(filter.toLowerCase())
  );
  if (!remaining.length) {
    const empty = document.createElement('p');
    empty.className = 'avatar-empty';
    empty.textContent = 'No matching items. Craft bows, armor, or a traveler backpack to equip.';
    items.append(empty);
  }
  for (const item of remaining) {
    const row = document.createElement('div');
    row.className = 'avatar-item' + (equippedIds.has(item.id) ? ' equipped' : '');
    const icon = document.createElement('span');
    icon.className = 'avatar-item-icon';
    icon.textContent = iconFor(item.key);
    const desc = document.createElement('div');
    desc.className = 'avatar-item-desc';
    const title = document.createElement('strong');
    title.textContent = `${item.name}${item.quantity > 1 ? ' ×' + item.quantity : ''}`;
    const detail = document.createElement('small');
    detail.textContent = `${itemDetail(item)}${equippedIds.has(item.id) ? ' · Equipped' : ''}`;
    if (item.description) {
      const tip = document.createElement('small');
      tip.className = 'avatar-item-blurb';
      tip.textContent = item.description;
      desc.append(title, detail, tip);
    } else desc.append(title, detail);
    row.append(icon, desc);
    if (item.eligibleSlots.length && !equippedIds.has(item.id)) {
      const slot = item.eligibleSlots[0];
      const current = byId.get(data.slots[slot]);
      const equip = document.createElement('button');
      equip.type = 'button';
      equip.textContent = current ? `Replace · ${SLOT_NAMES[slot]}` : `Equip · ${SLOT_NAMES[slot]}`;
      equip.disabled = busy;
      equip.addEventListener('mouseenter', () => showCompare(item, current?.key));
      equip.addEventListener('focus', () => showCompare(item, current?.key));
      equip.addEventListener('click', () => mutate({action: 'equip', slot, itemId: item.id}));
      row.append(equip);
    }
    items.append(row);
  }

  syncPreview();
  const main = byId.get(data.slots.mainHand);
  window.dispatchEvent(
    new CustomEvent('gptworld:avatar-equipment', {
      detail: {mainHand: main?.key || '', slots: data.slots, items: data.items, bonuses: data.bonuses}
    })
  );
}

async function mutate(body) {
  if (busy) return;
  busy = true;
  status.textContent = 'Saving equipment…';
  try {
    data = await request(body);
    status.textContent = 'Equipment saved — character updated.';
    paint();
  } catch (error) {
    status.textContent = `Could not change equipment: ${error.message}`;
  } finally {
    busy = false;
  }
}

async function open() {
  panel.hidden = false;
  status.textContent = 'Loading your character…';
  ensurePreview();
  syncPreview();
  startPreviewLoop();
  try {
    data = await request();
    el('avatarHeading').textContent = `${data.name}'s avatar`;
    status.textContent = 'Equip gear from your backpack. Changes save to your traveler and update the walking character.';
    paint();
  } catch (error) {
    status.textContent = error.message;
    // Keep the live stylized preview visible even before a traveler session loads.
    paintStats();
  }
}

function close() {
  panel.hidden = true;
  stopPreviewLoop();
  showCompare(null);
}

el('avatarOpen').addEventListener('click', open);
el('avatarClose').addEventListener('click', close);
panel.addEventListener('click', e => {
  if (e.target === panel) close();
});
el('avatarSearch').addEventListener('input', e => {
  filter = e.target.value;
  paint();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !panel.hidden) {
    close();
    e.stopImmediatePropagation();
  }
});
window.addEventListener('gptworld:equipment-refresh', () => {
  if (!panel.hidden) open();
});
window.addEventListener('resize', () => {
  if (!panel.hidden && preview) syncPreview();
});
