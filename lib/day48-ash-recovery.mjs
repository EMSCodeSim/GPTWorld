// Day 48: the most recent wildfire leaves a durable recovery survey beside the player-built firebreak.
export const DAY48=48;
export const DAY48_EVENT='day48_ash_recovery_survey_recorded';
export const DAY48_ENTITIES=Object.freeze([
 Object.freeze({id:'day48-ash-recovery-path',type:'trail',label:'Ash recovery survey',width:0.38,color:'#655a4c',points:[[-41.3,14.2],[-40.3,13.7],[-39.5,13.3]],origin:DAY48_EVENT,history:'After wildfire 1579 faded, watchers marked a careful survey route beyond the player-built firebreak. The wildfire and ecosystem remain autonomous.'}),
 Object.freeze({id:'day48-ash-recovery-marker',type:'object',label:'Ash recovery marker',x:-39.5,z:13.3,width:0.32,depth:0.32,height:1.2,color:'#8a735a',origin:DAY48_EVENT,history:'A lasting marker records the post-fire recovery survey following seven voluntary firebreak patrols.'})
]);
