const API = '/.netlify/functions/world';
let active = false;
let sessionId = '';
let crossing = { wood: 0, stone: 0, woodGoal: 60, stoneGoal: 30, complete: false };

function readGameState() {
  try { return JSON.parse(localStorage.getItem('gptworld-day1')) || {}; }
  catch { return {}; }
}

function writeGameState(game) {
  localStorage.setItem('gptworld-day1', JSON.stringify(game));
}

function ensureProjectUI() {
  if (document.getElementById('bridgeProject')) return;
  const panel = document.createElement('section');
  panel.id = 'bridgeProject';
  panel.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:30;background:rgba(19,31,23,.95);color:#f5f0df;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:14px 16px;width:min(92vw,420px);box-shadow:0 12px 32px rgba(0,0,0,.35);display:none;font-family:system-ui,sans-serif';
  panel.innerHTML = `
    <div style="font-size:12px;letter-spacing:.12em;opacity:.7">DAY 2 · COMMUNITY PROJECT</div>
    <div style="font-size:20px;font-weight:700;margin-top:2px">The Western Crossing</div>
    <div id="bridgeStatus" style="margin:8px 0 10px;line-height:1.35"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="giveWood" type="button">Give up to 5 wood</button>
      <button id="giveStone" type="button">Give up to 3 stone</button>
      <button id="crossBridge" type="button" style="display:none">Cross the bridge</button>
    </div>
    <div style="font-size:12px;opacity:.7;margin-top:8px">Approach the west riverbank to work on the settlement's first shared construction project.</div>`;
  document.body.appendChild(panel);
  for (const id of ['giveWood','giveStone','crossBridge']) {
    const b = document.getElementById(id);
    b.style.cssText = 'background:#d9c896;color:#17231a;border:0;border-radius:9px;padding:9px 11px;font-weight:700;cursor:pointer';
  }
  document.getElementById('giveWood').addEventListener('click', () => contribute(5, 0));
  document.getElementById('giveStone').addEventListener('click', () => contribute(0, 3));
  document.getElementById('crossBridge').addEventListener('click', crossRiver);
}

function nearCrossing(game) {
  const x = Number(game.x ?? 0);
  const z = Number(game.z ?? 12);
  return x < -14 && x > -33 && Math.abs(z) < 6;
}

function updateProjectUI() {
  ensureProjectUI();
  const game = readGameState();
  const panel = document.getElementById('bridgeProject');
  if (!active || !nearCrossing(game)) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const status = document.getElementById('bridgeStatus');
  const w = Math.min(crossing.woodGoal || 60, crossing.wood || 0);
  const s = Math.min(crossing.stoneGoal || 30, crossing.stone || 0);
  status.textContent = crossing.complete
    ? `The crossing is complete. ${w}/${crossing.woodGoal || 60} wood · ${s}/${crossing.stoneGoal || 30} stone. The western bank is now reachable.`
    : `Shared progress: ${w}/${crossing.woodGoal || 60} wood · ${s}/${crossing.stoneGoal || 30} stone. Your pack: ${game.inventory?.wood || 0} wood · ${game.inventory?.stone || 0} stone.`;
  document.getElementById('giveWood').style.display = crossing.complete ? 'none' : '';
  document.getElementById('giveStone').style.display = crossing.complete ? 'none' : '';
  document.getElementById('crossBridge').style.display = crossing.complete ? '' : 'none';
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
  game.x = x > -24 ? -31 : -17;
  game.z = Math.max(-2, Math.min(2, Number(game.z || 0)));
  writeGameState(game);
  location.reload();
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
    updateProjectUI();
  } catch {}
}

document.getElementById('enterWorld')?.addEventListener('click', () => {
  active = true;
  sessionId = localStorage.getItem('gptworld-client-id') || `traveler-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,10)}`}`;
  localStorage.setItem('gptworld-client-id', sessionId);
  ensureProjectUI();
  setTimeout(syncPresence, 200);
  setTimeout(refreshWorld, 350);
});

setInterval(syncPresence, 5000);
setInterval(refreshWorld, 3000);
setInterval(updateProjectUI, 500);
