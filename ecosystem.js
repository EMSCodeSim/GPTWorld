const ECOSYSTEM_API = '/.netlify/functions/world-memory';
let ecosystemState = null;
let naturalHistoryOpen = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function ensureNaturalHistoryUI() {
  if (document.getElementById('naturalHistoryButton')) return;

  const button = document.createElement('button');
  button.id = 'naturalHistoryButton';
  button.type = 'button';
  button.textContent = '🌱 Natural History';
  button.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:42;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:10px 14px;background:rgba(20,34,24,.92);color:#f4efdf;font:700 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:pointer;backdrop-filter:blur(8px)';
  button.addEventListener('click', toggleNaturalHistory);
  document.body.appendChild(button);

  const panel = document.createElement('section');
  panel.id = 'naturalHistoryPanel';
  panel.setAttribute('aria-label', 'Natural history of GPTWorld');
  panel.style.cssText = 'position:fixed;inset:64px 14px 82px auto;z-index:41;width:min(430px,calc(100vw - 28px));overflow:auto;background:rgba(17,28,20,.97);color:#f4efdf;border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 18px 48px rgba(0,0,0,.42);padding:18px;display:none;font-family:system-ui,sans-serif;backdrop-filter:blur(10px)';
  panel.innerHTML = '<div id="naturalHistoryContent">Loading the living record…</div>';
  document.body.appendChild(panel);
}

function speciesCard(s) {
  const traits = s.traits || {};
  return `<article style="padding:12px 0;border-top:1px solid rgba(255,255,255,.1)">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><strong>${esc(s.name)}</strong><span style="font-size:12px;opacity:.66">${esc(s.kind)}</span></div>
    <div style="font-size:13px;opacity:.84;margin-top:3px">Population ${Number(s.population || 0).toLocaleString()} · ${esc(s.habitat || 'unknown habitat')}</div>
    <div style="font-size:12px;opacity:.62;margin-top:5px">Born year ${Number(s.bornYear || 0)}${s.parentId ? ` · branch of ${esc(s.parentId)}` : ''} · drought ${Math.round(Number(traits.drought || 0) * 100)}% · cold ${Math.round(Number(traits.cold || 0) * 100)}%</div>
  </article>`;
}

function fossilCard(f) {
  return `<article style="padding:12px 0;border-top:1px solid rgba(255,255,255,.1)">
    <div style="display:flex;justify-content:space-between;gap:10px"><strong>🦴 ${esc(f.name)}</strong><span style="font-size:12px;opacity:.66">extinct year ${Number(f.extinctYear || 0)}</span></div>
    <div style="font-size:13px;opacity:.8;margin-top:4px">Lived from year ${Number(f.bornYear || 0)} to ${Number(f.extinctYear || 0)} · ${esc(f.lastHabitat || 'unknown habitat')}</div>
    <div style="font-size:12px;opacity:.62;margin-top:5px">Likely cause: ${esc(f.cause || 'unknown ecological pressure')}</div>
  </article>`;
}

function renderNaturalHistory() {
  const content = document.getElementById('naturalHistoryContent');
  if (!content || !ecosystemState) return;
  const e = ecosystemState;
  const species = Array.isArray(e.species) ? e.species : [];
  const extinct = Array.isArray(e.extinct) ? e.extinct : [];
  const events = Array.isArray(e.recentEvents) ? e.recentEvents.slice(-6).reverse() : [];
  const c = e.climate || {};

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div><div style="font-size:11px;letter-spacing:.14em;opacity:.58">LIVING ECOSYSTEM</div><h2 style="margin:4px 0 0;font-size:24px">Natural History</h2></div>
      <button id="closeNaturalHistory" type="button" aria-label="Close natural history" style="border:0;background:transparent;color:#f4efdf;font-size:22px;cursor:pointer">×</button>
    </div>
    <p style="margin:12px 0 14px;line-height:1.42;opacity:.78;font-size:13px">This ecosystem evolves independently. Climate changes food, food changes populations, and surviving traits drift over generations. Players live inside it but do not directly control evolution.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,.06)"><small style="opacity:.58">ECO YEAR</small><div style="font-size:19px;font-weight:800">${Number(e.simulatedYear || 0)}</div></div>
      <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,.06)"><small style="opacity:.58">LIVING</small><div style="font-size:19px;font-weight:800">${species.length}</div></div>
      <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,.06)"><small style="opacity:.58">EXTINCT</small><div style="font-size:19px;font-weight:800">${extinct.length}</div></div>
    </div>
    <div style="font-size:13px;margin-bottom:16px"><strong>Climate:</strong> ${Number(c.temperatureC || 0).toFixed(1)}°C · rainfall ${Math.round(Number(c.rainfall || 0) * 100)}% · fertility ${Math.round(Number(c.fertility || 0) * 100)}%</div>
    <h3 style="margin:16px 0 6px;font-size:16px">Living species</h3>
    ${species.map(speciesCard).join('') || '<p style="opacity:.7">No living species recorded.</p>'}
    <h3 style="margin:20px 0 6px;font-size:16px">Recent natural events</h3>
    ${events.map(ev => `<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.08);font-size:13px"><strong>Year ${Number(ev.year || 0)}</strong> · ${esc(ev.text)}</div>`).join('') || '<p style="opacity:.7">No events recorded yet.</p>'}
    <h3 style="margin:20px 0 6px;font-size:16px">Fossil record</h3>
    ${extinct.length ? extinct.slice().reverse().map(fossilCard).join('') : '<p style="opacity:.68;font-size:13px">No species have gone extinct yet. When one does, its lineage and likely cause will remain here permanently.</p>'}
  `;
  document.getElementById('closeNaturalHistory')?.addEventListener('click', toggleNaturalHistory);
}

function renderLoadError(message = 'The living record is temporarily unavailable.') {
  const content = document.getElementById('naturalHistoryContent');
  if (!content) return;
  content.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="font-size:11px;letter-spacing:.14em;opacity:.58">LIVING ECOSYSTEM</div><h2 style="margin:4px 0 0;font-size:24px">Natural History</h2></div><button id="closeNaturalHistory" type="button" aria-label="Close natural history" style="border:0;background:transparent;color:#f4efdf;font-size:22px;cursor:pointer">×</button></div><p style="margin-top:16px;opacity:.75">${esc(message)}</p>`;
  document.getElementById('closeNaturalHistory')?.addEventListener('click', toggleNaturalHistory);
}

function toggleNaturalHistory() {
  naturalHistoryOpen = !naturalHistoryOpen;
  const panel = document.getElementById('naturalHistoryPanel');
  if (!panel) return;
  panel.style.display = naturalHistoryOpen ? 'block' : 'none';
  if (naturalHistoryOpen) {
    if (ecosystemState) renderNaturalHistory();
    else {
      const content = document.getElementById('naturalHistoryContent');
      if (content) content.textContent = 'Loading the living record…';
    }
    refreshEcosystem();
  }
}

async function refreshEcosystem() {
  try {
    const response = await fetch(ECOSYSTEM_API, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Natural history unavailable');
    ecosystemState = data.world?.ecosystem || data.ecosystem || null;
    if (!ecosystemState) throw new Error('No ecosystem record found');
    const button = document.getElementById('naturalHistoryButton');
    if (button) button.textContent = `🌱 Eco Year ${Number(ecosystemState.simulatedYear || 0)}`;
    if (naturalHistoryOpen) renderNaturalHistory();
  } catch (error) {
    console.error('Natural History load failed', error);
    if (naturalHistoryOpen) renderLoadError('The living record could not be loaded. Please try again shortly.');
  }
}

ensureNaturalHistoryUI();
refreshEcosystem();
setInterval(refreshEcosystem, 30000);