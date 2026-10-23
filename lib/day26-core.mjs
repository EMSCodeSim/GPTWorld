// Day 26: a modest winter herb-relay station near Edda's established garden.
// No free resources or automatic settlement-project completion are granted.
export const DAY26 = 26;
export const DAY26_EVENT = 'day26_edda_winter_herb_relay';
export const DAY26_ENTITIES = Object.freeze([
 Object.freeze({id:'day26-edda-relay-path',type:'trail',label:'Edda winter herb relay path',points:[[-12.6,-15],[-14.3,-15.1],[-15.4,-15.5]],width:0.48,color:'#84745b'}),
 Object.freeze({id:'day26-edda-ledger',type:'object',label:'Winter herb supply ledger',origin:'day26_edda_winter_herb_relay',history:'Herb gatherers exhausted a hardy nursery patch while the settlement herb reserve reached zero. The ledger marks the need for future player-supplied herbs; it does not create stock.',x:-14.4,z:-13.9,width:0.85,depth:0.2,height:1.35,color:'#9b805a'}),
 Object.freeze({id:'day26-edda-rack',type:'object',label:'Edda winter drying rack',origin:'day26_edda_winter_herb_relay',history:'A visible place to prepare future herb deliveries. Gathering, regrowth, and deposits still use existing authoritative game systems.',x:-15.4,z:-14.5,width:1,depth:0.45,height:1.15,color:'#775a3e'})
]);
