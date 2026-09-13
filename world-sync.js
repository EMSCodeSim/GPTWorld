const API = '/.netlify/functions/world';
const GAME_KEY = 'gptworld-day1';
const CLIENT_KEY = 'gptworld-client-id';
const RESTORE_GUARD = 'gptworld-restored-this-load';
let active = false;
let sessionId = '';
let crossing = { wood: 0, stone: 0, woodGoal: 60, stoneGoal: 30, complete: false };
let worldEntities = [];
let historyOpen = false;

function readGameState() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY)) || {}; }
  catch { return {}; }
}

function writeGameState(game) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

function sameSavedPlayer(local, remote) {
  if (!remote) return true;
  return String(local.playerName || '') === String(remote.display_name || '')
    && Number(local.x ?? 0) === Number(remote.x ?? 0)
    && Number(local.z ?? 12) === Number(remote.z ?? 12)
    && Number(local.inventory?.wood || 0) === Number(remote.wood || 0)
    && Number(local.inventory?.stone || 0) === Number(remote.stone || 0)
    && Number(local.inventory?.herbs || 0) === Number(remote.herbs || 0);
}

function restoreSavedPlayer(remote) {
  if (!remote) return false;
  const game = readGameState();
  if (sameSavedPlayer(game, remote)) return false;
  game.playerName = remote.display_name || game.playerName || 'Traveler';
  game.x = Number(remote.x ?? game.x ?? 0);
  game.z = Number(remote.z ?? game.z ?? 12);
  game.inventory = {
    wood: Math.max(0, Number(remote.wood || 0)),
    stone: Math.max(0, Number(remote.stone || 0)),
    herbs: Math.max(0, Number(remote.herbs || 0))
  };
  game.returningPlayer = true;
  writeGameState(game);
  return true;
}

function crossingEntity() {
  return worldEntities.find((entity) => entity.entity_id === 'western-crossing')
    || worldEntities.find((entity) => String(entity.name || '').toLowerCase() === 'the western crossing')
    || null;
}

async function loadSavedPlayerBeforePlay() {
  const existingId = localStorage.getItem(CLIENT_KEY);
  if (!existingId) return;
  sessionId = existingId;
  try {
    const response = await fetch(`${API}?clientId=${encodeURIComponent(existingId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!data.ok) return;
    if (data.world?.western_crossing) crossing = data.world.western_crossing;
    if (Array.isArray(data.entities)) worldEntities = data.entities;
    if (!data.me) return;
    const changed = restoreSavedPlayer(data.me);
    const guard = sessionStorage.getItem(RESTORE_GUARD);
    if (changed && !guard) {
      sessionStorage.setItem(RESTORE_GUARD, '1');
      location.reload();
      return new Promise(() => {});
    }
  } catch {}
}

const playerRestoreReady = loadSavedPlayerBeforePlay();

function ensureProjectUI() {
  if (document.getElementById('bridgeProject')) return;
  const panel = document.createElement('section');
  panel.id = 'bridgeProject';
  panel.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:30;background:rgba(19,31,23,.95);color:#f5f0df;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:14px 16px;width:min(92vw,440px);box-shadow:0 12px 32px rgba(0,0,0,.35);display:none;font-family:system-ui,sans-serif';
  panel.innerHTML = `
    <div id="bridgeEyebrow" style="font-size:12px;letter-spacing:.12em;opacity:.7">DAY 2 · COMMUNITY PROJECT</div>
    <div style="font-size:20px;font-weight:700;margin-top:2px">The Western Crossing</div>
    <div id="bridgeStatus" style="margin:8px 0 10px;line-height:1.35"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="giveWood" type="button">Give up to 5 wood</button>
      <button id="giveStone" type="button">Give up to 3 stone</button>
      <button id="crossBridge" type="button" style="display:none">Cross the bridge</button>
      <button id="readHistory" type="button" style="display:none">Inspect history</button>
    </div>
    <div id="bridgeHistory" style="display:none;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.14);line-height:1.45"></div>
    <div id="bridgeHint" style="font-size:12px;opacity:.7;margin-top:8px">Approach the west riverbank to work on the settlement's first shared construction project.</div>`;
  document.body.appendChild(panel);
  for (const id of ['giveWood','giveStone','crossBridge','readHistory']) {
    const b = document.getElementById(id);
    b.style.cssText = 'background:#d9c896;color:#17231a;border:0;border-radius:9px;padding:9px 11px;font-weight:700;cursor:pointer';
  }
  document.getElementById('giveWood').addEventListener('click', () => contribute(5, 0));
  document.getElementById('giveStone').addEventListener('click', () => contribute(0, 3));
  document.getElementById('crossBridge').addEventListener('click', crossRiver);
  document.getElementById('readHistory').addEventListener('click', toggleCrossingHistory);
}

function nearCrossing(game) {
  const x = Number(game.x ?? 0);
  const z = Number(game.z ?? 12);
  return x < -14 && x > -33 && Math.abs(z) < 6;
}

function historyText(entity) {
  if (!entity) {
    return '<strong>World memory unavailable.</strong><br>The crossing is known to have been completed on Day 2 during the Founding Era.';
  }
  const day = entity.created_day ?? 2;
  const era = entity.created_era || 'Founding Era';
  const origin = entity.origin || 'Created through player activity.';
  const history = Array.isArray(entity.history) ? entity.history : [];
  const latest = history.length ? history[history.length - 1] : null;
  const attribution = latest?.player_name ? `<br><strong>Recorded participant:</strong> ${escapeHtml(latest.player_name)}` : '';
  const details = entity.details || {};
  const materials = details.wood || details.stone
    ? `<br><strong>Construction:</strong> ${Number(details.wood || 0)} wood · ${Number(details.stone || 0)} stone`
    : '';
  return `<strong>Built on Day ${escapeHtml(day)} · ${escapeHtml(era)}</strong><br>${escapeHtml(origin)}${materials}${attribution}<br><span style="opacity:.72">This landmark is part of GPTWorld's permanent history and will remain unless an in-world event changes it.</span>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

async function toggleCrossingHistory() {
  historyOpen = !historyOpen;
  const history = document.getElementById('bridgeHistory');
  const button = document.getElementById('readHistory');
  if (!history || !button) return;
  history.style.display = historyOpen ? 'block' : 'none';
  history.innerHTML = historyOpen ? historyText(crossingEntity()) : '';
  button.textContent = historyOpen ? 'Hide history' : 'Inspect history';

  if (historyOpen && sessionId && !sessionStorage.getItem('gptworld-inspected-western-crossing')) {
    sessionStorage.setItem('gptworld-inspected-western-crossing', '1');
    const game = readGameState();
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: sessionId,
          name: game.playerName || 'Traveler',
          x: game.x ?? 0,
          z: game.z ?? 12,
          inventory: game.inventory || { wood: 0, stone: 0, herbs: 0 },
          event: { type: 'landmark_history_inspected', payload: { entity_id: 'western-crossing' } }
        })
      });
    } catch {}
  }
}

function updateProjectUI() {
  ensureProjectUI();
  const game = readGameState();
  const panel = document.getElementById('bridgeProject');
  if (!active || !nearCrossing(game)) {
    panel.style.display = 'none';
    historyOpen = false;
    const history = document.getElementById('bridgeHistory');
    if (history) history.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const status = document.getElementById('bridgeStatus');
  const eyebrow = document.getElementById('bridgeEyebrow');
  const hint = document.getElementById('bridgeHint');
  const w = Math.min(crossing.woodGoal || 60, crossing.wood || 0);
  const s = Math.min(crossing.stoneGoal || 30, crossing.stone || 0);
  status.textContent = crossing.complete
    ? `The crossing is complete. ${w}/${crossing.woodGoal || 60} wood · ${s}/${crossing.stoneGoal || 30} stone. The western bank is now reachable.`
    : `Shared progress: ${w}/${crossing.woodGoal || 60} wood · ${s}/${crossing.stoneGoal || 30} stone. Your pack: ${game.inventory?.wood || 0} wood · ${game.inventory?.stone || 0} stone.`;
  if (eyebrow) eyebrow.textContent = crossing.complete ? 'HISTORIC LANDMARK · FOUNDED DAY 2' : 'DAY 2 · COMMUNITY PROJECT';
  if (hint) hint.textContent = crossing.complete
    ? 'This player-built crossing is now part of the permanent world. Inspect it to learn its history.'
    : "Approach the west riverbank to work on the settlement's first shared construction project.";
  document.getElementById('giveWood').style.display = crossing.complete ? 'none' : '';
  document.getElementById('giveStone').style.display = crossing.complete ? 'none' : '';
  document.getElementById('crossBridge').style.display = crossing.complete ? '' : 'none';
  document.getElementById('readHistory').style.display = crossing.complete ? '' : 'none';
  if (historyOpen) document.getElementById('bridgeHistory').innerHTML = historyText(crossingEntity());
}

async function contribute(wood, stone) {
  const game = readGameState();
  if (!sessionId) return;
  const availableWood = Math.max(0, Number(game.inventory?.wood || 0));
  const availableStone = Math.max(0, Number(game.inventory?.stone || 0));
  const giveWood = Math.min(wood, availableWood);
  const giveStone = Math.min(stone, availableStone);
  if (giveWood + giveStone < 1) {
    showBridgeToast('Gather more materials first.');
    return;
  }
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: sessionId,
        name: game.playerName || 'Traveler',
        x: game.x ?? 0,
        z: game.z ?? 12,
        inventory: game.inventory || { wood: 0, stone: 0, herbs: 0 },
        action: 'contribute_bridge',
        wood: giveWood,
        stone: giveStone
      })
    });
    const data = await response.json();
    if (!data.ok) {
      showBridgeToast(data.error === 'not_enough_materials' ? 'Your shared inventory is still syncing. Try again.' : 'The project could not accept that contribution.');
      return;
    }
    crossing = data.crossing || crossing;
    const usedWood = Number(data.contributed?.wood || 0);
    const usedStone = Number(data.contributed?.stone || 0);
    game.inventory ||= { wood: 0, stone: 0, herbs: 0 };
    game.inventory.wood = Math.max(0, Number(game.inventory.wood || 0) - usedWood);
    game.inventory.stone = Math.max(0, Number(game.inventory.stone || 0) - usedStone);
    writeGameState(game);
    const woodEl = document.getElementById('woodCount');
    const stoneEl = document.getElementById('stoneCount');
    if (woodEl) woodEl.textContent = String(game.inventory.wood);
    if (stoneEl) stoneEl.textContent = String(game.inventory.stone);
    showBridgeToast(crossing.complete ? 'The Western Crossing is complete!' : `Contributed ${usedWood} wood and ${usedStone} stone.`);
    updateProjectUI();
  } catch {
    showBridgeToast('The shared world is temporarily unreachable.');
  }
}

function crossRiver() {
  const game = readGameState();
  if (!crossing.complete) return;
  const x = Number(game.x ?? 0);
  const targetX = x > -24 ? -30.5 : -17.5;
  const targetZ = Math.max(-2, Math.min(2, Number(game.z || 0)));
  game.x = targetX;
  game.z = targetZ;
  writeGameState(game);
  window.dispatchEvent(new CustomEvent('gptworld:cross-river', {
    detail: { x: targetX, z: targetZ }
  }));
  showBridgeToast(x > -24 ? 'You cross to the western bank.' : 'You cross back to the settlement.');
  setTimeout(syncPresence, 50);
  setTimeout(updateProjectUI, 80);
}

function showBridgeToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

async function syncPresence() {
  if (!active) return;
  const game = readGameState();
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: sessionId,
        name: game.playerName || 'Traveler',
        x: game.x ?? 0,
        z: game.z ?? 12,
        inventory: game.inventory || { wood: 0, stone: 0, herbs: 0 }
      })
    });
    const data = await response.json();
    if (data.ok) {
      const online = document.getElementById('online');
      if (online) online.textContent = `${data.online} traveler${data.online === 1 ? '' : 's'}`;
    }
  } catch {}
}

async function refreshWorld() {
  if (!active) return;
  try {
    const response = await fetch(`${API}?clientId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!data.ok) return;
    const online = document.getElementById('online');
    if (online) online.textContent = `${data.online.length} traveler${data.online.length === 1 ? '' : 's'}`;
    const day = data.world?.current_day?.day;
    const eraName = data.world?.current_day?.era;
    if (day) document.querySelector('.topbar .eyebrow').textContent = `GPTWORLD · DAY ${day}`;
    if (eraName) document.getElementById('era').textContent = eraName;
    if (data.world?.western_crossing) crossing = data.world.western_crossing;
    if (Array.isArray(data.entities)) worldEntities = data.entities;
    updateProjectUI();
  } catch {}
}

document.getElementById('enterWorld')?.addEventListener('click', async () => {
  await playerRestoreReady;
  active = true;
  sessionId = localStorage.getItem(CLIENT_KEY) || `traveler-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,10)}`}`;
  localStorage.setItem(CLIENT_KEY, sessionId);
  sessionStorage.removeItem(RESTORE_GUARD);
  ensureProjectUI();
  setTimeout(syncPresence, 200);
  setTimeout(refreshWorld, 350);
});

setInterval(syncPresence, 5000);
setInterval(refreshWorld, 3000);
setInterval(updateProjectUI, 500);
