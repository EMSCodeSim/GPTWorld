const RESOURCE_API = '/.netlify/functions/resource-state';
const RESOURCE_GAME_KEY = 'gptworld-day1';
const RESOURCE_CLIENT_KEY = 'gptworld-client-id';
const RESOURCE_RESTORE_GUARD = 'gptworld-resource-restored';
let serverInventory = null;
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

function applyAuthoritativeInventory(inv) {
  if (!inv) return;
  const next = {
    wood: Math.max(0, Number(inv.wood || 0)),
    stone: Math.max(0, Number(inv.stone || 0)),
    herbs: Math.max(0, Number(inv.herbs || 0))
  };
  serverInventory = next;
  const game = readResourceGame();
  game.inventory = next;
  writeResourceGame(game);
  updateVisibleInventory(next);
}

async function fetchAuthoritativeInventory() {
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId) return null;
  const response = await fetch(`${RESOURCE_API}?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
  const data = await response.json();
  if (!data.ok || !data.inventory) return null;
  return {
    wood: Number(data.inventory.wood || 0),
    stone: Number(data.inventory.stone || 0),
    herbs: Number(data.inventory.herbs || 0)
  };
}

async function restoreResources() {
  try {
    const authoritative = await fetchAuthoritativeInventory();
    if (!authoritative) return;
    const local = normalizedInventory(readResourceGame());
    const differs = inventorySignature(local) !== inventorySignature(authoritative);
    applyAuthoritativeInventory(authoritative);
    if (differs && !sessionStorage.getItem(RESOURCE_RESTORE_GUARD)) {
      sessionStorage.setItem(RESOURCE_RESTORE_GUARD, '1');
      location.reload();
    }
  } catch {}
}

async function submitGather(resource, amount) {
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId) return false;
  try {
    const response = await fetch(RESOURCE_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, action: 'gather', resource, amount })
    });
    const data = await response.json();
    if (!data.ok || !data.inventory) return false;
    applyAuthoritativeInventory(data.inventory);
    return true;
  } catch {
    return false;
  }
}

async function reconcileResources() {
  if (syncing) return;
  const clientId = localStorage.getItem(RESOURCE_CLIENT_KEY);
  if (!clientId) return;
  syncing = true;
  try {
    if (!serverInventory) {
      const authoritative = await fetchAuthoritativeInventory();
      if (!authoritative) return;
      applyAuthoritativeInventory(authoritative);
      return;
    }

    const local = normalizedInventory(readResourceGame());
    const resources = ['wood', 'stone', 'herbs'];

    for (const resource of resources) {
      const delta = local[resource] - serverInventory[resource];
      if (delta > 0) {
        let remaining = delta;
        while (remaining > 0) {
          const amount = Math.min(5, remaining);
          const ok = await submitGather(resource, amount);
          if (!ok) break;
          remaining -= amount;
        }
      }
    }

    const refreshed = await fetchAuthoritativeInventory();
    if (refreshed) applyAuthoritativeInventory(refreshed);
  } catch {}
  finally { syncing = false; }
}

restoreResources();
setInterval(reconcileResources, 500);
document.getElementById('enterWorld')?.addEventListener('click', () => {
  sessionStorage.removeItem(RESOURCE_RESTORE_GUARD);
  setTimeout(reconcileResources, 300);
});
window.addEventListener('focus', restoreResources);
