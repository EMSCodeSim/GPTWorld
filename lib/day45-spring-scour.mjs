// Day 45: sixth voluntary firebreak patrol discovers spring rain scouring the thaw crossing.
export const DAY45=45;
export const DAY45_EVENT='day45_spring_scour_survey_recorded';
export const DAY45_ENTITIES=Object.freeze([
 Object.freeze({id:'day45-spring-scour',type:'trail',label:'Spring scour trace',width:0.34,color:'#776c54',points:[[-43.7,16.0],[-44.1,16.45],[-44.55,16.8],[-45.0,17.05]],origin:DAY45_EVENT,history:'Spring rain after winter thaw exposed a shallow sediment scour beside the player-maintained runoff crossing; no player construction was removed.'}),
 Object.freeze({id:'day45-drainage-survey-stake',type:'object',label:'Drainage survey stake',x:-44.75,z:16.95,width:0.3,depth:0.3,height:0.95,color:'#9c8b64',origin:DAY45_EVENT,history:'A sixth voluntary patrol marked the newly visible spring drainage line beside the existing watch circuit without consuming player supplies.'})
]);
