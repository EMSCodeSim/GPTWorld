// Day 42: rain following winter snow leaves a visible runoff trace beside the player-maintained firebreak.
export const DAY42=42;
export const DAY42_EVENT='day42_winter_runoff_recorded';
export const DAY42_ENTITIES=Object.freeze([
 Object.freeze({id:'day42-thaw-runoff-channel',type:'trail',label:'Winter rain runoff channel',width:0.36,color:'#647f8b',points:[[-39.6,11.2],[-38.9,10.7],[-38.1,9.9],[-37.5,9.1]],origin:DAY42_EVENT,history:'Rain after winter snow traced a narrow runoff channel beside the fourth watch frost stake, without erasing the patrol route.'}),
 Object.freeze({id:'day42-runoff-depth-post',type:'object',label:'Runoff observation post',x:-37.5,z:9.1,width:0.3,depth:0.3,height:0.9,color:'#7b8f92',origin:DAY42_EVENT,history:'The maintained firebreak watch circuit now has a fixed reference for changing winter runoff; weather still evolves independently.'})
]);
