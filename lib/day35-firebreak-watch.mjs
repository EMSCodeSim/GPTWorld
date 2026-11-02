// Day 35: completed, player-built firebreak gains a visible watch route and voluntary patrol ledger.
// The board is a read-only projection of authoritative world state; patrols never grant materials.
export const DAY35=35;
export const DAY35_EVENT='day35_firebreak_first_watch';
export const DAY35_ENTITIES=Object.freeze([
  Object.freeze({id:'day35-firebreak-watch-spur',type:'trail',label:'Completed firebreak patrol spur',width:0.64,color:'#8b765c',points:[[-36.5,10.5],[-37.55,11.35],[-38.6,12.15]]}),
  Object.freeze({id:'day35-firebreak-watch-post',type:'object',label:'Firebreak patrol post',x:-38.6,z:12.15,width:0.4,depth:0.4,height:2.05,color:'#8e7b59',origin:DAY35_EVENT,history:'Travelers finished the Western Firebreak with 6 wood and 24 stone. The post marks a maintained lookout route; wildfire weather and disasters continue on their own clocks.'}),
  Object.freeze({id:'day35-firebreak-patrol-ledger',type:'object',label:'Western Firebreak patrol ledger',x:-37.9,z:12.7,width:1.2,depth:0.2,height:1.55,color:'#a48a60',origin:DAY35_EVENT,history:'The completed firebreak is now open to voluntary patrols. Record a patrol at the nearby staging panel; no supplies are created or spent.'})
]);
const bounded=(v,max=1)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0};
export function decorateDay35FirebreakWatch(entities,firebreak,watch,disaster,weather){
  if(!Array.isArray(entities))return [];
  const done=firebreak?.complete===true;
  const patrols=Math.floor(bounded(watch?.patrols,1000000));
  const risk=Math.round(bounded(disaster?.risks?.wildfire)*100);
  const drought=Math.round(bounded(weather?.drought)*100);
  const active=Array.isArray(disaster?.active)&&disaster.active.some(d=>d?.type==='wildfire');
  const last=String(watch?.lastInspector||'none yet').replace(/[<>]/g,'').slice(0,32);
  const riskLabel=active?'active wildfire':risk>=65?'high':risk>=35?'watch':'low';
  return entities.map(e=>{
    if(e?.id==='day35-firebreak-watch-post')return {...e,color:active?'#b34b3e':risk>=65?'#bb8449':'#8e7b59',label:`Firebreak patrol post · ${riskLabel}`,history:`Player-built Western Firebreak: ${done?'completed':'not yet complete'}. Live wildfire risk ${risk}/100; ${active?'an active fire is recorded':'no active fire is recorded'}. This watch post does not automatically stop fires.`};
    if(e?.id==='day35-firebreak-patrol-ledger')return {...e,label:`Firebreak patrol ledger · ${patrols} patrols`,history:`Western Firebreak: ${done?'6/6 wood and 24/24 stone, completed by travelers':'not yet complete'}. Recorded voluntary patrols: ${patrols}; most recent patrol by ${last}. Live wildfire risk: ${risk}/100 (${riskLabel}); drought: ${drought}/100. Patrols record visits but do not grant supplies, spend inventory, or advance the disaster clock.`};
    return e;
  });
}
