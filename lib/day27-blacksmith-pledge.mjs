// Day 27: recent player-funded blacksmith contributions leave permanent visible evidence.
// The project remains unfinished; these marks do not grant currency, materials, or progress.
export const DAY27 = 27;
export const DAY27_EVENT = 'day27_blacksmith_pledge_yard';
export const DAY27_ENTITIES = Object.freeze([
  Object.freeze({
    id: 'day27-blacksmith-pledge-walk', type: 'trail', label: 'Blacksmith pledge walk',
    width: 0.52, color: '#776a53', points: [[14.2,4.9],[15.7,5.55],[17.1,5.8]]
  }),
  Object.freeze({
    id: 'day27-blacksmith-pledge-board', type: 'object', label: 'Blacksmith contributors board',
    origin: DAY27_EVENT, x: 17.1, z: 5.7, width: 1.05, depth: 0.22, height: 1.55,
    color: '#92724e',
    history: 'A traveler contributed stone, wood, and repeated coin pledges to the unfinished community blacksmith. The board honors actual contributions; check the town project for live remaining requirements.'
  }),
  Object.freeze({
    id: 'day27-blacksmith-pledge-coffer', type: 'object', label: 'Blacksmith pledge coffer',
    origin: DAY27_EVENT, x: 16.05, z: 6.45, width: 0.75, depth: 0.58, height: 0.68,
    color: '#756047',
    history: 'A sealed coffer marks the settlement\'s growing player-funded blacksmith campaign. It is scenery, not a withdrawable inventory or a source of free coins. Construction still requires the full verified project contribution ledger.'
  })
]);
