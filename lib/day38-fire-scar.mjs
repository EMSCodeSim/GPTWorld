// Day 38: the autonomous wildfire leaves a persistent visible scar near the completed watch.
export const DAY38=38;
export const DAY38_EVENT='day38_firebreak_wildfire_scar_recorded';
export const DAY38_ENTITIES=Object.freeze([
 Object.freeze({id:'day38-wildfire-scorch-line',type:'trail',label:'Fresh wildfire scorch edge',width:0.72,color:'#51443b',points:[[-46.2,10.8],[-45.3,11.6],[-44.7,12.4],[-44.1,13.1]],origin:DAY38_EVENT,history:'An autonomous wildfire reached the western watch approach during a prolonged autumn drought; the firebreak remains intact.'}),
 Object.freeze({id:'day38-ash-observation-stake',type:'object',label:'Ash observation stake',x:-44.8,z:12.6,width:0.42,depth:0.42,height:1.15,color:'#736455',origin:DAY38_EVENT,history:'The settlement marked the dryland edge of the active fire without claiming that patrols stopped it.'})
]);
