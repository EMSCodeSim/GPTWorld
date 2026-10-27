// Day 30: player deliveries create a visible sorting point beside the existing storehouse.
// Records completed deliveries, not an automatic transfer into unfinished projects.
export const DAY30 = 30;
export const DAY30_EVENT = 'day30_storehouse_relief_sorting';
export const DAY30_ENTITIES = Object.freeze([
  Object.freeze({
    id: 'day30-storehouse-delivery-apron', type: 'trail',
    label: 'Storehouse delivery apron', width: 0.62, color: '#8c7960',
    points: [[6.5,8.2],[7.35,8.6],[8.2,9.15]]
  }),
  Object.freeze({
    id: 'day30-storehouse-herb-sorting-rack', type: 'object',
    label: 'Herb relief sorting rack', x: 8.3, z: 9.5,
    width: 1.15, depth: 0.55, height: 1.1, color: '#947a54',
    origin: DAY30_EVENT,
    history: 'Travelers deposited six herbs into the shared storehouse after the meadow census. With crop disease and high herb demand, the settlement set aside a visible sorting space. The rack is a record of donated supplies, not a source of free herbs; live stockpile quantities still come from the shared ledger.'
  }),
  Object.freeze({
    id: 'day30-storehouse-stone-receipt-board', type: 'object',
    label: 'Storehouse delivery receipt board', x: 7.35, z: 10.35,
    width: 1.0, depth: 0.2, height: 1.45, color: '#a38a62',
    origin: DAY30_EVENT,
    history: 'Travelers also delivered six stone to the storehouse. The forest remains under critical harvesting pressure after another pine was depleted. Storehouse deposits do not automatically fund the unfinished Western Firebreak: travelers must contribute their own materials at its workbench. The weather, forest, and resource clocks keep running independently.'
  })
]);
