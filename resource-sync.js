const RESOURCE_API = '/.netlify/functions/resource-state';
const RESOURCE_GAME_KEY = 'gptworld-day1';
const RESOURCE_CLIENT_KEY = 'gptworld-client-id';
const RESOURCE_RESTORE_GUARD = 'gptworld-resource-restored';
let lastSent = '';
let syncing = false;

function readResourceGame() {
  try { return JSON.parse(localStorage.getItem(RESOURCE_GAME_KEY)) || {}; }
  catch { return {}; }
}

function writeResourceGame(game) {
  localStorage.setItem(RESOURCE_GAME_KEY, JSON.stringify(game));
}

function normalizedInventory(game) {
  const inventory = game?.inventory || {};
  return {
    wood: Math.max(0, Math.floor(Number(inventory.wood || 0))),
    stone: Math.max(0, Math.floor(Number(inventory.stone || 0))),
    herbs: Math.max(0, Math.floor(Number(inventory.herbs || 0)))
  };
}

function inventorySignature(inv) {
  return `${inv.wood}:${inv.stone}:${inv.herbs}`;
}

function updateVisibleInventory(inv) {
  const ids = { wood: 'woodCount', stone: 'stoneCount', herbs: 'herbCount' };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(inv[key]);
  }
}

async function restoreResources() {
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId) return;

  try {
    const response = await fetch(`${RESOURCE_API}?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!data.ok || !data.inventory) return;

    const game = readResourceGame();
    const serverInventory = {
      wood: Math.max(0, Number(data.inventory.wood || 0)),
      stone: Math.max(0, Number(data.inventory.stone || 0)),
      herbs: Math.max(0, Number(data.inventory.herbs || 0))
    };
    const localInventory = normalizedInventory(game);
    const differs = inventorySignature(localInventory) !== inventorySignature(serverInventory);
    if (!differs) {
      lastSent = inventorySignature(serverInventory);
      return;
    }

    game.inventory = serverInventory;
    writeResourceGame(game);
    updateVisibleInventory(serverInventory);
    lastSent = inventorySignature(serverInventory);

    if (!sessionStorage.getItem(RESOURCE_RESTORE_GUARD)) {
      sessionStorage.setItem(RESOURCE_RESTORE_GUARD, '1');
      location.reload();
    }
  } catch {}
}

async function saveResources(force = false) {
  if (syncing) return;
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId) return;

  const game = readResourceGame();
  const inventory = normalizedInventory(game);
  const signature = inventorySignature(inventory);
  if (!force && signature === lastSent) return;

  syncing = true;
  try {
    const response = await fetch(RESOURCE_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, inventory }),
      keepalive: force
    });
    const data = await response.json();
    if (data.ok) lastSent = signature;
  } catch {}
  finally { syncing = false; }
}

function beaconResources() {
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId || !navigator.sendBeacon) return;
  const inventory = normalizedInventory(readResourceGame());
  const body = new Blob([JSON.stringify({ clientId, inventory })], { type: 'application/json' });
  navigator.sendBeacon(RESOURCE_API, body);
}

restoreResources();
setInterval(() => saveResources(false), 1000);
window.addEventListener('pagehide', beaconResources);
window.addEventListener('beforeunload', beaconResources);
document.getElementById('enterWorld')?.addEventListener('click', () => {
  sessionStorage.removeItem(RESOURCE_RESTORE_GUARD);
  setTimeout(() => saveResources(true), 300);
});
