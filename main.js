import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const worldEl = document.getElementById('world');
const welcomeEl = document.getElementById('welcome');
const playerNameEl = document.getElementById('playerName');
const enterWorldBtn = document.getElementById('enterWorld');
const promptEl = document.getElementById('prompt');
const toastEl = document.getElementById('toast');
const clockEl = document.getElementById('clock');
const onlineEl = document.getElementById('online');
const actionButton = document.getElementById('actionButton');
const chronicleEntries = document.getElementById('chronicleEntries');
const toggleChronicle = document.getElementById('toggleChronicle');
const resourceEls = {
  wood: document.getElementById('woodCount'),
  stone: document.getElementById('stoneCount'),
  herbs: document.getElementById('herbCount')
};

const STORAGE_KEY = 'gptworld-day1';
const state = loadState();
let playerName = state.playerName || 'Traveler';
playerNameEl.value = playerName;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb1b1);
scene.fog = new THREE.Fog(0x8fb1b1, 38, 95);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(16, 18, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
worldEl.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x38442d, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0cf, 2.5);
sun.position.set(15, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(70, 1, 70),
  new THREE.MeshStandardMaterial({ color: 0x667d4e, roughness: 1 })
);
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

const roads = new THREE.Group();
scene.add(roads);
addBox(roads, 0x8e806d, [5, 0.03, 55], [0, 0.03, 2]);
addBox(roads, 0x8e806d, [36, 0.03, 5], [7, 0.04, -5]);

const river = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.18, 70),
  new THREE.MeshStandardMaterial({ color: 0x4d8090, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.9 })
);
river.position.set(-24, 0.08, 0);
scene.add(river);

const interactables = [];
const blockers = [];
const npcs = [];

function addBox(parent, color, size, pos, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.9 })
  );
  mesh.position.set(...pos);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function addBuilding(x, z, width, depth, wallColor, roofColor, label) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const body = addBox(group, wallColor, [width, 3.2, depth], [0, 1.6, 0]);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.78, 2.1, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.95 })
  );
  roof.position.y = 4.15;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  const door = addBox(group, 0x4b3422, [0.9, 1.8, 0.15], [0, 0.9, depth / 2 + 0.08]);
  door.castShadow = false;
  scene.add(group);
  blockers.push({ x, z, r: Math.max(width, depth) * 0.55 });
  interactables.push({ type: 'place', label, object: group, radius: 3.4, message: `You stand before ${label}. The settlement is still too young for every door to open.` });
}

function addTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = addBox(group, 0x6f4d2f, [0.55 * scale, 2.3 * scale, 0.55 * scale], [0, 1.15 * scale, 0]);
  trunk.castShadow = true;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.45 * scale, 3.2 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x365b35, roughness: 1 })
  );
  crown.position.y = 3.2 * scale;
  crown.castShadow = true;
  group.add(crown);
  scene.add(group);
  interactables.push({ type: 'resource', resource: 'wood', label: 'pine tree', object: group, radius: 2.25, amount: 1 });
}

function addRock(x, z, scale = 1) {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.9 * scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x77796f, roughness: 1 })
  );
  mesh.position.set(x, 0.6 * scale, z);
  mesh.scale.y = 0.7;
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  mesh.castShadow = true;
  scene.add(mesh);
  interactables.push({ type: 'resource', resource: 'stone', label: 'stone outcrop', object: mesh, radius: 2, amount: 1 });
}

function addHerbs(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  for (let i = 0; i < 6; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.75, 5),
      new THREE.MeshStandardMaterial({ color: 0x7aa35a, roughness: 1 })
    );
    blade.position.set((Math.random() - 0.5) * 0.9, 0.36, (Math.random() - 0.5) * 0.9);
    group.add(blade);
  }
  scene.add(group);
  interactables.push({ type: 'resource', resource: 'herbs', label: 'wild herbs', object: group, radius: 1.8, amount: 1 });
}

function addNPC(name, x, z, tunicColor, lines) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: tunicColor, roughness: 0.95 })
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9aa7a, roughness: 1 })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  scene.add(group);
  const npc = { type: 'npc', label: name, object: group, radius: 2.6, lines, lineIndex: 0, anchor: new THREE.Vector3(x, 0, z), phase: Math.random() * Math.PI * 2 };
  interactables.push(npc);
  npcs.push(npc);
}

addBuilding(4, -8, 6, 5, 0x9b815c, 0x5b3b2d, 'the Wayfarer Inn');
addBuilding(11, -1, 5, 5, 0x8c7254, 0x4a3328, 'the smithy');
addBuilding(4, 7, 5, 6, 0x9a8865, 0x5a4431, 'the storehouse');
addBuilding(-5, -8, 4.5, 4.5, 0x967b58, 0x60402e, 'the healer’s cottage');
addBuilding(-6, 5, 5, 4, 0x8b7658, 0x4c3529, 'the council hall');

const treePositions = [
  [18,-13],[20,-7],[19,4],[23,10],[16,15],[10,18],[3,19],[-5,18],[-12,15],[-16,8],[-17,-1],[-15,-12],[-9,-17],[1,-18],[12,-17],
  [27,-17],[28,-7],[28,3],[27,15],[-29,-18],[-31,-8],[-30,7],[-29,18]
];
treePositions.forEach(([x,z], i) => addTree(x, z, 0.85 + (i % 3) * 0.12));
[[15,9],[-12,10],[20,-2],[-15,-6],[9,14]].forEach(([x,z],i) => addRock(x,z,0.7 + i*0.04));
[[7,14],[-10,13],[17,-10],[-13,-3],[13,11]].forEach(([x,z]) => addHerbs(x,z));

addNPC('Mara the Keeper', 2, -4, 0x7b4f42, [
  '“You arrived on the first morning. Remember that.”',
  '“We have walls, grain, and very little certainty.”',
  '“If you find something beyond the river, tell someone. History begins as gossip.”'
]);
addNPC('Tovan the Smith', 9, 2, 0x455c6b, [
  '“Stone first. Iron later, if the hills are kind.”',
  '“Tools change people faster than speeches do.”'
]);
addNPC('Edda the Healer', -4, -4, 0x697348, [
  '“The valley grows three useful herbs and six useless ones. Learn the difference.”',
  '“No settlement survives long if everyone only knows how to fight.”'
]);

const player = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.48, 0.55, 1.45, 8),
  new THREE.MeshStandardMaterial({ color: 0xc2aa72, roughness: 0.95 })
);
playerBody.position.y = 0.95;
playerBody.castShadow = true;
player.add(playerBody);
const playerHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.36, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0xe0b586, roughness: 1 })
);
playerHead.position.y = 1.92;
playerHead.castShadow = true;
player.add(playerHead);
player.position.set(state.x ?? 0, 0, state.z ?? 12);
scene.add(player);

const shadowBlob = new THREE.Mesh(
  new THREE.CircleGeometry(0.7, 18),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
);
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.position.y = 0.02;
player.add(shadowBlob);

const keys = new Set();
let nearest = null;
let gameStarted = false;
let elapsedWorldMinutes = state.worldMinutes ?? 6 * 60;
let lastSave = 0;
let toastTimer = null;
const velocity = new THREE.Vector3();
const desired = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

const chronicle = state.chronicle?.length ? state.chronicle : [
  { stamp: 'Founding Day · Dawn', text: 'The first settlement woke beneath a pale sky. Five buildings stood along the dirt road.' },
  { stamp: 'Founding Day · Dawn', text: 'Mara opened the Wayfarer Inn. Tovan lit the smithy forge. Edda began mapping the valley’s medicinal plants.' }
];
state.inventory ??= { wood: 0, stone: 0, herbs: 0 };
renderInventory();
renderChronicle();

function renderInventory() {
  for (const key of Object.keys(resourceEls)) resourceEls[key].textContent = String(state.inventory[key] || 0);
}

function renderChronicle() {
  chronicleEntries.innerHTML = '';
  chronicle.slice().reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'entry';
    const time = document.createElement('time');
    time.textContent = item.stamp;
    const p = document.createElement('p');
    p.textContent = item.text;
    div.append(time, p);
    chronicleEntries.appendChild(div);
  });
}

function addChronicle(text) {
  chronicle.push({ stamp: `Founding Day · ${formatTime(elapsedWorldMinutes)}`, text });
  state.chronicle = chronicle.slice(-40);
  renderChronicle();
  saveState();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function formatTime(totalMinutes) {
  const mins = Math.floor(totalMinutes) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function saveState() {
  state.playerName = playerName;
  state.x = Number(player.position.x.toFixed(2));
  state.z = Number(player.position.z.toFixed(2));
  state.worldMinutes = elapsedWorldMinutes;
  state.chronicle = chronicle.slice(-40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function startGame() {
  playerName = (playerNameEl.value || 'Traveler').trim().slice(0, 20) || 'Traveler';
  gameStarted = true;
  welcomeEl.hidden = true;
  onlineEl.textContent = '1 traveler';
  showToast(`Welcome, ${playerName}.`);
  if (!state.firstEntryRecorded) {
    addChronicle(`${playerName} entered the settlement during its first day.`);
    state.firstEntryRecorded = true;
    saveState();
  }
}

enterWorldBtn.addEventListener('click', startGame);
playerNameEl.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });

toggleChronicle.addEventListener('click', () => {
  const hidden = chronicleEntries.hidden;
  chronicleEntries.hidden = !hidden;
  toggleChronicle.textContent = hidden ? 'Hide' : 'Show';
  toggleChronicle.setAttribute('aria-expanded', String(hidden));
});

window.addEventListener('keydown', e => {
  if (!gameStarted || e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
    keys.add(key);
    e.preventDefault();
  }
  if (key === 'e' || key === ' ') {
    interact();
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

document.querySelectorAll('[data-move]').forEach(btn => {
  const map = { up: 'w', left: 'a', down: 's', right: 'd' };
  const key = map[btn.dataset.move];
  btn.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(key); btn.setPointerCapture?.(e.pointerId); });
  const stop = () => keys.delete(key);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
});
actionButton.addEventListener('click', interact);

function interact() {
  if (!gameStarted || !nearest) return;
  if (nearest.type === 'resource') {
    state.inventory[nearest.resource] = (state.inventory[nearest.resource] || 0) + nearest.amount;
    renderInventory();
    showToast(`Gathered ${nearest.amount} ${nearest.resource}.`);
    if (!nearest.gatheredOnce) {
      nearest.gatheredOnce = true;
      if ((state.inventory[nearest.resource] || 0) === 1) {
        addChronicle(`${playerName} gathered the settlement’s first recorded ${nearest.resource}.`);
      }
    }
    nearest.object.scale.setScalar(0.78);
    setTimeout(() => nearest?.object?.scale?.setScalar?.(1), 220);
    saveState();
    return;
  }
  if (nearest.type === 'npc') {
    const line = nearest.lines[nearest.lineIndex % nearest.lines.length];
    nearest.lineIndex++;
    showToast(`${nearest.label}: ${line}`);
    return;
  }
  showToast(nearest.message);
}

function isBlocked(x, z) {
  if (x < -33 || x > 33 || z < -33 || z > 33) return true;
  if (x > -29 && x < -19) return true;
  for (const b of blockers) {
    const dx = x - b.x;
    const dz = z - b.z;
    if (dx * dx + dz * dz < b.r * b.r) return true;
  }
  return false;
}

function updatePlayer(dt) {
  desired.set(0,0,0);
  if (keys.has('w') || keys.has('arrowup')) desired.z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) desired.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) desired.x -= 1;
  if (keys.has('d') || keys.has('arrowright')) desired.x += 1;
  if (desired.lengthSq() > 0) {
    desired.normalize().multiplyScalar(5.2);
    velocity.lerp(desired, Math.min(1, dt * 10));
    player.rotation.y = Math.atan2(velocity.x, velocity.z);
  } else velocity.lerp(new THREE.Vector3(), Math.min(1, dt * 9));

  const nx = player.position.x + velocity.x * dt;
  const nz = player.position.z + velocity.z * dt;
  if (!isBlocked(nx, player.position.z)) player.position.x = nx;
  if (!isBlocked(player.position.x, nz)) player.position.z = nz;

  cameraTarget.copy(player.position).add(new THREE.Vector3(12, 14, 12));
  camera.position.lerp(cameraTarget, Math.min(1, dt * 3.5));
  camera.lookAt(player.position.x, 0.5, player.position.z);
}

function updateNPCs(t) {
  for (const npc of npcs) {
    const r = 0.55;
    npc.object.position.x = npc.anchor.x + Math.cos(t * 0.00022 + npc.phase) * r;
    npc.object.position.z = npc.anchor.z + Math.sin(t * 0.00018 + npc.phase) * r;
  }
}

function updateNearest() {
  let best = null;
  let bestDist = Infinity;
  for (const item of interactables) {
    const p = item.object.position;
    const dx = player.position.x - p.x;
    const dz = player.position.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < item.radius && d < bestDist) { best = item; bestDist = d; }
  }
  nearest = best;
  if (!best || !gameStarted) {
    promptEl.hidden = true;
    return;
  }
  promptEl.hidden = false;
  if (best.type === 'resource') promptEl.textContent = `E · Gather ${best.label}`;
  else if (best.type === 'npc') promptEl.textContent = `E · Speak with ${best.label}`;
  else promptEl.textContent = `E · Inspect ${best.label}`;
}

function updateDaylight(dt) {
  elapsedWorldMinutes = (elapsedWorldMinutes + dt * 1.8) % (24 * 60);
  const h = elapsedWorldMinutes / 60;
  const angle = ((h - 6) / 24) * Math.PI * 2;
  const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 0.5 + 0.55, 0.12, 1);
  sun.intensity = 0.5 + daylight * 2.3;
  hemi.intensity = 0.5 + daylight * 1.8;
  const dayColor = new THREE.Color(0x8fb1b1);
  const nightColor = new THREE.Color(0x182137);
  scene.background.copy(nightColor).lerp(dayColor, daylight);
  scene.fog.color.copy(scene.background);
  clockEl.textContent = formatTime(elapsedWorldMinutes);
}

function resize() {
  const w = worldEl.clientWidth;
  const h = worldEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function animate(t) {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameStarted) updatePlayer(dt);
  updateNPCs(t);
  updateNearest();
  updateDaylight(dt);
  renderer.render(scene, camera);
  if (t - lastSave > 5000) { saveState(); lastSave = t; }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
