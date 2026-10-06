/**
 * Hall of History — observational historical system for GPTWorld ecology.
 *
 * CRITICAL: This module only observes ecosystem state and writes hallOfHistory.
 * It must never alter species populations, traits, climate, habitats, fitness,
 * speciation, extinction outcomes, or any other simulation-driving fields.
 */

export const HALL_VERSION = 1;
export const HALL_IMPORTANCE_THRESHOLD = 55;

export const ACHIEVEMENT_TYPES = Object.freeze({
  FIRST_SURVIVOR: 'first_survivor',
  LEAVING_HOME: 'leaving_home',
  THE_HUNTER: 'the_hunter',
  WORLD_TRAVELER: 'world_traveler',
  GREAT_DYING: 'great_dying',
  ANCIENT_ONE: 'ancient_one',
  LIVING_FOSSIL: 'living_fossil',
  AGAINST_ALL_ODDS: 'against_all_odds'
});

/** Concepts deferred: strange_partnership (no mutualism data), arms_race (no reliable counter-adaptation signal). */

export const THRESHOLDS = Object.freeze({
  SURVIVOR_YEARS: 20,
  ANCIENT_YEARS: 60,
  LIVING_FOSSIL_YEARS: 45,
  LIVING_FOSSIL_MAX_DRIFT: 0.085,
  WORLD_TRAVELER_HABITATS: 3,
  AGE_ENTER_SHARE: 0.42,
  AGE_EXIT_SHARE: 0.28,
  AGE_MIN_DURATION: 8,
  AGE_ENTER_STREAK: 3,
  AGE_EXIT_STREAK: 3,
  AGE_COOLDOWN_AFTER_END: 3,
  MASS_WINDOW_YEARS: 12,
  MASS_FRACTION: 0.35,
  MASS_MIN_LIVING_BEFORE: 4,
  DYNASTY_MIN_YEARS: 25,
  DYNASTY_MIN_PEAK: 120,
  DYNASTY_MIN_DESCENDANTS: 2,
  BASELINE_TURNOVER_WINDOW: 40
});

const CATEGORY = Object.freeze({
  EVOLUTION: 'evolution',
  EXTINCTION: 'extinction',
  ENVIRONMENT: 'environment',
  LINEAGE: 'lineages',
  AGE: 'ages',
  ACHIEVEMENT: 'evolution'
});

function cloneJson(value) {
  return structuredClone(value);
}

function normalizeHabitat(value) {
  const h = String(value || '').trim().toLowerCase();
  if (!h) return null;
  if (h.includes('river') || h.includes('wet lowland')) return 'riverbank';
  if (h.includes('scrub') || h.includes('dry upland')) return 'scrub';
  if (h.includes('ridge')) return 'ridge';
  if (h.includes('grass')) return 'grassland';
  return h.replace(/\s+/g, ' ');
}

function traitVector(traits = {}) {
  return {
    size: Number(traits.size || 0),
    speed: Number(traits.speed || 0),
    drought: Number(traits.drought || 0),
    cold: Number(traits.cold || 0)
  };
}

function traitDrift(a, b) {
  const A = traitVector(a), B = traitVector(b);
  return (Math.abs(A.size - B.size) + Math.abs(A.speed - B.speed) + Math.abs(A.drought - B.drought) + Math.abs(A.cold - B.cold)) / 4;
}

function ageLabelFromName(name) {
  const parts = String(name || 'Unknown').trim().split(/\s+/).filter(Boolean);
  const token = parts[parts.length - 1] || 'Unknown';
  if (/s$/i.test(token) || /grass$/i.test(token) || /brush$/i.test(token)) return token;
  if (/y$/i.test(token)) return `${token.slice(0, -1)}ies`;
  return `${token}s`;
}

function emptyHall() {
  return {
    version: HALL_VERSION,
    events: [],
    achievements: [],
    ages: [],
    currentAgeId: null,
    eventKeys: [],
    rolling: {
      lastProcessedYear: -1,
      speciesStats: {},
      lineageStats: {},
      extinctionByYear: {},
      livingCountByYear: {},
      ageCandidate: null,
      ageExitStreak: 0,
      climateHistory: [],
      bootstrapped: false
    }
  };
}

export function createEmptyHall() {
  return emptyHall();
}

function ensureHall(raw) {
  const hall = raw && typeof raw === 'object' ? cloneJson(raw) : emptyHall();
  hall.version = HALL_VERSION;
  hall.events = Array.isArray(hall.events) ? hall.events : [];
  hall.achievements = Array.isArray(hall.achievements) ? hall.achievements : [];
  hall.ages = Array.isArray(hall.ages) ? hall.ages : [];
  hall.eventKeys = Array.isArray(hall.eventKeys) ? hall.eventKeys : [];
  hall.rolling = hall.rolling && typeof hall.rolling === 'object' ? hall.rolling : emptyHall().rolling;
  hall.rolling.speciesStats ||= {};
  hall.rolling.lineageStats ||= {};
  hall.rolling.extinctionByYear ||= {};
  hall.rolling.livingCountByYear ||= {};
  hall.rolling.climateHistory = Array.isArray(hall.rolling.climateHistory) ? hall.rolling.climateHistory : [];
  if (!Number.isFinite(Number(hall.rolling.lastProcessedYear))) hall.rolling.lastProcessedYear = -1;
  return hall;
}

function allSpeciesRecords(ecosystem) {
  const living = Array.isArray(ecosystem?.species) ? ecosystem.species : [];
  const extinct = Array.isArray(ecosystem?.extinct) ? ecosystem.extinct : [];
  return { living, extinct, all: [...living, ...extinct.map(f => ({ ...f, population: 0, extinct: true }))] };
}

function buildParentIndex(ecosystem) {
  const { living, extinct } = allSpeciesRecords(ecosystem);
  const byId = new Map();
  for (const s of [...extinct, ...living]) byId.set(String(s.id), s);
  return byId;
}

export function lineageRootId(speciesId, byId) {
  let id = String(speciesId || '');
  const seen = new Set();
  while (id && byId.has(id) && !seen.has(id)) {
    seen.add(id);
    const parent = byId.get(id)?.parentId;
    if (!parent || !byId.has(String(parent))) break;
    id = String(parent);
  }
  return id || String(speciesId || '');
}

function lineageMembers(rootId, byId) {
  const members = [];
  for (const [id] of byId) {
    if (lineageRootId(id, byId) === rootId) members.push(byId.get(id));
  }
  return members;
}

function eventExists(hall, key) {
  return hall.eventKeys.includes(key) || hall.events.some(e => e.eventKey === key) || hall.achievements.some(a => a.eventKey === key);
}

function scoreImportance({ rarity = 0, first = false, longevity = 0, ecological = 0, population = 0, geographic = 0, evolutionary = 0, lineage = 0 } = {}) {
  let score = 0;
  score += Math.min(30, rarity);
  if (first) score += 25;
  score += Math.min(20, longevity);
  score += Math.min(20, ecological);
  score += Math.min(15, population);
  score += Math.min(15, geographic);
  score += Math.min(20, evolutionary);
  score += Math.min(15, lineage);
  return Math.round(Math.min(100, score));
}

function pushEvent(hall, event, { forceHall = false } = {}) {
  const key = String(event.eventKey || '');
  if (!key || eventExists(hall, key)) return null;
  const importance = Number(event.importanceScore ?? 0);
  const record = {
    ...event,
    eventKey: key,
    importanceScore: importance,
    inHall: forceHall || importance >= HALL_IMPORTANCE_THRESHOLD,
    recordedAt: event.recordedAt || new Date().toISOString(),
    hallVersion: HALL_VERSION
  };
  hall.eventKeys.push(key);
  hall.events.push(record);
  if (record.kind === 'achievement') {
    hall.achievements.push({
      type: record.achievementType,
      title: record.title,
      worldDay: record.worldDay,
      description: record.description,
      speciesId: record.speciesId || null,
      lineageId: record.lineageId || null,
      biome: record.biome || null,
      region: record.region || null,
      stats: record.stats || {},
      triggerReason: record.triggerReason || '',
      eventKey: key,
      timestamp: record.recordedAt,
      version: HALL_VERSION
    });
  }
  return record;
}

function updateRollingStats(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  const byId = buildParentIndex(ecosystem);
  const { living, extinct } = allSpeciesRecords(ecosystem);
  const stats = hall.rolling.speciesStats;
  const lineageStats = hall.rolling.lineageStats;

  for (const s of living) {
    const id = String(s.id);
    const prev = stats[id] || {
      id,
      name: s.name,
      kind: s.kind,
      originalHabitat: normalizeHabitat(s.habitat),
      habitatsSeen: [],
      peakPopulation: 0,
      bornYear: Number(s.bornYear || 0),
      baselineTraits: traitVector(s.traits),
      firstSeenYear: year
    };
    const habitat = normalizeHabitat(s.habitat);
    const habitats = new Set([...(prev.habitatsSeen || []), habitat].filter(Boolean));
    for (const patch of (ecosystem.plantPatches || []).filter(p => p.speciesId === id)) {
      const ph = normalizeHabitat(patch.habitat);
      if (ph) habitats.add(ph);
    }
    prev.name = s.name;
    prev.kind = s.kind;
    prev.habitatsSeen = [...habitats];
    prev.peakPopulation = Math.max(Number(prev.peakPopulation || 0), Number(s.population || 0));
    prev.bornYear = Number(s.bornYear ?? prev.bornYear ?? 0);
    prev.baselineTraits ||= traitVector(s.traits);
    prev.lastTraits = traitVector(s.traits);
    prev.lastPopulation = Number(s.population || 0);
    prev.alive = true;
    prev.extinctYear = null;
    stats[id] = prev;

    const root = lineageRootId(id, byId);
    const ls = lineageStats[root] || {
      rootId: root,
      rootName: byId.get(root)?.name || s.name,
      habitatsSeen: [],
      peakPopulation: 0,
      speciesIds: [],
      bornYear: Number(byId.get(root)?.bornYear || s.bornYear || 0),
      extinctYear: null,
      alive: true
    };
    const lh = new Set([...(ls.habitatsSeen || []), ...habitats]);
    ls.habitatsSeen = [...lh];
    ls.peakPopulation = Math.max(Number(ls.peakPopulation || 0), Number(s.population || 0), Number(prev.peakPopulation || 0));
    ls.speciesIds = [...new Set([...(ls.speciesIds || []), id])];
    ls.alive = true;
    ls.extinctYear = null;
    ls.rootName = byId.get(root)?.name || ls.rootName;
    lineageStats[root] = ls;
  }

  for (const fossil of extinct) {
    const id = String(fossil.id);
    const prev = stats[id] || {
      id,
      name: fossil.name,
      kind: fossil.kind,
      originalHabitat: normalizeHabitat(fossil.lastHabitat || fossil.habitat),
      habitatsSeen: [normalizeHabitat(fossil.lastHabitat || fossil.habitat)].filter(Boolean),
      peakPopulation: 0,
      bornYear: Number(fossil.bornYear || 0),
      baselineTraits: traitVector(fossil.finalTraits || fossil.traits),
      firstSeenYear: Number(fossil.bornYear || year)
    };
    prev.alive = false;
    prev.extinctYear = Number(fossil.extinctYear || year);
    prev.lastHabitat = normalizeHabitat(fossil.lastHabitat || fossil.habitat);
    if (prev.lastHabitat && !prev.habitatsSeen.includes(prev.lastHabitat)) prev.habitatsSeen.push(prev.lastHabitat);
    stats[id] = prev;

    const root = lineageRootId(id, byId);
    const members = lineageMembers(root, byId);
    const anyAlive = members.some(m => living.some(l => String(l.id) === String(m.id)));
    const ls = lineageStats[root] || {
      rootId: root,
      rootName: byId.get(root)?.name || fossil.name,
      habitatsSeen: [],
      peakPopulation: 0,
      speciesIds: [],
      bornYear: Number(byId.get(root)?.bornYear || fossil.bornYear || 0),
      extinctYear: null,
      alive: true
    };
    ls.speciesIds = [...new Set([...(ls.speciesIds || []), id, ...members.map(m => String(m.id))])];
    ls.habitatsSeen = [...new Set([...(ls.habitatsSeen || []), ...(prev.habitatsSeen || [])].filter(Boolean))];
    ls.alive = anyAlive;
    if (!anyAlive) ls.extinctYear = Math.max(...members.map(m => Number(m.extinctYear || year)));
    lineageStats[root] = ls;
  }

  hall.rolling.livingCountByYear[year] = living.length;
  const newlyExtinct = extinct.filter(f => Number(f.extinctYear) === year);
  hall.rolling.extinctionByYear[year] = newlyExtinct.length;
  hall.rolling.climateHistory = [...hall.rolling.climateHistory, {
    year,
    temperatureC: Number(ecosystem.climate?.temperatureC || 0),
    rainfall: Number(ecosystem.climate?.rainfall || 0),
    fertility: Number(ecosystem.climate?.fertility || 0)
  }].slice(-80);
}

function detectMigrations(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  const byId = buildParentIndex(ecosystem);
  const out = [];

  for (const s of ecosystem.species || []) {
    const id = String(s.id);
    const st = hall.rolling.speciesStats[id];
    if (!st) continue;
    const current = normalizeHabitat(s.habitat);
    const original = normalizeHabitat(st.originalHabitat);
    if (current && original && current !== original) {
      out.push({
        species: s,
        lineageId: lineageRootId(id, byId),
        from: original,
        to: current,
        reason: 'primary_habitat_shift',
        year
      });
    }
  }

  for (const patch of ecosystem.plantPatches || []) {
    const species = (ecosystem.species || []).find(s => s.id === patch.speciesId);
    if (!species) continue;
    const st = hall.rolling.speciesStats[String(species.id)];
    const original = normalizeHabitat(st?.originalHabitat || species.habitat);
    const patchHabitat = normalizeHabitat(patch.habitat);
    if (patchHabitat && original && patchHabitat !== original && Number(patch.foundedYear || year) === year) {
      out.push({
        species,
        lineageId: lineageRootId(species.id, byId),
        from: original,
        to: patchHabitat,
        reason: 'colony_established',
        year,
        patchId: patch.id
      });
    }
  }

  for (const s of ecosystem.species || []) {
    if (!s.parentId || Number(s.bornYear) !== year) continue;
    const parent = byId.get(String(s.parentId));
    const from = normalizeHabitat(parent?.habitat);
    const to = normalizeHabitat(s.habitat);
    if (from && to && from !== to) {
      out.push({
        species: s,
        lineageId: lineageRootId(s.id, byId),
        from,
        to,
        reason: 'speciation_habitat_branch',
        year
      });
    }
  }

  return out;
}

function achievementEvent({ type, title, year, description, species, lineageId, biome, stats, triggerReason, importance, category = CATEGORY.ACHIEVEMENT, icon = '🧬' }) {
  return {
    kind: 'achievement',
    achievementType: type,
    category,
    icon,
    title,
    worldDay: year,
    description,
    speciesId: species?.id || null,
    speciesName: species?.name || null,
    lineageId: lineageId || species?.id || null,
    biome: biome || normalizeHabitat(species?.habitat) || null,
    region: biome || normalizeHabitat(species?.habitat) || null,
    stats: stats || {},
    triggerReason,
    importanceScore: importance,
    eventKey: `achievement:${type}:${lineageId || species?.id || 'world'}`
  };
}

function detectAchievements(hall, ecosystem, ctx) {
  const year = Number(ecosystem.simulatedYear || 0);
  const byId = buildParentIndex(ecosystem);
  const living = ecosystem.species || [];

  // First Survivor
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.FIRST_SURVIVOR)) {
    const survivors = living
      .map(s => ({ s, age: year - Number(s.bornYear || 0) }))
      .filter(x => x.age >= THRESHOLDS.SURVIVOR_YEARS)
      .sort((a, b) => b.age - a.age || String(a.s.id).localeCompare(String(b.s.id)));
    if (survivors.length) {
      const { s, age } = survivors[0];
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.FIRST_SURVIVOR,
        title: 'First Survivor',
        year,
        description: `${s.name} became the first recorded lineage to persist for ${age} ecological years.`,
        species: s,
        lineageId: lineageRootId(s.id, byId),
        stats: { longevityYears: age, population: Number(s.population || 0) },
        triggerReason: `longevity>=${THRESHOLDS.SURVIVOR_YEARS}`,
        importance: scoreImportance({ first: true, longevity: 18, lineage: 12, rarity: 20 }),
        icon: '🛡️'
      }));
    }
  }

  // Leaving Home — first migration / colony outside original habitat
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.LEAVING_HOME) && ctx.migrations.length) {
    const m = ctx.migrations[0];
    pushEvent(hall, achievementEvent({
      type: ACHIEVEMENT_TYPES.LEAVING_HOME,
      title: 'Leaving Home',
      year,
      description: `${m.species.name} became the first known species to establish itself outside its original ${m.from} habitat, reaching the ${m.to}.`,
      species: m.species,
      lineageId: m.lineageId,
      biome: m.to,
      stats: { from: m.from, to: m.to, reason: m.reason },
      triggerReason: m.reason,
      importance: scoreImportance({ first: true, geographic: 15, evolutionary: 12, rarity: 18 }),
      category: CATEGORY.LINEAGE,
      icon: '🐾'
    }));
    pushEvent(hall, {
      kind: 'milestone',
      category: CATEGORY.LINEAGE,
      icon: '🐾',
      title: 'First Migration',
      worldDay: year,
      description: `${m.species.name} became the first known species to establish a population outside its original habitat.`,
      speciesId: m.species.id,
      speciesName: m.species.name,
      lineageId: m.lineageId,
      biome: m.to,
      stats: { from: m.from, to: m.to, reason: m.reason },
      triggerReason: 'first_migration',
      importanceScore: scoreImportance({ first: true, geographic: 15, evolutionary: 10, rarity: 16 }),
      eventKey: `milestone:first_migration:${m.species.id}:${year}`
    });
  } else if (ctx.migrations.length) {
    for (const m of ctx.migrations) {
      const importance = scoreImportance({ geographic: 10, evolutionary: 8, lineage: 6, rarity: 8 });
      pushEvent(hall, {
        kind: 'milestone',
        category: CATEGORY.LINEAGE,
        icon: '🐾',
        title: 'Habitat Expansion',
        worldDay: year,
        description: `${m.species.name} expanded from ${m.from} into the ${m.to}.`,
        speciesId: m.species.id,
        speciesName: m.species.name,
        lineageId: m.lineageId,
        biome: m.to,
        stats: { from: m.from, to: m.to, reason: m.reason },
        triggerReason: m.reason,
        importanceScore: importance,
        eventKey: `migration:${m.species.id}:${m.to}:${year}:${m.reason}`
      });
    }
  }

  // The Hunter — first successful predation
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.THE_HUNTER)) {
    const hunters = living.filter(s => s.kind === 'predator' && Number(s.lastHunt?.kills || 0) > 0);
    const fromEvents = (ecosystem.recentEvents || []).filter(e => e.type === 'predation' && Number(e.year) === year);
    const predator = hunters.sort((a, b) => Number(b.lastHunt.kills) - Number(a.lastHunt.kills))[0]
      || (fromEvents.length ? living.find(s => s.kind === 'predator') : null);
    if (predator && (Number(predator.lastHunt?.kills || 0) > 0 || fromEvents.length)) {
      const kills = Number(predator.lastHunt?.kills || 0);
      const preyId = predator.lastHunt?.preyId || null;
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.THE_HUNTER,
        title: 'The Hunter',
        year,
        description: `${predator.name} became the first recorded successful predator${preyId ? `, hunting ${byId.get(String(preyId))?.name || preyId}` : ''}.`,
        species: predator,
        lineageId: lineageRootId(predator.id, byId),
        stats: { kills, preyId, success: predator.lastHunt?.success ?? null },
        triggerReason: 'first_successful_predation',
        importance: scoreImportance({ first: true, ecological: 18, evolutionary: 12, rarity: 16 }),
        icon: '🐺'
      }));
    }
  }

  // World Traveler
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.WORLD_TRAVELER)) {
    const travelers = Object.values(hall.rolling.lineageStats)
      .filter(ls => ls.alive && (ls.habitatsSeen || []).length >= THRESHOLDS.WORLD_TRAVELER_HABITATS)
      .sort((a, b) => (b.habitatsSeen.length - a.habitatsSeen.length) || String(a.rootId).localeCompare(String(b.rootId)));
    if (travelers.length) {
      const ls = travelers[0];
      const species = living.find(s => lineageRootId(s.id, byId) === ls.rootId) || byId.get(ls.rootId);
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.WORLD_TRAVELER,
        title: 'World Traveler',
        year,
        description: `The ${ls.rootName} lineage established populations across ${ls.habitatsSeen.length} distinct habitats: ${ls.habitatsSeen.join(', ')}.`,
        species,
        lineageId: ls.rootId,
        biome: ls.habitatsSeen[ls.habitatsSeen.length - 1],
        stats: { habitats: ls.habitatsSeen, speciesCount: (ls.speciesIds || []).length },
        triggerReason: `habitats>=${THRESHOLDS.WORLD_TRAVELER_HABITATS}`,
        importance: scoreImportance({ first: true, geographic: 15, lineage: 12, evolutionary: 10, rarity: 14 }),
        category: CATEGORY.LINEAGE,
        icon: '🌍'
      }));
    }
  }

  // Ancient One
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.ANCIENT_ONE)) {
    const ancients = living
      .map(s => ({ s, age: year - Number(s.bornYear || 0), root: lineageRootId(s.id, byId) }))
      .filter(x => x.age >= THRESHOLDS.ANCIENT_YEARS)
      .sort((a, b) => b.age - a.age);
    if (ancients.length) {
      const { s, age } = ancients[0];
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.ANCIENT_ONE,
        title: 'Ancient One',
        year,
        description: `${s.name} is recognized as an exceptionally long-lived lineage, enduring ${age} ecological years.`,
        species: s,
        lineageId: lineageRootId(s.id, byId),
        stats: { longevityYears: age, population: Number(s.population || 0) },
        triggerReason: `longevity>=${THRESHOLDS.ANCIENT_YEARS}`,
        importance: scoreImportance({ first: true, longevity: 20, lineage: 14, rarity: 18 }),
        category: CATEGORY.LINEAGE,
        icon: '⏳'
      }));
    }
  }

  // Living Fossil — long persistence with little trait change
  if (!hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.LIVING_FOSSIL)) {
    const fossils = living.map(s => {
      const st = hall.rolling.speciesStats[String(s.id)];
      const age = year - Number(s.bornYear || 0);
      const drift = st ? traitDrift(st.baselineTraits, s.traits) : 1;
      return { s, age, drift };
    }).filter(x => x.age >= THRESHOLDS.LIVING_FOSSIL_YEARS && x.drift <= THRESHOLDS.LIVING_FOSSIL_MAX_DRIFT)
      .sort((a, b) => a.drift - b.drift || b.age - a.age);
    if (fossils.length) {
      const { s, age, drift } = fossils[0];
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.LIVING_FOSSIL,
        title: 'Living Fossil',
        year,
        description: `${s.name} persisted for ${age} years with unusually little evolutionary change (trait drift ${drift.toFixed(3)}).`,
        species: s,
        lineageId: lineageRootId(s.id, byId),
        stats: { longevityYears: age, traitDrift: Number(drift.toFixed(4)) },
        triggerReason: `longevity>=${THRESHOLDS.LIVING_FOSSIL_YEARS}&&traitDrift<=${THRESHOLDS.LIVING_FOSSIL_MAX_DRIFT}`,
        importance: scoreImportance({ first: true, longevity: 16, evolutionary: 18, rarity: 16 }),
        category: CATEGORY.EVOLUTION,
        icon: '🧬'
      }));
    }
  }
}

function averageBaselineExtinctionRate(hall, year) {
  const start = Math.max(0, year - THRESHOLDS.BASELINE_TURNOVER_WINDOW);
  let total = 0, years = 0;
  for (let y = start; y < year; y++) {
    if (hall.rolling.extinctionByYear[y] != null) {
      total += Number(hall.rolling.extinctionByYear[y] || 0);
      years += 1;
    }
  }
  return years ? total / years : 0;
}

function climateCorrelation(hall, fromYear, toYear) {
  const slice = hall.rolling.climateHistory.filter(c => c.year >= fromYear && c.year <= toYear);
  if (slice.length < 2) return null;
  const first = slice[0];
  // Prefer the most extreme later sample so a final stable tick does not erase the swing.
  let peakTemp = 0, peakRain = 0, best = null;
  for (const sample of slice.slice(1)) {
    const dTemp = sample.temperatureC - first.temperatureC;
    const dRain = sample.rainfall - first.rainfall;
    const score = Math.abs(dTemp) / 2 + Math.abs(dRain) * 8;
    if (!best || score > best.score) best = { dTemp, dRain, score };
    peakTemp = Math.max(peakTemp, Math.abs(dTemp));
    peakRain = Math.max(peakRain, Math.abs(dRain));
  }
  if (!best) return null;
  const notes = [];
  if (Math.abs(best.dTemp) >= 1.2) notes.push(`temperature ${best.dTemp > 0 ? 'rising' : 'falling'} by ${Math.abs(best.dTemp).toFixed(1)}°C`);
  if (Math.abs(best.dRain) >= 0.08) notes.push(`rainfall ${best.dRain > 0 ? 'increasing' : 'decreasing'} by ${Math.round(Math.abs(best.dRain) * 100)} points`);
  return notes.length ? notes.join(' and ') : null;
}

function detectMassExtinction(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  const window = THRESHOLDS.MASS_WINDOW_YEARS;
  const recentMass = (hall.events || []).filter(e => e.kind === 'mass_extinction').sort((a, b) => b.worldDay - a.worldDay)[0];
  if (recentMass && year - Number(recentMass.worldDay) < window) return null;
  const from = Math.max(0, year - window + 1);
  let extinctInWindow = 0;
  for (let y = from; y <= year; y++) extinctInWindow += Number(hall.rolling.extinctionByYear[y] || 0);
  const livingNow = (ecosystem.species || []).length;
  const livingBefore = Math.max(
    THRESHOLDS.MASS_MIN_LIVING_BEFORE,
    Number(hall.rolling.livingCountByYear[from - 1] ?? hall.rolling.livingCountByYear[from] ?? livingNow + extinctInWindow),
    livingNow + extinctInWindow
  );
  if (livingBefore < THRESHOLDS.MASS_MIN_LIVING_BEFORE) return null;
  const fraction = Math.min(1, extinctInWindow / Math.max(1, livingBefore));
  const baseline = averageBaselineExtinctionRate(hall, from);
  const expected = baseline * window;
  if (fraction < THRESHOLDS.MASS_FRACTION || extinctInWindow < 2) return null;
  if (expected > 0 && extinctInWindow < expected * 2.2 && fraction < 0.5) return null;

  const climateNote = climateCorrelation(hall, from, year);
  const regionHint = (() => {
    const fossils = (ecosystem.extinct || []).filter(f => Number(f.extinctYear) >= from && Number(f.extinctYear) <= year);
    const habitats = fossils.map(f => normalizeHabitat(f.lastHabitat)).filter(Boolean);
    if (!habitats.length) return 'valley';
    const counts = habitats.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const title = `The Great ${regionHint.replace(/\b\w/g, c => c.toUpperCase())} Collapse`;
  const description = `${Math.round(fraction * 100)}% of species present near year ${from} disappeared within ${window} generations${climateNote ? `, coinciding with ${climateNote}` : ''}.`;

  const event = pushEvent(hall, {
    kind: 'mass_extinction',
    category: CATEGORY.EXTINCTION,
    icon: '☠',
    title,
    worldDay: year,
    description,
    speciesId: null,
    lineageId: null,
    biome: regionHint,
    region: regionHint,
    stats: {
      windowYears: window,
      fromYear: from,
      extinctCount: extinctInWindow,
      livingBefore,
      fraction: Number(fraction.toFixed(3)),
      baselineExtinctionsPerYear: Number(baseline.toFixed(3)),
      climateNote
    },
    triggerReason: `extinction_fraction>=${THRESHOLDS.MASS_FRACTION}_over_${window}_years`,
    importanceScore: scoreImportance({ rarity: 28, ecological: 20, population: 12, geographic: 10, evolutionary: 10 }),
    eventKey: `mass_extinction:${from}-${year}`
  }, { forceHall: true });

  if (event && !hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.GREAT_DYING)) {
    pushEvent(hall, achievementEvent({
      type: ACHIEVEMENT_TYPES.GREAT_DYING,
      title: 'Great Dying',
      year,
      description,
      species: null,
      lineageId: 'world',
      biome: regionHint,
      stats: event.stats,
      triggerReason: event.triggerReason,
      importance: 95,
      category: CATEGORY.EXTINCTION,
      icon: '☠'
    }));
  }

  // Against All Odds — lineage survived while many peers disappeared
  if (event && !hall.achievements.some(a => a.type === ACHIEVEMENT_TYPES.AGAINST_ALL_ODDS)) {
    const fossils = (ecosystem.extinct || []).filter(f => Number(f.extinctYear) >= from && Number(f.extinctYear) <= year);
    const byKind = fossils.reduce((m, f) => (m[f.kind] = (m[f.kind] || 0) + 1, m), {});
    for (const s of ecosystem.species || []) {
      const kindLost = Number(byKind[s.kind] || 0);
      const kindLivingNow = (ecosystem.species || []).filter(x => x.kind === s.kind).length;
      const kindBefore = kindLost + kindLivingNow;
      if (kindBefore < 3) continue;
      if (kindLost / kindBefore < 0.4) continue;
      if (year - Number(s.bornYear || 0) < 10) continue;
      pushEvent(hall, achievementEvent({
        type: ACHIEVEMENT_TYPES.AGAINST_ALL_ODDS,
        title: 'Against All Odds',
        year,
        description: `${s.name} endured a major biodiversity collapse that removed ${Math.round((kindLost / kindBefore) * 100)}% of comparable ${s.kind} species.`,
        species: s,
        lineageId: lineageRootId(s.id, buildParentIndex(ecosystem)),
        stats: { kind: s.kind, kindLost, kindBefore, window: [from, year] },
        triggerReason: 'survived_mass_extinction_window',
        importance: scoreImportance({ first: true, rarity: 22, longevity: 10, ecological: 14, lineage: 10 }),
        category: CATEGORY.LINEAGE,
        icon: '✨'
      }));
      break;
    }
  }

  return event;
}

function detectImportantExtinctions(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  const byId = buildParentIndex(ecosystem);
  const fossils = (ecosystem.extinct || []).filter(f => Number(f.extinctYear) === year);

  for (const fossil of fossils) {
    const root = lineageRootId(fossil.id, byId);
    const ls = hall.rolling.lineageStats[root];
    const members = lineageMembers(root, byId);
    const lineageAlive = members.some(m => (ecosystem.species || []).some(s => String(s.id) === String(m.id)));
    const longevity = Number(fossil.extinctYear || year) - Number(ls?.bornYear ?? fossil.bornYear ?? 0);
    const descendants = Math.max(0, (ls?.speciesIds || members.map(m => m.id)).length - 1);
    const peak = Number(ls?.peakPopulation || hall.rolling.speciesStats[String(fossil.id)]?.peakPopulation || 0);
    const wasAge = hall.ages.some(a => a.lineageId === root || a.dominantSpeciesId === fossil.id);
    const important = longevity >= THRESHOLDS.DYNASTY_MIN_YEARS
      || peak >= THRESHOLDS.DYNASTY_MIN_PEAK
      || descendants >= THRESHOLDS.DYNASTY_MIN_DESCENDANTS
      || wasAge
      || hall.achievements.some(a => a.lineageId === root || a.speciesId === fossil.id);

    if (!important) {
      // Keep lower-importance note for species history only.
      pushEvent(hall, {
        kind: 'extinction',
        category: CATEGORY.EXTINCTION,
        icon: '🕯',
        title: `${fossil.name} Extinct`,
        worldDay: year,
        description: `${fossil.name} disappeared from the living record${fossil.cause ? ` following ${fossil.cause}` : ''}.`,
        speciesId: fossil.id,
        speciesName: fossil.name,
        lineageId: root,
        biome: normalizeHabitat(fossil.lastHabitat),
        stats: { longevity, peak, descendants, cause: fossil.cause || null },
        triggerReason: 'species_extinction',
        importanceScore: scoreImportance({ longevity: Math.min(12, longevity / 4), population: Math.min(10, peak / 80), lineage: descendants * 3 }),
        eventKey: `extinction:species:${fossil.id}:${year}`
      });
      continue;
    }

    if (!lineageAlive) {
      pushEvent(hall, {
        kind: 'dynasty_end',
        category: CATEGORY.EXTINCTION,
        icon: '🕯',
        title: 'End of a Dynasty',
        worldDay: year,
        description: `After ${Math.max(1, longevity)} generations, the final descendant of the ${ls?.rootName || fossil.name} lineage has disappeared. Its lineage produced ${descendants + 1} known species and occupied ${(ls?.habitatsSeen || [normalizeHabitat(fossil.lastHabitat)].filter(Boolean)).length} major habitats.`,
        speciesId: fossil.id,
        speciesName: fossil.name,
        lineageId: root,
        biome: normalizeHabitat(fossil.lastHabitat),
        stats: {
          longevity,
          peakPopulation: peak,
          speciesCount: descendants + 1,
          habitats: ls?.habitatsSeen || [],
          cause: fossil.cause || null,
          wasAge
        },
        triggerReason: 'lineage_extinct_important',
        importanceScore: scoreImportance({
          longevity: Math.min(20, longevity / 3),
          lineage: 14,
          ecological: wasAge ? 18 : 10,
          population: Math.min(12, peak / 60),
          rarity: 12
        }),
        eventKey: `extinction:dynasty:${root}:${year}`
      }, { forceHall: true });
    } else {
      pushEvent(hall, {
        kind: 'extinction',
        category: CATEGORY.EXTINCTION,
        icon: '🕯',
        title: `End of the ${fossil.name}`,
        worldDay: year,
        description: `${fossil.name} became extinct after ${Math.max(1, longevity)} years${fossil.cause ? `, coinciding with ${fossil.cause}` : ''}. Related lineage members remain.`,
        speciesId: fossil.id,
        speciesName: fossil.name,
        lineageId: root,
        biome: normalizeHabitat(fossil.lastHabitat),
        stats: { longevity, peak, descendants, cause: fossil.cause || null },
        triggerReason: 'important_species_extinction',
        importanceScore: scoreImportance({ longevity: 12, lineage: 10, ecological: 10, rarity: 10 }),
        eventKey: `extinction:species:${fossil.id}:${year}`
      });
    }
  }
}

function lineageDominance(ecosystem, byId) {
  const animals = (ecosystem.species || []).filter(s => s.kind === 'herbivore' || s.kind === 'predator');
  const plants = (ecosystem.species || []).filter(s => s.kind === 'plant');
  const groups = new Map();

  function accumulate(list, weightMode) {
    const total = list.reduce((n, s) => n + Math.max(0, Number(s.population || 0)), 0);
    if (total <= 0) return;
    for (const s of list) {
      const root = lineageRootId(s.id, byId);
      const g = groups.get(root) || {
        lineageId: root,
        name: byId.get(root)?.name || s.name,
        kind: byId.get(root)?.kind || s.kind,
        population: 0,
        share: 0,
        speciesIds: new Set(),
        pool: weightMode
      };
      g.population += Math.max(0, Number(s.population || 0));
      g.speciesIds.add(String(s.id));
      g.totalPool = total;
      groups.set(root, g);
    }
    for (const g of groups.values()) {
      if (g.pool === weightMode) g.share = g.population / total;
    }
  }

  accumulate(animals, 'animals');
  // Plant ages only if no strong animal dominance candidate later; still compute shares.
  accumulate(plants, 'plants');

  return [...groups.values()]
    .map(g => ({ ...g, speciesIds: [...g.speciesIds], diversity: g.speciesIds.size }))
    .sort((a, b) => b.share - a.share || b.population - a.population);
}

function detectAges(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  const byId = buildParentIndex(ecosystem);
  const ranked = lineageDominance(ecosystem, byId).filter(g => g.pool === 'animals' || (g.pool === 'plants' && g.share >= 0.55));
  // Prefer animal ecological ages when they qualify; plant ages remain available otherwise.
  const animalLeaders = ranked.filter(g => g.pool === 'animals' && g.share >= THRESHOLDS.AGE_ENTER_SHARE && g.population >= 40);
  const leader = animalLeaders[0] || ranked[0] || null;
  const current = hall.ages.find(a => a.id === hall.currentAgeId && !a.endDay) || null;

  // Track enter/exit streaks on rolling candidate
  if (leader && leader.share >= THRESHOLDS.AGE_ENTER_SHARE && leader.population >= 40) {
    const cand = hall.rolling.ageCandidate;
    if (cand && cand.lineageId === leader.lineageId) {
      cand.streak = Number(cand.streak || 0) + 1;
      cand.share = leader.share;
      cand.population = leader.population;
      cand.year = year;
    } else {
      hall.rolling.ageCandidate = {
        lineageId: leader.lineageId,
        name: leader.name,
        streak: 1,
        share: leader.share,
        population: leader.population,
        year,
        pool: leader.pool
      };
    }
  } else if (hall.rolling.ageCandidate) {
    hall.rolling.ageCandidate.streak = 0;
  }

  // Begin age
  const cand = hall.rolling.ageCandidate;
  const lastEnded = [...(hall.ages || [])].filter(a => a.endDay != null).sort((a, b) => Number(b.endDay) - Number(a.endDay))[0];
  const cooledDown = !lastEnded || (year - Number(lastEnded.endDay)) >= THRESHOLDS.AGE_COOLDOWN_AFTER_END;
  if (!current && cooledDown && cand && cand.streak >= THRESHOLDS.AGE_ENTER_STREAK && cand.share >= THRESHOLDS.AGE_ENTER_SHARE) {
    const label = ageLabelFromName(cand.name);
    const ageName = `Age of ${label}`;
    const id = `age:${cand.lineageId}:${year}`;
    const age = {
      id,
      name: ageName,
      startDay: year,
      endDay: null,
      dominantLineageId: cand.lineageId,
      dominantSpeciesId: cand.lineageId,
      dominantGroup: label,
      reasonBegan: `${cand.name} descendants held ${Math.round(cand.share * 100)}% of ${cand.pool} life for ${cand.streak} consecutive years.`,
      reasonEnded: null,
      stats: { enterShare: cand.share, population: cand.population, pool: cand.pool, diversity: ranked.find(r => r.lineageId === cand.lineageId)?.diversity || 1 }
    };
    hall.ages.push(age);
    hall.currentAgeId = id;
    hall.rolling.ageExitStreak = 0;
    pushEvent(hall, {
      kind: 'age_begin',
      category: CATEGORY.AGE,
      icon: '👑',
      title: `${ageName} Begins`,
      worldDay: year,
      description: age.reasonBegan,
      speciesId: cand.lineageId,
      speciesName: cand.name,
      lineageId: cand.lineageId,
      stats: age.stats,
      triggerReason: 'dominance_threshold_sustained',
      importanceScore: scoreImportance({ rarity: 20, ecological: 18, lineage: 14, population: 10, first: !hall.ages.some(a => a.id !== id) }),
      eventKey: `age:begin:${cand.lineageId}:${year}`
    }, { forceHall: true });
    return;
  }

  if (!current) return;

  const currentShare = ranked.find(r => r.lineageId === current.dominantLineageId)?.share || 0;
  const rival = ranked.find(r => r.lineageId !== current.dominantLineageId);
  const ageDuration = year - Number(current.startDay || year);
  const weakened = currentShare < THRESHOLDS.AGE_EXIT_SHARE;
  const overtaken = rival && rival.share >= THRESHOLDS.AGE_ENTER_SHARE && rival.share > currentShare + 0.08;

  if (ageDuration >= THRESHOLDS.AGE_MIN_DURATION && (weakened || overtaken)) {
    hall.rolling.ageExitStreak = Number(hall.rolling.ageExitStreak || 0) + 1;
  } else {
    hall.rolling.ageExitStreak = 0;
  }

  if (hall.rolling.ageExitStreak >= THRESHOLDS.AGE_EXIT_STREAK && ageDuration >= THRESHOLDS.AGE_MIN_DURATION) {
    current.endDay = year;
    current.reasonEnded = overtaken && rival
      ? `${rival.name} overtook the former dominant lineage (${Math.round((rival.share || 0) * 100)}% vs ${Math.round(currentShare * 100)}%).`
      : `Dominance fell to ${Math.round(currentShare * 100)}% for ${hall.rolling.ageExitStreak} consecutive years.`;
    current.stats = { ...(current.stats || {}), exitShare: currentShare, endPopulation: ranked.find(r => r.lineageId === current.dominantLineageId)?.population || 0 };
    hall.currentAgeId = null;
    hall.rolling.ageExitStreak = 0;
    pushEvent(hall, {
      kind: 'age_end',
      category: CATEGORY.AGE,
      icon: '👑',
      title: `${current.name} Ends`,
      worldDay: year,
      description: current.reasonEnded,
      speciesId: current.dominantSpeciesId,
      lineageId: current.dominantLineageId,
      stats: current.stats,
      triggerReason: overtaken ? 'overtaken' : 'dominance_lost',
      importanceScore: scoreImportance({ rarity: 18, ecological: 16, lineage: 12, longevity: Math.min(15, ageDuration / 2) }),
      eventKey: `age:end:${current.dominantLineageId}:${year}`
    }, { forceHall: true });
  }
}

function detectSpeciationNotes(hall, ecosystem) {
  const year = Number(ecosystem.simulatedYear || 0);
  for (const s of ecosystem.species || []) {
    if (Number(s.bornYear) !== year || !s.parentId) continue;
    const parent = (ecosystem.species || []).find(p => p.id === s.parentId)
      || (ecosystem.extinct || []).find(p => p.id === s.parentId);
    pushEvent(hall, {
      kind: 'speciation',
      category: CATEGORY.EVOLUTION,
      icon: '🌿',
      title: 'New Branch',
      worldDay: year,
      description: `${s.name} branched from ${parent?.name || 'an ancestral species'}.`,
      speciesId: s.id,
      speciesName: s.name,
      lineageId: lineageRootId(s.id, buildParentIndex(ecosystem)),
      biome: normalizeHabitat(s.habitat),
      stats: {
        parentId: s.parentId,
        population: Number(s.population || 0),
        traits: traitVector(s.traits)
      },
      triggerReason: 'speciation_event',
      importanceScore: scoreImportance({ evolutionary: 14, rarity: 10, lineage: 8 }),
      eventKey: `speciation:${s.id}:${year}`
    });
  }
}

/**
 * Observe one ecological year and append historical records.
 * Idempotent for a given simulatedYear.
 * Mutates only ecosystem.hallOfHistory (creates if missing).
 */
export function observeHallOfHistory(ecosystem) {
  if (!ecosystem || typeof ecosystem !== 'object') return ecosystem;
  const year = Number(ecosystem.simulatedYear || 0);
  const hall = ensureHall(ecosystem.hallOfHistory);

  if (hall.rolling.lastProcessedYear === year) {
    ecosystem.hallOfHistory = hall;
    return ecosystem;
  }

  // Pure observation path: snapshot simulation-facing fields for integrity tests.
  updateRollingStats(hall, ecosystem);
  const migrations = detectMigrations(hall, ecosystem);
  detectSpeciationNotes(hall, ecosystem);
  detectAchievements(hall, ecosystem, { migrations });
  detectImportantExtinctions(hall, ecosystem);
  detectMassExtinction(hall, ecosystem);
  detectAges(hall, ecosystem);

  hall.rolling.lastProcessedYear = year;
  hall.rolling.bootstrapped = true;
  // Keep event list bounded but generous for a long-lived world.
  if (hall.events.length > 400) {
    const kept = hall.events.filter(e => e.inHall || e.kind === 'achievement' || e.kind === 'age_begin' || e.kind === 'age_end' || e.kind === 'dynasty_end' || e.kind === 'mass_extinction');
    const rest = hall.events.filter(e => !kept.includes(e)).slice(-120);
    hall.events = [...kept, ...rest].sort((a, b) => a.worldDay - b.worldDay || String(a.eventKey).localeCompare(String(b.eventKey)));
    hall.eventKeys = hall.events.map(e => e.eventKey);
  }

  ecosystem.hallOfHistory = hall;
  return ecosystem;
}

/** Run observation after evolveOneYear without touching simulation fields besides hallOfHistory. */
export function attachHallOfHistory(ecosystem) {
  const beforeSpecies = cloneJson(ecosystem.species || []);
  const beforeClimate = cloneJson(ecosystem.climate || {});
  const beforeExtinct = cloneJson(ecosystem.extinct || []);
  observeHallOfHistory(ecosystem);
  // Hard guarantee: restore simulation fields if somehow altered (defensive).
  ecosystem.species = beforeSpecies;
  ecosystem.climate = beforeClimate;
  ecosystem.extinct = beforeExtinct;
  return ecosystem;
}

export function hallEventsForUi(hall, { filter = 'all' } = {}) {
  const events = (hall?.events || []).filter(e => e.inHall !== false || e.importanceScore >= HALL_IMPORTANCE_THRESHOLD);
  const major = events.filter(e => e.inHall);
  const filtered = filter === 'all' ? major : major.filter(e => {
    if (filter === 'evolution') return e.category === CATEGORY.EVOLUTION || e.kind === 'speciation' || e.achievementType === ACHIEVEMENT_TYPES.LIVING_FOSSIL;
    if (filter === 'extinction') return e.category === CATEGORY.EXTINCTION;
    if (filter === 'environment') return e.category === CATEGORY.ENVIRONMENT || e.kind === 'mass_extinction';
    if (filter === 'lineages') return e.category === CATEGORY.LINEAGE || e.kind === 'migration' || e.achievementType === ACHIEVEMENT_TYPES.WORLD_TRAVELER;
    if (filter === 'ages') return e.category === CATEGORY.AGE;
    return true;
  });
  return filtered.slice().sort((a, b) => b.worldDay - a.worldDay || String(b.eventKey).localeCompare(String(a.eventKey)));
}

export function currentAgeView(hall) {
  if (!hall?.currentAgeId) return null;
  return (hall.ages || []).find(a => a.id === hall.currentAgeId && !a.endDay) || null;
}

export function lineageTree(ecosystem, focusId) {
  const byId = buildParentIndex(ecosystem);
  const root = lineageRootId(focusId, byId);
  const members = lineageMembers(root, byId);
  const livingIds = new Set((ecosystem.species || []).map(s => String(s.id)));
  const nodes = members.map(m => ({
    id: String(m.id),
    name: m.name,
    parentId: m.parentId ? String(m.parentId) : null,
    bornYear: Number(m.bornYear || 0),
    extinctYear: livingIds.has(String(m.id)) ? null : Number(m.extinctYear || 0) || null,
    kind: m.kind,
    habitat: normalizeHabitat(m.habitat || m.lastHabitat),
    population: livingIds.has(String(m.id)) ? Number(m.population || 0) : 0
  }));
  return { rootId: root, rootName: byId.get(root)?.name || root, nodes };
}

export function lineageDetail(ecosystem, speciesOrLineageId) {
  const hall = ensureHall(ecosystem?.hallOfHistory);
  const tree = lineageTree(ecosystem, speciesOrLineageId);
  const st = hall.rolling.speciesStats[String(speciesOrLineageId)] || hall.rolling.lineageStats[tree.rootId] || null;
  const related = (hall.events || []).filter(e => e.lineageId === tree.rootId || e.speciesId === String(speciesOrLineageId));
  const achievements = (hall.achievements || []).filter(a => a.lineageId === tree.rootId || a.speciesId === String(speciesOrLineageId));
  return {
    tree,
    originDay: st?.bornYear ?? tree.nodes.find(n => n.id === tree.rootId)?.bornYear ?? null,
    extinctionDay: hall.rolling.lineageStats[tree.rootId]?.extinctYear ?? null,
    populationPeak: hall.rolling.lineageStats[tree.rootId]?.peakPopulation || st?.peakPopulation || 0,
    habitats: hall.rolling.lineageStats[tree.rootId]?.habitatsSeen || st?.habitatsSeen || [],
    achievements,
    events: related.filter(e => e.inHall || e.importanceScore >= 40).sort((a, b) => a.worldDay - b.worldDay)
  };
}

export function sinceLastVisitSummary(hall, lastSeenYear) {
  const from = Number(lastSeenYear);
  if (!Number.isFinite(from)) return null;
  const events = (hall?.events || []).filter(e => e.inHall && Number(e.worldDay) > from);
  if (!events.length) return { count: 0, bullets: [] };
  const bullets = [];
  if (events.some(e => e.kind === 'age_begin')) bullets.push('A new Age began.');
  if (events.some(e => e.kind === 'age_end')) bullets.push('An Age ended.');
  const extinctions = events.filter(e => e.category === CATEGORY.EXTINCTION);
  if (extinctions.length === 1) bullets.push('One significant extinction was recorded.');
  else if (extinctions.length > 1) bullets.push(`${extinctions.length} significant extinction events were recorded.`);
  const migrations = events.filter(e => /migration|Leaving Home|Habitat Expansion|World Traveler/i.test(`${e.title} ${e.achievementType || ''}`));
  if (migrations.length) {
    const sample = migrations[0];
    bullets.push(sample.speciesName
      ? `${sample.speciesName} expanded into a new habitat.`
      : 'A lineage entered a new biome.');
  }
  const achievements = events.filter(e => e.kind === 'achievement');
  if (achievements.length && bullets.length < 3) bullets.push(`${achievements.length} world achievement${achievements.length === 1 ? '' : 's'} unlocked.`);
  while (bullets.length < Math.min(3, events.length)) {
    const next = events.find(e => !bullets.some(b => b.includes(e.title)));
    if (!next) break;
    bullets.push(next.title);
  }
  return { count: events.length, bullets: bullets.slice(0, 4), fromYear: from };
}

export function simulationFingerprint(ecosystem) {
  return JSON.stringify({
    year: ecosystem?.simulatedYear,
    climate: ecosystem?.climate,
    species: (ecosystem?.species || []).map(s => ({
      id: s.id,
      population: s.population,
      habitat: s.habitat,
      traits: s.traits,
      parentId: s.parentId,
      bornYear: s.bornYear
    })),
    extinct: (ecosystem?.extinct || []).map(s => ({ id: s.id, extinctYear: s.extinctYear }))
  });
}
