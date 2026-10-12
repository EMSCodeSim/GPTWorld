import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../private-world.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../private-world.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../private-world.css',import.meta.url),'utf8');

test('hunting HUD exposes Target, Attack, and Loot controls',()=>{
  assert.match(html,/id="huntHud"/);
  assert.match(html,/id="huntPrimaryButton"/);
  assert.match(html,/id="huntClearButton"/);
  assert.match(ui,/function selectHuntTarget/);
  assert.match(ui,/function resolveHuntPrimary/);
  assert.match(ui,/function startHuntApproach/);
  assert.match(ui,/huntHudMode='attack'/);
  assert.match(ui,/dataset\.mode=mode/);
  assert.match(ui,/mode==='loot'/);
  assert.match(css,/\.hunt-hud\{/);
  assert.match(css,/\.hunt-primary-action/);
});

test('animal targeting keeps a stable HUD instead of rebuilding buttons every frame',()=>{
  assert.match(ui,/function updateHuntHud/);
  assert.match(ui,/huntLastHudKey/);
  assert.doesNotMatch(ui,/function renderHuntChip/);
  assert.doesNotMatch(ui,/huntContextChip/);
  assert.match(ui,/pickAnimalFromTap/);
  assert.match(ui,/markHuntTarget\(target\)/);
  assert.match(ui,/huntMarker\.position\.y=\.06/);
});

test('attack auto-approaches and loot replaces attack on wounded animals',()=>{
  assert.match(ui,/startHuntApproach\('attack'\)/);
  assert.match(ui,/startHuntApproach\('loot'\)/);
  assert.match(ui,/function tickHuntApproach/);
  assert.match(ui,/harvest_animal/);
  assert.match(ui,/action==='hunt'/);
  assert.match(ui,/beginFieldHunt/);
  assert.match(ui,/flashHuntButton/);
});

test('selected wildlife stays selectable while fleeing or defending',()=>{
  assert.match(ui,/behavior='defending'/);
  assert.match(ui,/selectedPace/);
  assert.match(ui,/kind==='predator'/);
  assert.match(ui,/pickRadius/);
});
