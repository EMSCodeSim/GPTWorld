// Day 36: a safe, permanent landward approach to the completed Western Firebreak.
// The river occupies x=-29..-19. These marks stay west of x=-38 on walkable ground.
export const DAY36=36;
export const DAY36_EVENT='day36_landward_firebreak_muster';
export const DAY36_ENTITIES=Object.freeze([
  Object.freeze({id:'day36-landward-watch-trail',type:'trail',label:'Landward firebreak watch trail',width:0.82,color:'#87735a',points:[[-36.1,11.8],[-38.6,12.15],[-40.7,13.3],[-42.3,14.2]],origin:DAY36_EVENT}),
  Object.freeze({id:'day36-landward-watch-clearing',type:'terrain',label:'Dryland watch clearing',x:-42.1,z:14.15,width:2.2,depth:1.8,color:'#7a7256',origin:DAY36_EVENT}),
  Object.freeze({id:'day36-landward-watch-sign',type:'object',label:'Landward firebreak muster sign',x:-42.35,z:14.35,width:0.75,depth:0.2,height:1.8,color:'#a1885b',origin:DAY36_EVENT,history:'Travelers completed the Western Firebreak. Its watch route was moved onto safe land, away from the river. The completed barrier and all supplies remain intact.'})
]);
export function decorateDay36LandwardWatch(entities,watch,disaster){
  if(!Array.isArray(entities))return [];
  const patrols=Math.max(0,Math.floor(Number(watch?.patrols)||0));
  const risk=Math.max(0,Math.min(100,Math.round((Number(disaster?.risks?.wildfire)||0)*100)));
  const active=Array.isArray(disaster?.active)&&disaster.active.some(e=>e?.type==='wildfire');
  const last=String(watch?.lastInspector||'no traveler yet').replace(/[<>]/g,'').slice(0,32);
  return entities.map(e=>{
    if(e?.id==='day36-landward-watch-trail')return {...e,width:Math.min(1.65,0.82+Math.min(patrols,12)*0.065),color:patrols>0?'#9a7d59':'#87735a',label:`Landward patrol trail · ${patrols} watches`};
    if(e?.id==='day36-landward-watch-sign')return {...e,color:active?'#b34b3e':risk>=65?'#c49a54':'#a1885b',history:`Player-built Western Firebreak remains complete. The dryland watch route has ${patrols} recorded patrols; last watch: ${last}. Live wildfire risk ${risk}/100${active?' with an active fire':''}. Weather and fires continue independently; patrols grant no supplies.`};
    return e;
  });
}
