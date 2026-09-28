/**
 * Shared gameplay balance helpers for GPTWorld.
 * Keeps gather/tool progression, project scaling, and milestone rewards coherent.
 */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

/** Tools that meaningfully change gathering. Values are yield per successful gather. */
export const GATHER_TOOL_BONUSES=Object.freeze({
  'hand-axe':Object.freeze({wood:2,label:'Hand Axe'}),
  'stone-hammer':Object.freeze({stone:2,label:'Stone Hammer'}),
  'forged-knife':Object.freeze({herbs:2,label:'Forged Knife'}),
  'smith-tool-set':Object.freeze({wood:1,stone:2,herbs:1,label:'Smith Tool Set'}),
  'masterwork-tools':Object.freeze({wood:2,stone:2,herbs:2,label:'Masterwork Tools'}),
  'skinning-knife':Object.freeze({herbs:1,huntLootBonus:1,label:'Skinning Knife'})
});

/** Placeables that should affect farm/hunt loops (not decoration-only). */
export const PLACEABLE_BONUSES=Object.freeze({
  'orchard-kit':Object.freeze({farmYieldBonus:1,label:'Orchard'}),
  'scarecrow-kit':Object.freeze({cropHealthDrainScale:0.5,label:'Scarecrow'}),
  'raised-bed-kit':Object.freeze({farmGrowthBonus:1.12,label:'Raised Bed'}),
  'irrigation-kit':Object.freeze({farmTierHint:3,label:'Irrigation'}),
  'hunter-blind':Object.freeze({stalkAlertScale:0.7,label:'Hunter Blind'}),
  'hide-rack':Object.freeze({huntLootBonus:1,label:'Hide Rack'})
});

export function bestGatherTool(toolKeys=[],resource='wood'){
  const key=String(resource||'wood');
  let best=null,bestYield=1;
  for(const toolKey of toolKeys||[]){
    const bonus=GATHER_TOOL_BONUSES[toolKey];
    if(!bonus)continue;
    const yieldFor=Number(bonus[key]||0);
    if(yieldFor>bestYield){
      bestYield=yieldFor;
      best={key:toolKey,label:bonus.label,yield:yieldFor};
    }
  }
  return best||{key:null,label:null,yield:1};
}

/**
 * Resolve how many units a gather should grant.
 * Caps against node remaining so tools never overdraw a node.
 */
export function gatherAmountFor({resource='wood',toolKeys=[],remaining=1,skillBonus=0}={}){
  const tool=bestGatherTool(toolKeys,resource);
  const skillExtra=Number(skillBonus)>0?1:0;
  const want=Math.max(1,Number(tool.yield||1)+skillExtra);
  const have=Math.max(0,Math.floor(Number(remaining)||0));
  const amount=Math.max(0,Math.min(want,have||want));
  return{
    amount:Math.max(1,amount||1),
    toolKey:tool.key,
    toolLabel:tool.label,
    boosted:Boolean(tool.key)&&tool.yield>1
  };
}

/** Soft community scaling — solo stays achievable; busy towns need a bit more. */
export function communityScaleFactor(activeContributors=1){
  const n=Math.max(1,Math.floor(Number(activeContributors)||1));
  return Number(clamp(1+0.18*(n-1),1,2.2).toFixed(3));
}

export function scaleProjectRequirements(required={},activeContributors=1){
  const factor=communityScaleFactor(activeContributors);
  const next={};
  for(const [key,need] of Object.entries(required||{})){
    next[key]=Math.max(1,Math.round(Number(need||0)*factor));
  }
  return next;
}

/** Concrete milestone rewards — never badge-only. */
export const MILESTONE_REWARDS=Object.freeze({
  first_shelter:Object.freeze({
    inventory:{wood:12,stone:4},
    message:'Shelter secured — spare timber and stone left by grateful neighbors.'
  }),
  self_sufficient:Object.freeze({
    inventory:{herbs:4},
    crafted:Object.freeze([{key:'seed-pouch',name:'Seed Pouch',quantity:2}]),
    message:'Self-sufficiency recognized — seed pouches for your next planting.'
  }),
  skilled_hunter:Object.freeze({
    crafted:Object.freeze([{key:'skinning-knife',name:'Skinning Knife',quantity:1}]),
    coins:12,
    message:'Skilled hunter — a field blade and trail coin for your efforts.'
  }),
  working_farm:Object.freeze({
    crafted:Object.freeze([{key:'seed-pouch',name:'Seed Pouch',quantity:3},{key:'garden-stakes',name:'Garden Stakes',quantity:1}]),
    message:'Working farm — stakes and fresh seed for the next beds.'
  }),
  craftsman:Object.freeze({
    inventory:{wood:10,stone:6},
    coins:18,
    message:'Craftsman — materials and coin to fuel the next build.'
  }),
  established_homestead:Object.freeze({
    coins:35,
    inventory:{wood:16,stone:8,herbs:4},
    message:'Established homestead — a settlement stipend and building stock.'
  }),
  town_contributor:Object.freeze({
    coins:25,
    message:'Town contributor — the council sends coin for your haul.'
  }),
  master_builder:Object.freeze({
    coins:50,
    inventory:{wood:20,stone:12},
    message:'Master builder — rare materials and a builder’s purse.'
  })
});

export function milestoneReward(key){
  return MILESTONE_REWARDS[String(key)]||null;
}

export function placeableFarmModifiers(placedKeys=[]){
  const set=new Set((placedKeys||[]).map(String));
  let farmYieldBonus=0,cropHealthDrainScale=1,farmGrowthBonus=1;
  if(set.has('orchard-kit'))farmYieldBonus+=PLACEABLE_BONUSES['orchard-kit'].farmYieldBonus;
  if(set.has('scarecrow-kit'))cropHealthDrainScale*=PLACEABLE_BONUSES['scarecrow-kit'].cropHealthDrainScale;
  if(set.has('raised-bed-kit'))farmGrowthBonus*=PLACEABLE_BONUSES['raised-bed-kit'].farmGrowthBonus;
  return{farmYieldBonus,cropHealthDrainScale,farmGrowthBonus};
}

export function placeableHuntModifiers(placedKeys=[],toolKeys=[]){
  const set=new Set([...(placedKeys||[]),...(toolKeys||[])].map(String));
  let stalkAlertScale=1,huntLootBonus=0;
  if(set.has('hunter-blind'))stalkAlertScale*=PLACEABLE_BONUSES['hunter-blind'].stalkAlertScale;
  if(set.has('hide-rack'))huntLootBonus+=PLACEABLE_BONUSES['hide-rack'].huntLootBonus;
  if(set.has('skinning-knife'))huntLootBonus+=GATHER_TOOL_BONUSES['skinning-knife'].huntLootBonus||0;
  return{stalkAlertScale,huntLootBonus};
}
