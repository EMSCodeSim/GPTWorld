/**
 * Hall of History UI — observational chronicle of ecological milestones.
 * Matches the existing Info Center visual language.
 */
(function () {
  const STORAGE_KEY = 'gptworld-hall-last-visit';
  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'evolution', label: 'Evolution' },
    { id: 'extinction', label: 'Extinction' },
    { id: 'environment', label: 'Environment' },
    { id: 'lineages', label: 'Lineages' },
    { id: 'ages', label: 'Ages' }
  ];

  let filter = 'all';
  let selectedLineageId = null;
  let lastEcosystem = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function loadVisit() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }

  function saveVisit(ecoYear, eventKeys) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ecoYear: Number(ecoYear || 0),
        eventKeys: Array.isArray(eventKeys) ? eventKeys.slice(-80) : [],
        at: new Date().toISOString()
      }));
    } catch { /* ignore quota */ }
  }

  function hallMajorEvents(hall, activeFilter) {
    const events = Array.isArray(hall?.events) ? hall.events.filter((e) => e.inHall) : [];
    const filtered = activeFilter === 'all' ? events : events.filter((e) => {
      const cat = String(e.category || '');
      if (activeFilter === 'evolution') return cat === 'evolution' || e.kind === 'speciation' || e.achievementType === 'living_fossil';
      if (activeFilter === 'extinction') return cat === 'extinction';
      if (activeFilter === 'environment') return cat === 'environment' || e.kind === 'mass_extinction';
      if (activeFilter === 'lineages') return cat === 'lineages' || /migration|traveler|leaving/i.test(`${e.title} ${e.achievementType || ''}`);
      if (activeFilter === 'ages') return cat === 'ages';
      return true;
    });
    return filtered.slice().sort((a, b) => b.worldDay - a.worldDay || String(b.eventKey).localeCompare(String(a.eventKey)));
  }

  function currentAge(hall) {
    if (!hall?.currentAgeId) return null;
    return (hall.ages || []).find((a) => a.id === hall.currentAgeId && !a.endDay) || null;
  }

  function sinceAway(hall, visit) {
    if (!visit || !Number.isFinite(Number(visit.ecoYear))) return null;
    const events = (hall?.events || []).filter((e) => e.inHall && Number(e.worldDay) > Number(visit.ecoYear));
    if (!events.length) return { count: 0, bullets: [] };
    const bullets = [];
    if (events.some((e) => e.kind === 'age_begin')) bullets.push('A new Age began.');
    if (events.some((e) => e.kind === 'age_end')) bullets.push('An Age ended.');
    const extinctions = events.filter((e) => e.category === 'extinction');
    if (extinctions.length === 1) bullets.push('One significant extinction was recorded.');
    else if (extinctions.length > 1) bullets.push(`${extinctions.length} significant extinction events were recorded.`);
    const migrate = events.find((e) => /migration|Leaving Home|Habitat Expansion|World Traveler/i.test(`${e.title} ${e.achievementType || ''}`));
    if (migrate) {
      bullets.push(migrate.speciesName
        ? `${migrate.speciesName} entered a new biome.`
        : 'A lineage entered a new biome.');
    }
    for (const e of events) {
      if (bullets.length >= 4) break;
      if (!bullets.some((b) => b.includes(e.title))) bullets.push(e.title);
    }
    return { count: events.length, bullets: bullets.slice(0, 4) };
  }

  function lineageIndex(ecosystem) {
    const living = Array.isArray(ecosystem?.species) ? ecosystem.species : [];
    const extinct = Array.isArray(ecosystem?.extinct) ? ecosystem.extinct : [];
    const byId = new Map([...extinct, ...living].map((s) => [String(s.id), s]));
    function rootId(id) {
      let cur = String(id || '');
      const seen = new Set();
      while (cur && byId.has(cur) && !seen.has(cur)) {
        seen.add(cur);
        const parent = byId.get(cur)?.parentId;
        if (!parent || !byId.has(String(parent))) break;
        cur = String(parent);
      }
      return cur;
    }
    const members = [];
    for (const [id, node] of byId) {
      if (rootId(id) === rootId(selectedLineageId)) {
        members.push({
          id,
          name: node.name,
          parentId: node.parentId ? String(node.parentId) : null,
          bornYear: Number(node.bornYear || 0),
          extinctYear: living.some((s) => String(s.id) === id) ? null : Number(node.extinctYear || 0) || null,
          population: living.find((s) => String(s.id) === id)?.population || 0
        });
      }
    }
    return { rootId: rootId(selectedLineageId), byId, members };
  }

  function renderTree(members, rootId) {
    const childrenOf = (parent) => members.filter((m) => (m.parentId || null) === parent).sort((a, b) => a.bornYear - b.bornYear);
    function renderNode(node, depth) {
      const kids = childrenOf(node.id);
      const mark = node.extinctYear != null ? `extinct y${node.extinctYear}` : `pop ${Number(node.population || 0).toLocaleString()}`;
      let html = `<div class="hall-tree-node" style="margin-left:${depth * 14}px"><strong>${esc(node.name)}</strong> <span class="info-muted">· origin ${node.bornYear} · ${esc(mark)}</span></div>`;
      for (const kid of kids) html += renderNode(kid, depth + 1);
      return html;
    }
    const root = members.find((m) => m.id === rootId) || members[0];
    if (!root) return '<div class="info-muted">No lineage record.</div>';
    return renderNode(root, 0);
  }

  function renderHallHtml(ecosystem) {
    const hall = ecosystem?.hallOfHistory || {};
    const year = Number(ecosystem?.simulatedYear || 0);
    const age = currentAge(hall);
    const events = hallMajorEvents(hall, filter);
    const visit = loadVisit();
    const away = sinceAway(hall, visit);
    const achievements = Array.isArray(hall.achievements) ? hall.achievements : [];

    const filterBar = FILTERS.map((f) => (
      `<button type="button" data-hall-filter="${f.id}" class="${f.id === filter ? 'active' : ''}">${esc(f.label)}</button>`
    )).join('');

    const awayCard = away && away.count
      ? `<div class="info-card hall-away"><strong>While You Were Away</strong><div class="info-muted" style="margin-top:5px">${away.count} significant event${away.count === 1 ? '' : 's'} occurred since your last visit.</div>${away.bullets.map((b) => `<div>• ${esc(b)}</div>`).join('')}</div>`
      : '';

    const eventCards = events.length
      ? events.map((e) => `
        <article class="info-card hall-event" data-lineage="${esc(e.lineageId || e.speciesId || '')}">
          <div class="info-muted" style="letter-spacing:.08em;font-size:11px">DAY ${Number(e.worldDay || 0)}</div>
          <strong>${esc(e.icon || '•')} ${esc(e.title || 'Event')}</strong>
          <div style="margin-top:5px">${esc(e.description || '')}</div>
          ${e.speciesName || e.lineageId ? `<button type="button" class="hall-link" data-open-lineage="${esc(e.lineageId || e.speciesId || '')}">Inspect lineage →</button>` : ''}
        </article>`).join('')
      : '<div class="info-muted">No major historical events yet. The Hall grows as GPTWorld ages.</div>';

    let lineageCard = '';
    if (selectedLineageId) {
      const { rootId, members } = lineageIndex(ecosystem);
      const related = (hall.events || []).filter((e) => e.lineageId === rootId || e.speciesId === selectedLineageId);
      const peak = hall.rolling?.lineageStats?.[rootId]?.peakPopulation || 0;
      const habitats = hall.rolling?.lineageStats?.[rootId]?.habitatsSeen || [];
      lineageCard = `<div class="info-card"><div class="eco-row"><strong>Lineage Record</strong><button type="button" id="hallCloseLineage" style="border:0;background:transparent;color:#f3efe5">×</button></div>
        <div class="hall-tree">${renderTree(members, rootId)}</div>
        <div class="info-muted" style="margin-top:8px">Peak population ${Number(peak).toLocaleString()} · Habitats: ${esc(habitats.join(', ') || 'unknown')}</div>
        <div class="info-section">LINKED EVENTS</div>
        ${related.filter((e) => e.inHall).slice(-8).map((e) => `<div><strong>Day ${e.worldDay}</strong> — ${esc(e.title)}</div>`).join('') || '<div class="info-muted">No linked major events.</div>'}
      </div>`;
    }

    return `
      <div class="info-card hall-hero">
        <div class="info-muted" style="letter-spacing:.14em;font-size:10px">HALL OF HISTORY</div>
        <strong style="font-size:18px;display:block;margin-top:4px">Current Age</strong>
        <div style="font-size:22px;font-weight:800;margin-top:2px">${esc(age?.name || 'Unnamed Era')}</div>
        <div class="info-muted" style="margin-top:6px">World Age · Day ${year}</div>
        <div class="info-muted">${achievements.length} world achievement${achievements.length === 1 ? '' : 's'} · ${(hall.events || []).filter((e) => e.inHall).length} major events</div>
      </div>
      ${awayCard}
      <div class="info-section">MAJOR EVENTS</div>
      <div class="hall-filters">${filterBar}</div>
      ${lineageCard}
      ${eventCards}
      <div class="info-muted" style="margin-top:12px">The Hall observes GPTWorld. It does not control evolution.</div>
    `;
  }

  function bindHallHandlers(root, ecosystem) {
    root.querySelectorAll('[data-hall-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.getAttribute('data-hall-filter') || 'all';
        paint(root, ecosystem);
      });
    });
    root.querySelectorAll('[data-open-lineage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedLineageId = btn.getAttribute('data-open-lineage') || null;
        paint(root, ecosystem);
      });
    });
    root.querySelector('#hallCloseLineage')?.addEventListener('click', () => {
      selectedLineageId = null;
      paint(root, ecosystem);
    });
  }

  function paint(root, ecosystem) {
    if (!root) return;
    lastEcosystem = ecosystem;
    root.innerHTML = renderHallHtml(ecosystem);
    bindHallHandlers(root, ecosystem);
    const hall = ecosystem?.hallOfHistory;
    saveVisit(ecosystem?.simulatedYear, (hall?.events || []).filter((e) => e.inHall).map((e) => e.eventKey));
  }

  function ensureStyles() {
    if (document.getElementById('hallOfHistoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'hallOfHistoryStyles';
    style.textContent = `
      .hall-filters{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
      .hall-filters button{border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.05);color:#cfc9bd;padding:6px 10px;font-weight:700}
      .hall-filters button.active{background:#d2b36a;color:#17130b;border-color:#d2b36a}
      .hall-hero{background:linear-gradient(160deg,rgba(48,70,42,.55),rgba(255,255,255,.04) 55%,rgba(210,179,106,.08));border-color:rgba(210,179,106,.22)}
      .hall-away{border-color:rgba(210,179,106,.35)}
      .hall-event{transition:transform .18s ease, border-color .18s ease}
      .hall-event:hover{transform:translateY(-1px);border-color:rgba(210,179,106,.35)}
      .hall-link{margin-top:8px;border:0;background:transparent;color:#e6c68c;font-weight:800;padding:0;cursor:pointer}
      .hall-tree{margin-top:8px;line-height:1.5}
      .hall-tree-node{padding:2px 0}
      @keyframes hallFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .hall-event,.hall-hero,.hall-away{animation:hallFadeIn .35s ease both}
    `;
    document.head.appendChild(style);
  }

  window.GPTWorldHallOfHistory = {
    render(container, ecosystem) {
      ensureStyles();
      paint(container, ecosystem || lastEcosystem || {});
    },
    getFilter() { return filter; },
    setFilter(next) { filter = next || 'all'; }
  };
})();
