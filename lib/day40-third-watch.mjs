// Day 40: a third player patrol closes the dryland watch circuit without spending inventory.
export const DAY40=40;
export const DAY40_EVENT='day40_third_watch_circuit_recorded';
export const DAY40_ENTITIES=Object.freeze([
 Object.freeze({id:'day40-third-watch-connector',type:'trail',label:'Third watch circuit connector',width:0.62,color:'#76644c',points:[[-42.8,15.4],[-41.9,14.7],[-41.5,13.7],[-41.7,12.8]],origin:DAY40_EVENT,history:'Three successful traveler patrols have worn a connecting circuit between the return path and the landward watch route.'}),
 Object.freeze({id:'day40-watch-junction-cairn',type:'object',label:'Third watch junction cairn',x:-41.8,z:13.6,width:0.55,depth:0.55,height:0.7,color:'#9b9486',origin:DAY40_EVENT,history:'A permanent junction cairn records the third voluntary patrol of the player-built Western Firebreak.'})
]);
