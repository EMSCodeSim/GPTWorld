const ECOSYSTEM_API = '/.netlify/functions/world';
let ecosystemState = null;
let naturalHistoryOpen = false;
let baseRenderEntities = [];
let lastVisualSignature = '';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function habitatCenter(habitat, seed = 0) {
  const h = String(habitat || '').toLowerCase();
  if (h.includes('river')) return { x: -17 + seed * 4, z: -12 + seed * 24, rx: 5, rz: 13 };
  if (h.includes('ridge') || h.includes('upland')) return { x: 19, z: -7 + seed * 18, rx: 11, rz: 10 };
  if (h.includes('scrub')) return { x: 8, z: 15, rx: 14, rz: 8 };
  if (h.includes('wet')) return { x: -14, z: 9, rx: 7, rz: 11 };
  return { x: 4, z: 5, rx: 16, rz: 15 };
}

function ecologyVisualEntities(now = Date.now()) {
  const e = ecosystemState;
  if (!e || !Array.isArray(e.species)) return [];
  const out = [];
  const t = now / 1000;

  for (const s of e.species) {
    const population = Math.max(0, Number(s.population || 0));
    const kind = String(s.kind || '');
    const seed = hash01(String(s.id || s.name || kind));
    const area = habitatCenter(s.habitat, seed);

    if (kind === 'plant') {
      const count = clamp(Math.round(Math.sqrt(population) / 9), 3, 18);
      for (let i = 0; i < count; i++) {
        const a = hash01(`${s.id}:plant:a:${i}`) * Math.PI * 2;
        const r = Math.sqrt(hash01(`${s.id}:plant:r:${i}`));
        const x = clamp(area.x + Math.cos(a) * area.rx * r, -32, 32);
        const z = clamp(area.z + Math.sin(a) * area.rz * r, -32, 32);
        const size = 0.22 + hash01(`${s.id}:plant:s:${i}`) * 0.34;
        out.push({
          id: `eco-plant-${s.id}-${i}`.slice(0, 80), type: 'object',
          x: Number(x.toFixed(2)), z: Number(z.toFixed(2)),
          width: Number(size.toFixed(2)), height: Number((0.35 + size * 1.6).toFixed(2)), depth: Number(size.toFixed(2)),
          color: s.id === 'rivergrass' ? '#6f9252' : '#557a45'
        });
      }
      continue;
    }

    const divisor = kind === 'predator' ? 15 : 70;
    const maxVisible = kind === 'predator' ? 5 : 9;
    const count = clamp(Math.round(population / divisor), 1, maxVisible);
    for (let i = 0; i < count; i++) {
      const phase = hash01(`${s.id}:animal:p:${i}`) * Math.PI * 2;
      const speed = kind === 'predator' ? 0.09 : 0.055 + hash01(`${s.id}:speed:${i}`) * 0.025;
      const wanderX = area.rx * (0.35 + hash01(`${s.id}:wx:${i}`) * 0.5);
      const wanderZ = area.rz * (0.35 + hash01(`${s.id}:wz:${i}`) * 0.5);
      const x = clamp(area.x + Math.sin(t * speed + phase) * wanderX, -32, 32);
      const z = clamp(area.z + Math.cos(t * speed * 0.83 + phase * 1.7) * wanderZ, -32, 32);
      const traits = s.traits || {};
      const body = clamp(0.38 + Number(traits.size || 0.4) * 0.7, 0.38, 1.05);
      out.push({
        id: `eco-animal-${s.id}-${i}`.slice(0, 80), type: 'object',
        x: Number(x.toFixed(2)), z: Number(z.toFixed(2)),
        width: Number((body * 1.25).toFixed(2)), height: Number((body * 0.8).toFixed(2)), depth: Number((body * 0.65).toFixed(2)),
        color: kind === 'predator' ? '#6f5542' : (s.id === 'reed-runner' ? '#a18b61' : '#92784f')
      });
    }
  }
  return out;
}

function publishEcologyVisuals() {
  if (!ecosystemState) return;
  const ecology = ecologyVisualEntities();
  const merged = [...baseRenderEntities.filter(e => !String(e?.id || '').startsWith('eco-')), ...ecology];
  const signature = JSON.stringify(merged);
  if (signature === lastVisualSignature) return;
  lastVisualSignature = signature;
  window.dispatchEvent(new CustomEvent('gptworld:render-entities', { detail: merged }));
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
    <p style="margin:12px 0 14px;line-height:1.42;opacity:.78;font-size:13px">The plants and animals you see in the world are generated from this persistent ecology. Their visible density follows population, and animals roam continuously on the ecology clock rather than the numbered world day.</p>
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
    ecosystemState = data.ecosystem || data.world?.ecosystem || null;
    baseRenderEntities = Array.isArray(data.world?.render_entities) ? data.world.render_entities : [];
    if (!ecosystemState) throw new Error('No ecosystem record found');
    const button = document.getElementById('naturalHistoryButton');
    if (button) button.textContent = `🌱 Eco Year ${Number(ecosystemState.simulatedYear || 0)}`;
    publishEcologyVisuals();
    if (naturalHistoryOpen) renderNaturalHistory();
  } catch (error) {
    console.error('Natural History load failed', error);
    if (naturalHistoryOpen) renderLoadError('The living record could not be loaded. Please try again shortly.');
  }
}

ensureNaturalHistoryUI();
refreshEcosystem();
setInterval(refreshEcosystem, 30000);
setInterval(publishEcologyVisuals, 1500);
