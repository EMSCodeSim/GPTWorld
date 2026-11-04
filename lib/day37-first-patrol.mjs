// Day 37: the first recorded patrol leaves a permanent physical record beside the dryland muster.
export const DAY37=37;
export const DAY37_EVENT='day37_first_firebreak_patrol_recorded';
export const DAY37_ENTITIES=Object.freeze([
  Object.freeze({id:'day37-first-patrol-marker',type:'object',label:'First patrol tally marker',x:-41.25,z:14.7,width:0.65,depth:0.35,height:1.25,color:'#a88b61',origin:DAY37_EVENT,history:'A traveler recorded the first voluntary patrol of the completed Western Firebreak on November 3. The watch has begun; patrols do not stop wildfires or grant materials.'}),
  Object.freeze({id:'day37-watch-footpath',type:'trail',label:'First walked watch loop',width:0.44,color:'#9b8060',points:[[-42.3,14.2],[-41.5,14.9],[-40.3,14.45],[-40.7,13.3]],origin:DAY37_EVENT})
]);
