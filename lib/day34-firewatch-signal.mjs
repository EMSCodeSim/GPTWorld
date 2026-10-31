// Day 34: a visible firewatch signal reads current disaster risk and player-built firebreak progress.
// This is a read-only projection of authoritative state, not a new disaster clock or resource source.
export const DAY34=34;
export const DAY34_EVENT='day34_firewatch_signal_gauge';
export const DAY34_ENTITIES=Object.freeze([
  Object.freeze({id:'day34-firewatch-signal-path',type:'trail',label:'Firewatch signal approach',width:0.55,color:'#80715d',points:[[-27.4,14.15],[-26.45,13.35],[-25.2,12.65]]}),
  Object.freeze({id:'day34-firewatch-signal-post',type:'object',label:'Firewatch warning signal',x:-25.05,z:12.7,width:0.32,depth:0.32,height:2.5,color:'#b34b3e',origin:DAY34_EVENT,history:'A signal post was raised after repeated wildfires and critical timber pressure. Its warning color follows the live disaster simulation; it does not prevent or start fires.'}),
  Object.freeze({id:'day34-firewatch-readiness-board',type:'object',label:'Firewatch and firebreak readiness',x:-26.15,z:12.65,width:1.1,depth:0.2,height:1.5,color:'#a08a68',origin:DAY34_EVENT,history:'The firewatch crew tracks current wildfire risk and the player-funded Western Firebreak. The firebreak remains incomplete until travelers contribute their own wood and stone at its existing workbench.'})
]);
const bounded=(value,max=1)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;};
const whole=value=>Math.floor(bounded(value,100000));
export function decorateDay34Firewatch(entities,disaster,firebreak,weather,forest){
  if(!Array.isArray(entities))return [];
  const risk=bounded(disaster?.risks?.wildfire);
  const active=Array.isArray(disaster?.active)&&disaster.active.some(event=>event?.type==='wildfire');
  const stage=active?'active wildfire':risk>=0.65?'high':risk>=0.35?'watch':'low';
  const color=active||risk>=0.65?'#b34b3e':risk>=0.35?'#c58b42':'#6c9360';
  const woodGoal=whole(firebreak?.woodGoal??6),stoneGoal=whole(firebreak?.stoneGoal??24);
  const wood=Math.min(woodGoal,whole(firebreak?.wood)),stone=Math.min(stoneGoal,whole(firebreak?.stone));
  const done=firebreak?.complete===true;
  const progress=done?'complete':`${wood}/${woodGoal} wood, ${stone}/${stoneGoal} stone`;
  const drought=Math.round(bounded(weather?.drought)*100);
  const riskIndex=Math.round(risk*100);
  return entities.map(entity=>{
    if(entity?.id==='day34-firewatch-signal-post')return {
      ...entity,color,label:`Firewatch signal: ${stage}`,
      history:`Live wildfire risk index ${riskIndex}/100; ${active?'an active wildfire is recorded':'no active wildfire is currently recorded'}. The signal updates on world refresh and does not change the disaster simulation.`
    };
    if(entity?.id==='day34-firewatch-readiness-board')return {
      ...entity,
      label:`Firewatch: ${stage} · firebreak ${done?'complete':`${wood+stone}/${woodGoal+stoneGoal}`}`,
      history:`Current wildfire risk index: ${riskIndex}/100 (${stage}). Weather drought index: ${drought}/100. Forest pressure: ${String(forest?.stage||'unreported')}. Western Firebreak: ${progress}. Travelers must bring their own materials to the existing firebreak workbench; storehouse deposits do not fund this project. Risk, weather, regrowth, and disasters continue independently of the Chronicle day.`
    };
    return entity;
  });
}
