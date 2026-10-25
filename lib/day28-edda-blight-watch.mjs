// Day 28: recent garden blight and player herb harvesting leave a visible inspection site.
// Observation marks only: no free resources, altered crop timers, or project completion.
export const DAY28 = 28;
export const DAY28_EVENT = 'day28_edda_blight_watch';
export const DAY28_ENTITIES = Object.freeze([
  Object.freeze({
    id: 'day28-edda-blight-watch-path', type: 'trail', label: 'Blight watch inspection path',
    width: 0.48, color: '#786d55', points: [[-15.4,-15.5],[-16.3,-16.1],[-17.1,-16.9]]
  }),
  Object.freeze({
    id: 'day28-edda-blight-sample-bed', type: 'terrain', label: 'Weathered herb inspection bed',
    x: -17.35, z: -17.15, width: 1.35, depth: 0.9, height: 0.035, color: '#695d43',
    origin: DAY28_EVENT,
    history: 'A crop blight passed through the gardens during winter. Edda marked this bed for observation; it does not change live herb regeneration or the disease simulation.'
  }),
  Object.freeze({
    id: 'day28-edda-blight-watch-board', type: 'object', label: 'Edda blight watch board',
    x: -17.7, z: -16.1, width: 1.05, depth: 0.2, height: 1.45, color: '#8c7652',
    origin: DAY28_EVENT,
    history: 'A traveler harvested three herbs from Edda\'s garden after a crop disease event. The settlement herb stockpile is empty. Inspect the garden and help supply the settlement through existing gathering and deposit rules. The blight and crops evolve on their own clocks.'
  })
]);
