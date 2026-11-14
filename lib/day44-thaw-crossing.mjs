// Day 44: winter thaw leaves a durable safe crossing beside the player-worn watch circuit.
export const DAY44=44;
export const DAY44_EVENT='day44_thaw_crossing_recorded';
export const DAY44_ENTITIES=Object.freeze([
 Object.freeze({id:'day44-runoff-crossing',type:'trail',label:'Thaw crossing',width:0.62,color:'#87755c',points:[[-41.9,14.2],[-42.5,14.8],[-43.1,15.5],[-43.7,16.0]],origin:DAY44_EVENT,history:'Repeated player patrols wore a firm dryland passage around winter runoff; thaw revealed a reliable crossing.'}),
 Object.freeze({id:'day44-crossing-waystone',type:'object',label:'Thaw crossing waystone',x:-43.6,z:16.1,width:0.45,depth:0.45,height:0.85,color:'#a7a096',origin:DAY44_EVENT,history:'A permanent waystone records the patrol route beside the thawed runoff channel; no player inventory was spent.'})
]);
