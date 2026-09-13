const API = '/.netlify/functions/world';
let active = false;
let sessionId = '';

function readGameState() {
  try { return JSON.parse(localStorage.getItem('gptworld-day1')) || {}; }
  catch { return {}; }
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
    const response = await fetch(API, { cache: 'no-store' });
    const data = await response.json();
    if (!data.ok) return;
    const online = document.getElementById('online');
    if (online) online.textContent = `${data.online.length} traveler${data.online.length === 1 ? '' : 's'}`;
    const day = data.world?.current_day?.day;
    const eraName = data.world?.current_day?.era;
    if (day) document.querySelector('.topbar .eyebrow').textContent = `GPTWORLD · DAY ${day}`;
    if (eraName) document.getElementById('era').textContent = eraName;
  } catch {}
}

document.getElementById('enterWorld')?.addEventListener('click', () => {
  active = true;
  sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  setTimeout(syncPresence, 200);
  setTimeout(refreshWorld, 300);
});

setInterval(syncPresence, 5000);
setInterval(refreshWorld, 5000);
