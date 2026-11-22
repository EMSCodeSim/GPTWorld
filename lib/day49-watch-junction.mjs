// Day 49 joins the player-patrolled firebreak watch route to the ash recovery survey.
// A permanent sign makes the two existing routes legible in the playable shared world.
export const DAY49=49;
export const DAY49_EVENT='day49_watch_junction_recorded';
export const DAY49_ENTITIES=Object.freeze([
 Object.freeze({id:'day49-watch-junction-trail',type:'trail',label:'Watch and recovery junction',width:0.58,color:'#8c7454',points:[[-43.1,15.9],[-41.3,14.2],[-39.5,13.3]],origin:DAY49_EVENT,history:'Seven voluntary patrols established the firebreak watch; later wildfire recovery work now joins it to a marked route.'}),
 Object.freeze({id:'day49-watch-junction-sign',type:'object',label:'Watch / Recovery junction',x:-41.3,z:14.2,width:0.5,depth:0.3,height:1.6,color:'#a47b50',origin:DAY49_EVENT,history:'The settlement marks a lasting junction between the player-patrolled firebreak and the ash recovery survey.'})
]);
