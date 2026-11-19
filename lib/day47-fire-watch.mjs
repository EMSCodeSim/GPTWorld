// Day 47: an autonomous wildfire triggers a durable watch line alongside the completed player-built firebreak.
export const DAY47=47;
export const DAY47_EVENT='day47_firebreak_watch_line_recorded';
export const DAY47_ENTITIES=Object.freeze([
 Object.freeze({id:'day47-firebreak-watch-line',type:'trail',label:'Wildfire watch line',width:0.42,color:'#94643f',points:[[-43.1,15.9],[-42.3,14.9],[-41.3,14.2]],origin:DAY47_EVENT,history:'An autonomous spring wildfire followed seven player patrols of the completed Western Firebreak; observers traced a lasting watch line. Weather and wildfire continue independently.'}),
 Object.freeze({id:'day47-fire-watch-post',type:'object',label:'Fire watch post',x:-41.3,z:14.2,width:0.3,depth:0.3,height:1.55,color:'#76543b',origin:DAY47_EVENT,history:'A lasting marker of the first documented wildfire watch near the player-built Western Firebreak.'})
]);
