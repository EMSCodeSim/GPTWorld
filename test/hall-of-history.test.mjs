import test from 'node:test';
import assert from 'node:assert/strict';
import { initialEcosystem, evolveOneYear } from '../lib/ecology-sim.mjs';
import {
  ACHIEVEMENT_TYPES,
  THRESHOLDS,
  attachHallOfHistory,
  createEmptyHall,
  currentAgeView,
  hallEventsForUi,
  lineageDetail,
  observeHallOfHistory,
  simulationFingerprint,
  sinceLastVisitSummary
} from '../lib/hall-of-history.mjs';

function evolveWithHall(state) {
  const next = evolveOneYear(state);
  attachHallOfHistory(next);
  return next;
}

function runYears(n, start = initialEcosystem()) {
  let state = start;
  for (let i = 0; i < n; i++) state = evolveWithHall(state);
  return state;
}

function baseEco(overrides = {}) {
  return {
    version: 1,
    simulatedYear: 10,
    climate: { temperatureC: 13, rainfall: 0.6, fertility: 0.7 },
    species: [
      { id: 'rivergrass', name: 'Rivergrass', kind: 'plant', population: 7000, bornYear: 0, parentId: null, habitat: 'riverbank', traits: { size: 0.18, speed: 0, drought: 0.42, cold: 0.55 } },
      { id: 'meadow-grazer', name: 'Meadow Grazer', kind: 'herbivore', population: 500, bornYear: 0, parentId: null, habitat: 'grassland', traits: { size: 0.36, speed: 0.52, drought: 0.38, cold: 0.48 } },
      { id: 'ridge-stalker', name: 'Ridge Stalker', kind: 'predator', population: 40, bornYear: 0, parentId: null, habitat: 'ridge', traits: { size: 0.54, speed: 0.63, drought: 0.46, cold: 0.58 }, lastHunt: { year: 10, preyId: 'meadow-grazer', kills: 5, success: 0.3 } }
    ],
    extinct: [],
    plantPatches: [],
    recentEvents: [],
    ...overrides
  };
}

test('history detection cannot modify simulation outcomes', () => {
  let plain = initialEcosystem();
  let observed = initialEcosystem();
  for (let i = 0; i < 20; i++) {
    plain = evolveOneYear(plain);
    observed = evolveOneYear(observed);
    const before = simulationFingerprint(observed);
    attachHallOfHistory(observed);
    assert.equal(simulationFingerprint(observed), before);
  }
  assert.equal(simulationFingerprint(plain), simulationFingerprint(observed));
  assert.ok(observed.hallOfHistory?.events?.length >= 0);
});

test('first-occurrence achievements trigger correctly and only once', () => {
  const eco = baseEco({ simulatedYear: 1 });
  attachHallOfHistory(eco);
  const hunter = eco.hallOfHistory.achievements.filter((a) => a.type === ACHIEVEMENT_TYPES.THE_HUNTER);
  assert.equal(hunter.length, 1);
  assert.equal(hunter[0].speciesId, 'ridge-stalker');
  assert.match(hunter[0].title, /Hunter/i);

  const countBefore = eco.hallOfHistory.achievements.length;
  attachHallOfHistory(eco); // same year idempotent
  assert.equal(eco.hallOfHistory.achievements.length, countBefore);
  assert.equal(eco.hallOfHistory.achievements.filter((a) => a.type === ACHIEVEMENT_TYPES.THE_HUNTER).length, 1);

  eco.simulatedYear = 2;
  eco.species.find((s) => s.id === 'ridge-stalker').lastHunt = { year: 2, preyId: 'meadow-grazer', kills: 8, success: 0.4 };
  attachHallOfHistory(eco);
  assert.equal(eco.hallOfHistory.achievements.filter((a) => a.type === ACHIEVEMENT_TYPES.THE_HUNTER).length, 1);
});

test('migrations are detected from real colonization state', () => {
  const eco = baseEco({
    simulatedYear: 12,
    plantPatches: [{ id: 'rg-ridge-12', speciesId: 'rivergrass', habitat: 'ridge', population: 220, stage: 'pioneer', foundedYear: 12 }]
  });
  attachHallOfHistory(eco);
  const leaving = eco.hallOfHistory.achievements.find((a) => a.type === ACHIEVEMENT_TYPES.LEAVING_HOME);
  assert.ok(leaving);
  assert.equal(leaving.speciesId, 'rivergrass');
  assert.equal(leaving.biome, 'ridge');
  const migration = eco.hallOfHistory.events.find((e) => e.title === 'First Migration' || e.achievementType === ACHIEVEMENT_TYPES.LEAVING_HOME);
  assert.ok(migration);
});

test('first survivor and ancient one use longevity thresholds', () => {
  const eco = baseEco({
    simulatedYear: THRESHOLDS.SURVIVOR_YEARS,
    species: [
      { id: 'meadow-grazer', name: 'Meadow Grazer', kind: 'herbivore', population: 400, bornYear: 0, parentId: null, habitat: 'grassland', traits: { size: 0.36, speed: 0.52, drought: 0.38, cold: 0.48 } }
    ]
  });
  attachHallOfHistory(eco);
  assert.ok(eco.hallOfHistory.achievements.some((a) => a.type === ACHIEVEMENT_TYPES.FIRST_SURVIVOR));

  eco.simulatedYear = THRESHOLDS.ANCIENT_YEARS;
  attachHallOfHistory(eco);
  assert.ok(eco.hallOfHistory.achievements.some((a) => a.type === ACHIEVEMENT_TYPES.ANCIENT_ONE));
});

test('important extinctions and dynasty ends are recorded without flooding minors', () => {
  const eco = baseEco({
    simulatedYear: 40,
    species: [
      { id: 'rivergrass', name: 'Rivergrass', kind: 'plant', population: 7000, bornYear: 0, parentId: null, habitat: 'riverbank', traits: { size: 0.2, speed: 0, drought: 0.4, cold: 0.5 } }
    ],
    extinct: [{
      id: 'meadow-grazer',
      name: 'Meadow Grazer',
      kind: 'herbivore',
      parentId: null,
      bornYear: 0,
      extinctYear: 40,
      lastHabitat: 'grassland',
      cause: 'ecological competition and population decline',
      finalTraits: { size: 0.36, speed: 0.52, drought: 0.38, cold: 0.48 }
    }]
  });
  // Seed lineage stats via a prior year so peak/longevity matter.
  eco.hallOfHistory = createEmptyHall();
  eco.hallOfHistory.rolling.speciesStats['meadow-grazer'] = {
    id: 'meadow-grazer', name: 'Meadow Grazer', kind: 'herbivore', originalHabitat: 'grassland',
    habitatsSeen: ['grassland', 'ridge'], peakPopulation: 900, bornYear: 0, baselineTraits: { size: 0.36, speed: 0.52, drought: 0.38, cold: 0.48 }, firstSeenYear: 0
  };
  eco.hallOfHistory.rolling.lineageStats['meadow-grazer'] = {
    rootId: 'meadow-grazer', rootName: 'Meadow Grazer', habitatsSeen: ['grassland', 'ridge'],
    peakPopulation: 900, speciesIds: ['meadow-grazer', 'meadow-grazer-branch-14'], bornYear: 0, extinctYear: null, alive: true
  };
  eco.hallOfHistory.rolling.lastProcessedYear = 39;
  attachHallOfHistory(eco);
  const dynasty = eco.hallOfHistory.events.find((e) => e.kind === 'dynasty_end');
  assert.ok(dynasty);
  assert.match(dynasty.title, /Dynasty/i);
  assert.equal(dynasty.inHall, true);
});

test('large extinction events are distinguished from normal turnover', () => {
  const eco = baseEco({
    simulatedYear: 50,
    species: [
      { id: 'survivor', name: 'Survivor Grazer', kind: 'herbivore', population: 200, bornYear: 0, parentId: null, habitat: 'grassland', traits: { size: 0.4, speed: 0.5, drought: 0.5, cold: 0.5 } }
    ],
    extinct: []
  });
  eco.hallOfHistory = createEmptyHall();
  for (let y = 0; y <= 50; y++) {
    eco.hallOfHistory.rolling.livingCountByYear[y] = y < 40 ? 8 : 3;
    eco.hallOfHistory.rolling.extinctionByYear[y] = 0;
  }
  // Normal trickle
  for (let y = 10; y < 38; y++) eco.hallOfHistory.rolling.extinctionByYear[y] = 0;
  // Sudden collapse in last 12 years
  for (let y = 39; y <= 50; y++) eco.hallOfHistory.rolling.extinctionByYear[y] = 1;
  eco.hallOfHistory.rolling.extinctionByYear[45] = 2;
  eco.extinct = Array.from({ length: 5 }, (_, i) => ({
    id: `lost-${i}`, name: `Lost ${i}`, kind: 'herbivore', bornYear: 0, extinctYear: 40 + i,
    lastHabitat: 'ridge', cause: 'prolonged drought pressure'
  }));
  eco.hallOfHistory.rolling.lastProcessedYear = 49;
  eco.hallOfHistory.rolling.climateHistory = [
    { year: 39, temperatureC: 13, rainfall: 0.6, fertility: 0.7 },
    { year: 45, temperatureC: 15.5, rainfall: 0.35, fertility: 0.5 }
  ];
  eco.climate = { temperatureC: 15.2, rainfall: 0.34, fertility: 0.48 };
  attachHallOfHistory(eco);
  const mass = eco.hallOfHistory.events.find((e) => e.kind === 'mass_extinction');
  assert.ok(mass);
  assert.match(mass.title, /Collapse|Dying|Great/i);
  assert.ok(eco.hallOfHistory.achievements.some((a) => a.type === ACHIEVEMENT_TYPES.GREAT_DYING));
  assert.match(mass.description, /coincid/i);
  assert.ok(Number(mass.stats.fraction) <= 1);

  // Normal turnover should not create another mass event immediately
  eco.simulatedYear = 51;
  eco.hallOfHistory.rolling.extinctionByYear[51] = 0;
  attachHallOfHistory(eco);
  assert.equal(eco.hallOfHistory.events.filter((e) => e.kind === 'mass_extinction').length, 1);
});

test('Ages begin only after meaningful sustained dominance and resist rapid flipping', () => {
  let eco = baseEco({
    simulatedYear: 0,
    species: [
      { id: 'alpha', name: 'Alpha Crawler', kind: 'herbivore', population: 800, bornYear: 0, parentId: null, habitat: 'grassland', traits: { size: 0.5, speed: 0.5, drought: 0.5, cold: 0.5 } },
      { id: 'beta', name: 'Beta Runner', kind: 'herbivore', population: 100, bornYear: 0, parentId: null, habitat: 'riverbank', traits: { size: 0.3, speed: 0.6, drought: 0.4, cold: 0.4 } }
    ]
  });

  for (let y = 1; y <= 5; y++) {
    eco.simulatedYear = y;
    eco.species[0].population = 800;
    eco.species[1].population = 100;
    attachHallOfHistory(eco);
  }
  const age = currentAgeView(eco.hallOfHistory);
  assert.ok(age, 'age should begin after sustained dominance');
  assert.match(age.name, /Age of/i);
  assert.ok(eco.hallOfHistory.events.some((e) => e.kind === 'age_begin'));

  // Small fluctuation should not end the age before min duration / exit streak
  for (let y = 6; y <= 10; y++) {
    eco.simulatedYear = y;
    eco.species[0].population = y % 2 ? 780 : 820;
    eco.species[1].population = y % 2 ? 120 : 90;
    attachHallOfHistory(eco);
  }
  assert.ok(currentAgeView(eco.hallOfHistory), 'age should survive small fluctuations');
  assert.equal(eco.hallOfHistory.events.filter((e) => e.kind === 'age_end').length, 0);

  // After min duration, sustained loss of dominance ends the age
  for (let y = 11; y <= 14; y++) {
    eco.simulatedYear = y;
    eco.species[0].population = 120;
    eco.species[1].population = 700;
    attachHallOfHistory(eco);
  }
  const alphaEnded = eco.hallOfHistory.ages.find((a) => a.dominantLineageId === 'alpha' && a.endDay != null);
  assert.ok(alphaEnded, 'former dominant age should end');
  assert.ok(eco.hallOfHistory.events.some((e) => e.kind === 'age_end'));
  // Cooldown prevents an immediate rival age from flipping the chronicle noisily.
  assert.equal(currentAgeView(eco.hallOfHistory), null);
  assert.equal(eco.hallOfHistory.events.filter((e) => e.kind === 'age_begin').length, 1);
});

test('duplicate daily processing does not duplicate events', () => {
  const eco = baseEco({ simulatedYear: 3 });
  attachHallOfHistory(eco);
  const snapshot = JSON.stringify(eco.hallOfHistory.events.map((e) => e.eventKey).sort());
  observeHallOfHistory(eco);
  observeHallOfHistory(eco);
  attachHallOfHistory(eco);
  assert.equal(JSON.stringify(eco.hallOfHistory.events.map((e) => e.eventKey).sort()), snapshot);
});

test('historical events persist across serialize/reload', () => {
  let state = runYears(12);
  const saved = JSON.parse(JSON.stringify(state));
  assert.ok(saved.hallOfHistory?.events?.length >= 1);
  const keys = saved.hallOfHistory.events.map((e) => e.eventKey);
  attachHallOfHistory(saved);
  assert.deepEqual(saved.hallOfHistory.events.map((e) => e.eventKey), keys);
});

test('lineage references remain valid for hall entries', () => {
  let state = runYears(21);
  const withLineage = (state.hallOfHistory.events || []).filter((e) => e.lineageId || e.speciesId);
  assert.ok(withLineage.length >= 1);
  for (const event of withLineage.slice(0, 10)) {
    const id = event.speciesId || event.lineageId;
    if (!id || id === 'world') continue;
    const detail = lineageDetail(state, id);
    assert.ok(detail.tree.rootId);
    assert.ok(detail.tree.nodes.some((n) => n.id === detail.tree.rootId || n.id === id));
  }
});

test('existing world advancement still works over many generations', () => {
  const state = runYears(30);
  assert.equal(state.simulatedYear, 30);
  assert.ok(Array.isArray(state.species));
  assert.ok(state.species.every((s) => Number(s.population) >= 0));
  assert.ok(state.hallOfHistory.rolling.lastProcessedYear === 30);
  const major = hallEventsForUi(state.hallOfHistory);
  assert.ok(Array.isArray(major));
  // Hunter should appear early in a normal run
  assert.ok(state.hallOfHistory.achievements.some((a) => a.type === ACHIEVEMENT_TYPES.THE_HUNTER));
});

test('since-last-visit summary reports events after a prior year', () => {
  const state = runYears(16);
  const summary = sinceLastVisitSummary(state.hallOfHistory, 3);
  assert.ok(summary);
  assert.ok(summary.count >= 1);
  assert.ok(summary.bullets.length >= 1);
});

test('living fossil requires both longevity and low trait drift', () => {
  const eco = baseEco({
    simulatedYear: THRESHOLDS.LIVING_FOSSIL_YEARS,
    species: [{
      id: 'stone-fern',
      name: 'Stone Fern',
      kind: 'plant',
      population: 5000,
      bornYear: 0,
      parentId: null,
      habitat: 'ridge',
      traits: { size: 0.3, speed: 0, drought: 0.55, cold: 0.55 }
    }]
  });
  eco.hallOfHistory = createEmptyHall();
  eco.hallOfHistory.rolling.lastProcessedYear = THRESHOLDS.LIVING_FOSSIL_YEARS - 1;
  eco.hallOfHistory.rolling.speciesStats['stone-fern'] = {
    id: 'stone-fern', name: 'Stone Fern', kind: 'plant', originalHabitat: 'ridge', habitatsSeen: ['ridge'],
    peakPopulation: 5000, bornYear: 0, baselineTraits: { size: 0.3, speed: 0, drought: 0.55, cold: 0.55 }, firstSeenYear: 0
  };
  attachHallOfHistory(eco);
  assert.ok(eco.hallOfHistory.achievements.some((a) => a.type === ACHIEVEMENT_TYPES.LIVING_FOSSIL));
});
