// Day 23's modest, permanent marks around the existing Western Firebreak.
// No resources or project progress are granted by placing these entities.
export const DAY23_ENTITIES = Object.freeze([
  {id:'day23-firewatch-cleared-pad',type:'terrain',x:-27.6,z:14.0,width:1.7,depth:1.1,height:.035,color:'#675e4b',label:'Firewatch assembly pad'},
  {id:'day23-firewatch-readiness-board',type:'object',x:-27.4,z:14.15,width:1.1,height:1.5,depth:.18,color:'#987b52',label:'Western firewatch readiness board',origin:'day23_firewatch',history:'After repeated wildfires and critical forest pressure, the settlement marked a safe observation point. Inspect the nearby firebreak workbench to contribute wood and stone; weather and wildfire risk continue to change independently.'},
  {id:'day23-firewatch-signal-pole',type:'object',x:-26.6,z:14.8,width:.16,height:2.35,depth:.16,color:'#a57743',label:'Firewatch signal pole',origin:'day23_firewatch',history:'A permanent signal point records the settlement response to dry conditions. It does not mean the firebreak is complete.'},
  {id:'day23-firewatch-access-trail',type:'trail',width:.62,color:'#7c6c52',label:'Firewatch staging path',points:[[-28.15,12.55],[-27.75,13.25],[-27.4,14.15]]}
]);
