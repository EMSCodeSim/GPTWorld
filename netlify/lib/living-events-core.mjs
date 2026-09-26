/**
 * Controlled living-world events driven by world conditions.
 * Deterministic game effects only — AI may later flavor text, never mutate state.
 */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const WORLD_EVENTS=Object.freeze([
  {
    key:'drought',
    name:'Drought',
    summary:'Dry skies thin the soil. Crop yields fall until rain returns.',
    durationHours:18,
    when:({weather,needs})=>/drought|clear/i.test(String(weather?.condition||''))&&Number(weather?.temperatureC||0)>28&&Number(needs?.score??50)<55,
    effects:Object.freeze({cropYieldMod:0.7,demandBias:{food:12,herbs:6},weatherHint:'drought'})
  },
  {
    key:'severe_storm',
    name:'Severe Storm',
    summary:'A hard storm batters the valley. Exposure rises and outdoor work slows.',
    durationHours:8,
    when:({weather})=>/storm|rain/i.test(String(weather?.condition||''))&&Number(weather?.windKph||0)>28,
    effects:Object.freeze({exposureRisk:0.35,gatherMod:0.85,demandBias:{construction:8,wood:6}})
  },
  {
    key:'merchant_caravan',
    name:'Merchant Caravan',
    summary:'A caravan arrives with unusual seeds and trail goods.',
    durationHours:12,
    when:({needs,hour})=>Number(needs?.score??50)>60&&hour>=9&&hour<=17,
    effects:Object.freeze({rareGoods:true,demandBias:{crafted:-6,tools:-4},merchantBudgetBonus:40})
  },
  {
    key:'predator_increase',
    name:'Predator Pressure',
    summary:'Predators press closer to settled land. Wildlife grows wary.',
    durationHours:16,
    when:({ecosystem})=>{
      const predators=(ecosystem?.species||[]).filter(s=>/predator/i.test(String(s.kind||'')));
      const total=predators.reduce((sum,s)=>sum+Number(s.population||0),0);
      return total>80;
    },
    effects:Object.freeze({huntDifficulty:0.12,wildlifeWary:true,demandBias:{food:8,clothing:5}})
  },
  {
    key:'crop_disease',
    name:'Crop Disease',
    summary:'A blight moves through garden plots. Crop health drains faster.',
    durationHours:14,
    when:({needs,weather})=>Number(needs?.score??50)<48&&/humid|rain|clear/i.test(String(weather?.condition||'clear')),
    effects:Object.freeze({cropHealthDrain:1.6,cropYieldMod:0.8,demandBias:{food:10,herbs:8}})
  },
  {
    key:'resource_shortage',
    name:'Resource Shortage',
    summary:'Town stores run thin. Merchants pay more for scarce goods.',
    durationHours:20,
    when:({stockpile,needs})=>Number(needs?.score??50)<40||(Number(stockpile?.wood||0)<20&&Number(stockpile?.stone||0)<12),
    effects:Object.freeze({demandBias:{wood:14,stone:12,construction:10,food:6}})
  },
  {
    key:'construction_boom',
    name:'Construction Boom',
    summary:'Scaffolding goes up across town. Lumber and stone are prized.',
    durationHours:24,
    when:({unlocks,needs})=>Number(needs?.score??50)>55&&!(unlocks||[]).includes('expanded_trading'),
    effects:Object.freeze({demandBias:{wood:16,stone:14,construction:18,tools:8}})
  },
  {
    key:'new_resident',
    name:'New Resident',
    summary:'A new neighbor arrives after recent town improvements.',
    durationHours:36,
    when:({unlocks,completedCount})=>Number(completedCount||0)>=1||(unlocks||[]).includes('tavern_npcs')||(unlocks||[]).includes('extra_merchants'),
    effects:Object.freeze({npcArrived:true,demandBias:{furniture:8,food:5,clothing:4}})
  }
]);

export function eventByKey(key){
  return WORLD_EVENTS.find(event=>event.key===String(key))||null;
}

export function pickActiveEvent(context={},now=Date.now()){
  const bucket=Math.floor(now/(6*3600*1000)); // ~6h event evaluation buckets
  const candidates=WORLD_EVENTS.filter(event=>{
    try{return Boolean(event.when(context));}catch{return false;}
  });
  if(!candidates.length)return null;
  const index=bucket%candidates.length;
  const event=candidates[index];
  return{
    key:event.key,
    name:event.name,
    summary:event.summary,
    effects:{...event.effects},
    startedAt:new Date(bucket*6*3600*1000).toISOString(),
    endsAt:new Date((bucket*6+event.durationHours)*3600*1000).toISOString(),
    bucket
  };
}

export function eventStillActive(state={},now=Date.now()){
  if(!state?.key||!state?.endsAt)return false;
  return new Date(state.endsAt).getTime()>now;
}

export function mergeEventDemandBias(demand={},event=null){
  if(!event?.effects?.demandBias)return demand;
  const next={...demand};
  for(const [key,delta] of Object.entries(event.effects.demandBias)){
    if(key in next||typeof next[key]==='number')next[key]=clamp(Number(next[key]||50)+Number(delta||0),5,100);
  }
  next.activeEvent=event.key;
  return next;
}

export function cropYieldModifier(event=null){
  const mod=Number(event?.effects?.cropYieldMod);
  return Number.isFinite(mod)?clamp(mod,0.4,1.2):1;
}

export function huntDifficultyBonus(event=null){
  return clamp(Number(event?.effects?.huntDifficulty||0),0,0.35);
}

export function gatherModifier(event=null){
  const mod=Number(event?.effects?.gatherMod);
  return Number.isFinite(mod)?clamp(mod,0.5,1.2):1;
}
