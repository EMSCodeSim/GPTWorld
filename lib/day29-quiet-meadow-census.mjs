// Day 29: the living ecosystem's two lost herbivores leave a permanent field record.
// Observation marks only. The ecosystem, gathering, and resource clocks stay autonomous.
export const DAY29 = 29;
export const DAY29_EVENT = 'day29_quiet_meadow_census';
export const DAY29_ENTITIES = Object.freeze([
  Object.freeze({
    id: 'day29-meadow-census-spur', type: 'trail', label: 'Quiet meadow census spur',
    width: 0.5, color: '#81775c', points: [[-36,-10],[-37.3,-12.1],[-38.4,-14.2],[-39.5,-15.7]]
  }),
  Object.freeze({
    id: 'day29-meadow-census-board', type: 'object', label: 'Quiet meadow field census',
    x: -39.5, z: -15.7, width: 1.25, depth: 0.22, height: 1.5, color: '#8a7855',
    origin: DAY29_EVENT,
    history: 'The living ecosystem reached simulated year 44. The Meadow Grazer disappeared from the grassland in year 24 and the Reed Runner from the riverbank in year 25 after ecological competition and population decline. Their absence is real: this census does not spawn replacements. The surviving plants and predators continue changing on their own clocks.'
  }),
  Object.freeze({
    id: 'day29-meadow-grazer-stone', type: 'object', label: 'Meadow Grazer remembrance stone',
    x: -38.7, z: -16.2, width: 0.65, depth: 0.55, height: 0.72, color: '#817f73',
    origin: DAY29_EVENT,
    history: 'Meadow Grazers once grazed this grassland. They disappeared in ecosystem year 24. The nearby ungrazed meadow and rewilding saplings now record their absence; future growth remains governed by the autonomous ecosystem.'
  }),
  Object.freeze({
    id: 'day29-reed-runner-marker', type: 'object', label: 'Reed Runner survey marker',
    x: -40.2, z: -14.6, width: 0.28, depth: 0.28, height: 1.35, color: '#716d54',
    origin: DAY29_EVENT,
    history: 'Reed Runners vanished from the riverbank in ecosystem year 25. This marker is a historical field note, not a new resource node or a claim that the species has returned.'
  })
]);
