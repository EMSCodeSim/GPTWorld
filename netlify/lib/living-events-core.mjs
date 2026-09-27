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

/**
 * Short player-facing event briefing: what happened, what changed, what to do.
 * Facts come from deterministic event effects — wording only.
 */
export function eventPlayerBrief(event=null){
  if(!event?.key)return null;
  const effects=event.effects||{};
  const changed=[];
  const actions=[];
  if(effects.cropYieldMod!=null&&Number(effects.cropYieldMod)<1){
    changed.push('Crops are producing less.');
    actions.push('Tend and fertilize plots, or trade food in town.');
  }
  if(effects.cropHealthDrain!=null&&Number(effects.cropHealthDrain)>1){
    changed.push('Crop health drains faster.');
    actions.push('Water and fertilize plots regularly.');
  }
  if(effects.demandBias){
    const hot=Object.entries(effects.demandBias)
      .filter(([,delta])=>Number(delta)>0)
      .sort((a,b)=>Number(b[1])-Number(a[1]))
      .slice(0,2)
      .map(([key])=>key);
    if(hot.length){
      changed.push(`${hot.map(k=>k.charAt(0).toUpperCase()+k.slice(1)).join(' & ')} demand is rising in town.`);
      actions.push(`Gather or craft ${hot[0]} and sell or contribute it.`);
    }
  }
  if(effects.huntDifficulty!=null&&Number(effects.huntDifficulty)>0){
    changed.push('Wildlife is more wary — hunting is harder.');
    actions.push('Track and stalk carefully before taking a shot.');
  }
  if(effects.wildlifeWary){
    if(!changed.some(line=>/wary/i.test(line)))changed.push('Animals flee more readily.');
    actions.push('Use quiet stalking near fresh tracks.');
  }
  if(effects.gatherMod!=null&&Number(effects.gatherMod)<1){
    changed.push('Outdoor gathering is slower.');
    actions.push('Shelter during the worst weather, then resume work.');
  }
  if(effects.rareGoods||effects.merchantBudgetBonus){
    changed.push('Merchants have temporary goods and extra coin.');
    actions.push('Visit town merchants while the caravan remains.');
  }
  if(effects.npcArrived){
    changed.push('A new neighbor has settled in.');
    actions.push('Talk to townsfolk — routines may have shifted.');
  }
  if(effects.exposureRisk){
    changed.push('Exposure risk is higher outdoors.');
    actions.push('Stay near shelter and keep a campfire ready.');
  }
  return{
    key:event.key,
    name:event.name||event.key,
    happened:event.summary||event.name||'Something changed in the valley.',
    changed:changed.slice(0,3),
    actions:actions.slice(0,2)
  };
}

/** Deterministic NPC line grounded in real world/project/event state. */
export function npcWorldAwareLine({npcName='',role='',project=null,demand={},event=null,needs=null}={}){
  const brief=eventPlayerBrief(event);
  const lines=[];
  if(project&&project.status!=='complete'){
    const remaining=project.remaining||{};
    const top=Object.entries(remaining).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
    if(top){
      const [resource,left]=top;
      lines.push(`We're still short on ${resource} for the ${String(project.name||'town project').replace(/^Build the |^Raise the |^Open the |^Expand the /i,'')}. ${left} more would help.`);
    }
  }
  if(project&&(project.status==='complete'||project.completed)){
    lines.push(`That new ${project.structure?.label||project.name||'structure'} has changed things around here.`);
  }
  if(brief){
    if(brief.key==='drought')lines.push('Farmers haven’t seen rain in days.');
    else if(brief.key==='resource_shortage'||brief.key==='construction_boom')lines.push(brief.changed[0]||brief.happened);
    else if(brief.key==='severe_storm')lines.push('That storm battered the valley — outdoor work slowed.');
    else lines.push(brief.happened);
  }
  const food=Number(demand?.food??50);
  if(food>=70)lines.push('Food prices keep climbing.');
  const wood=Number(demand?.wood??50);
  if(wood>=75&&!lines.some(l=>/wood|lumber/i.test(l)))lines.push('Town pays well for lumber right now.');
  if(needs&&(needs.status==='shortage'||needs.status==='strained')){
    lines.push(`Settlement stores look ${needs.status}.`);
  }
  if(!lines.length){
    if(/smith/i.test(role)||/Tovan/i.test(npcName))return 'The forge waits on steady hands and good timber.';
    if(/heal/i.test(role)||/Edda/i.test(npcName))return 'Bring herbs when you can — remedies never stay full for long.';
    return 'Travelers keep this place alive. What you bring matters.';
  }
  return lines[0];
}
