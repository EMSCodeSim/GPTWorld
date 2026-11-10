// Day 41: the fourth voluntary firebreak patrol meets the first winter snow.
export const DAY41=41;
export const DAY41_EVENT='day41_winter_watch_recorded';
export const DAY41_ENTITIES=Object.freeze([
 Object.freeze({id:'day41-winter-watch-footprints',type:'trail',label:'Winter watch footprints',width:0.5,color:'#a9a8a0',points:[[-41.8,13.6],[-40.9,12.8],[-40.2,11.9],[-39.6,11.2]],origin:DAY41_EVENT,history:'The fourth traveler patrol crossed the firebreak circuit after winter snow, leaving a persistent visible route.'}),
 Object.freeze({id:'day41-frost-watch-stake',type:'object',label:'Fourth watch frost stake',x:-39.6,z:11.2,width:0.34,depth:0.34,height:1.05,color:'#a5b4b8',origin:DAY41_EVENT,history:'The fourth voluntary patrol marked the winter observation point; weather continues independently.'})
]);
