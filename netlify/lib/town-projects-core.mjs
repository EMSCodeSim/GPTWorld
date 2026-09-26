/**
 * Data-driven Community Town Projects for GPTWorld.
 * Project definitions live here so new projects can be added without rewriting the API.
 */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

/** Materials accepted from player_inventory columns. */
export const INVENTORY_MATERIALS=Object.freeze(['wood','stone','herbs','coins']);

/** Crafted item keys that can be contributed as specialty materials. */
export const CRAFTED_MATERIALS=Object.freeze({
  iron:'iron-fittings',
  tools:'stone-hammer',
  furniture:'rough-stool',
  rations:'trail-rations'
});

/**
 * Community project catalog.
 * `required` keys may be inventory materials (wood/stone/herbs/coins) or
 * crafted aliases (iron/tools/furniture/rations) resolved via CRAFTED_MATERIALS.
 * `unlocks` become persistent town capabilities when the project completes.
 * `structure` describes the persistent public-world building that appears.
 */
export const TOWN_PROJECTS=Object.freeze([
  {
    key:'blacksmith',
    name:'Build the Blacksmith Forge',
    summary:'Raise a working forge so the settlement can repair and shape metal tools.',
    order:10,
    required:Object.freeze({wood:800,stone:300,iron:100,coins:2000}),
    unlocks:Object.freeze(['tool_repair','metal_tools','metal_crafting']),
    structure:Object.freeze({
      id:'community-blacksmith',
      label:'Community Blacksmith',
      building:'smithy',
      x:13.5,z:2.4,
      width:4.2,depth:4.2,
      wallColor:0x7a6450,roofColor:0x3f3228
    }),
    historyTitle:'The Blacksmith Forge was completed',
    historySummary:'Travelers raised a shared forge. Tool repair and metal work are now available in town.'
  },
  {
    key:'mill',
    name:'Build the Mill',
    summary:'A water-driven mill to grind grain into flour for the settlement.',
    order:20,
    required:Object.freeze({wood:500,stone:400,tools:20,coins:1200}),
    unlocks:Object.freeze(['grain_processing','flour_trade']),
    structure:Object.freeze({
      id:'community-mill',
      label:'Community Mill',
      building:'mill',
      x:-10.5,z:-2.2,
      width:4,depth:4,
      wallColor:0x8a7660,roofColor:0x4a3a2c
    }),
    historyTitle:'The Mill was completed',
    historySummary:'The settlement’s mill began turning. Grain can now be processed into flour.'
  },
  {
    key:'marketplace',
    name:'Open the Marketplace',
    summary:'Expand trading space so more merchants and demand can take root.',
    order:30,
    required:Object.freeze({wood:400,stone:200,furniture:30,coins:1500}),
    unlocks:Object.freeze(['extra_merchants','expanded_trading','demand_board']),
    structure:Object.freeze({
      id:'community-marketplace',
      label:'Marketplace',
      building:'marketplace',
      x:0.5,z:10.5,
      width:5.5,depth:4,
      wallColor:0x968468,roofColor:0x5a4432
    }),
    historyTitle:'The Marketplace opened',
    historySummary:'Stalls rose around the square. Trading capacity and merchant demand expanded.'
  },
  {
    key:'tavern',
    name:'Raise the Tavern',
    summary:'A gathering place for travelers, rumors, and future contracts.',
    order:40,
    required:Object.freeze({wood:450,stone:150,rations:80,coins:1000}),
    unlocks:Object.freeze(['tavern_npcs','rumors','contracts']),
    structure:Object.freeze({
      id:'community-tavern',
      label:'Settlement Tavern',
      building:'tavern',
      x:7.5,z:-10.5,
      width:5,depth:4.5,
      wallColor:0x8f7358,roofColor:0x4d3426
    }),
    historyTitle:'The Tavern opened its doors',
    historySummary:'A shared hearth and hall now host travelers, rumors, and evening talk.'
  },
  {
    key:'clinic',
    name:'Expand the Clinic',
    summary:'Grow the healer’s cottage into a clinic that can treat injuries and exposure.',
    order:50,
    required:Object.freeze({wood:300,stone:180,herbs:200,coins:900}),
    unlocks:Object.freeze(['treatment','injury_care','exposure_relief']),
    structure:Object.freeze({
      id:'community-clinic',
      label:'Settlement Clinic',
      building:'healer',
      x:-7.2,z:-9.5,
      width:4.2,depth:4.2,
      wallColor:0x8a7a5c,roofColor:0x554032
    }),
    historyTitle:'The Clinic was completed',
    historySummary:'Healers gained room and stores. Treatment for injuries and exposure is available.'
  },
  {
    key:'docks',
    name:'Build the River Docks',
    summary:'Mooring and trade docks open fishing and river commerce.',
    order:60,
    required:Object.freeze({wood:600,stone:250,iron:40,coins:1100}),
    unlocks:Object.freeze(['fishing','river_trade','dock_merchants']),
    structure:Object.freeze({
      id:'community-docks',
      label:'River Docks',
      building:'docks',
      x:-18,z:4,
      width:6,depth:3,
      wallColor:0x6d5742,roofColor:0x3d2f24
    }),
    historyTitle:'The River Docks were completed',
    historySummary:'Mooring posts and plank platforms reached the river. Fishing and river trade opened.'
  }
]);

export const DEFAULT_DEMAND=Object.freeze({
  wood:55,
  stone:45,
  herbs:40,
  food:50,
  tools:35,
  furniture:30,
  clothing:25,
  construction:40,
  crafted:35
});

export const DEMAND_CATEGORIES=Object.freeze({
  wood:['wood','wooden-beam','wooden-door','wooden-crate','fence-panel','cabin-frame','roof-truss'],
  stone:['stone','stone-foundation','stone-block','stone-wall-kit','stone-hearth','chimney-kit','arch-stone'],
  herbs:['herbs','healing-poultice','weather-tonic','antiseptic-salve','farm-herbs'],
  food:['wheat','carrot','potato','pumpkin','raw-meat','trail-rations','herb-broth','field-meal','preserved-rations','hearth-feast'],
  tools:['stone-hammer','forged-knife','hand-axe','smith-tool-set','iron-fittings','masterwork-tools','skinning-knife'],
  furniture:['rough-stool','reed-mat','workbench','masterwork-chest','decorated-rug','canvas-screen'],
  clothing:['hide','bedroll','padded-bedroll','woven-basket'],
  construction:['wooden-beam','stone-foundation','iron-fittings','shelter-frame','cabin-frame','roof-truss','stone-wall-kit'],
  crafted:['campfire-kit','basic-bow','reinforced-bow','composite-bow','hunting-trap','hide-rack']
});

export function projectByKey(key){
  return TOWN_PROJECTS.find(project=>project.key===String(key))||null;
}

export function materialKind(resource){
  const key=String(resource||'').toLowerCase();
  if(INVENTORY_MATERIALS.includes(key))return{kind:'inventory',key};
  if(CRAFTED_MATERIALS[key])return{kind:'crafted',key,itemKey:CRAFTED_MATERIALS[key]};
  if(Object.values(CRAFTED_MATERIALS).includes(key)){
    const alias=Object.entries(CRAFTED_MATERIALS).find(([,itemKey])=>itemKey===key)?.[0]||key;
    return{kind:'crafted',key:alias,itemKey:key};
  }
  return null;
}

export function normalizeContribution(resource,amount,{max=50}={}){
  const kind=materialKind(resource);
  if(!kind)return{ok:false,error:'invalid_resource'};
  const qty=Math.floor(Number(amount));
  if(!Number.isFinite(qty)||qty<1)return{ok:false,error:'invalid_amount'};
  return{ok:true,...kind,amount:Math.min(max,qty)};
}

export function progressPercent(required={},contributed={}){
  const keys=Object.keys(required||{});
  if(!keys.length)return 100;
  let totalNeed=0,totalHave=0;
  for(const key of keys){
    const need=Math.max(0,Number(required[key]||0));
    const have=clamp(Number(contributed[key]||0),0,need||Number(contributed[key]||0));
    totalNeed+=need;
    totalHave+=Math.min(have,need||have);
  }
  if(totalNeed<=0)return 100;
  return Number(clamp((totalHave/totalNeed)*100,0,100).toFixed(1));
}

export function remainingRequirements(required={},contributed={}){
  const remaining={};
  for(const [key,need] of Object.entries(required||{})){
    const left=Math.max(0,Number(need||0)-Number(contributed?.[key]||0));
    if(left>0)remaining[key]=left;
  }
  return remaining;
}

export function isProjectComplete(required={},contributed={}){
  return Object.keys(remainingRequirements(required,contributed)).length===0;
}

export function acceptContribution(required={},contributed={},resource,amount){
  const need=Math.max(0,Number(required[resource]||0));
  if(need<=0)return{ok:false,error:'resource_not_needed',accepted:0};
  const have=Math.max(0,Number(contributed[resource]||0));
  const room=Math.max(0,need-have);
  const accepted=Math.min(room,Math.max(0,Math.floor(Number(amount)||0)));
  if(accepted<=0)return{ok:false,error:'requirement_already_met',accepted:0};
  const next={...contributed,[resource]:have+accepted};
  return{ok:true,accepted,contributed:next,complete:isProjectComplete(required,next)};
}

export function projectView(project,row={},playerContribution={}){
  const required={...(project.required||{})};
  const contributed={...(row.contributed||{})};
  const remaining=remainingRequirements(required,contributed);
  const percent=progressPercent(required,contributed);
  const status=row.status||(percent>=100?'complete':'active');
  return{
    key:project.key,
    name:project.name,
    summary:project.summary,
    order:project.order,
    status,
    required,
    contributed,
    remaining,
    percent,
    unlocks:[...(project.unlocks||[])],
    structure:project.structure?{...project.structure}:null,
    playerContribution:{...playerContribution},
    playerTotal:Object.values(playerContribution).reduce((sum,n)=>sum+Number(n||0),0),
    completedAt:row.completed_at||row.completedAt||null
  };
}

export function activeProjectQueue(rowsByKey={}){
  const views=TOWN_PROJECTS.map(project=>projectView(project,rowsByKey[project.key]||{}));
  const active=views.find(view=>view.status!=='complete');
  const completed=views.filter(view=>view.status==='complete');
  return{active:active||null,completed,all:views};
}

export function unlockedCapabilities(rowsByKey={}){
  const unlocks=new Set();
  for(const project of TOWN_PROJECTS){
    const row=rowsByKey[project.key];
    if(row?.status==='complete'||isProjectComplete(project.required,row?.contributed||{})){
      for(const unlock of project.unlocks||[])unlocks.add(unlock);
    }
  }
  return[...unlocks];
}

export function completedStructures(rowsByKey={}){
  return TOWN_PROJECTS
    .filter(project=>{
      const row=rowsByKey[project.key];
      return row?.status==='complete'||isProjectComplete(project.required,row?.contributed||{});
    })
    .map(project=>({
      ...project.structure,
      projectKey:project.key,
      unlocks:[...project.unlocks]
    }));
}

/** Map an item/material key to the demand category that drives NPC prices. */
export function demandCategoryFor(itemKey){
  const key=String(itemKey||'');
  for(const [category,items] of Object.entries(DEMAND_CATEGORIES)){
    if(items.includes(key))return category;
  }
  return null;
}

/**
 * Demand multiplier for NPC purchase prices.
 * 50 = baseline (1.0). Higher demand pays more; lower demand pays less.
 */
export function demandPriceModifier(demandState={},itemKey=''){
  const category=demandCategoryFor(itemKey);
  if(!category)return 1;
  const level=clamp(demandState?.[category]??DEFAULT_DEMAND[category]??50,0,100);
  return Number(clamp(0.55+(level/100)*0.9,0.55,1.45).toFixed(3));
}

export function normalizeDemand(raw={}){
  const next={...DEFAULT_DEMAND,version:1};
  for(const key of Object.keys(DEFAULT_DEMAND)){
    next[key]=clamp(raw?.[key]??DEFAULT_DEMAND[key],0,100);
  }
  if(raw?.updatedAt)next.updatedAt=raw.updatedAt;
  if(raw?.lastTick!=null)next.lastTick=raw.lastTick;
  if(raw?.activeEvent)next.activeEvent=raw.activeEvent;
  return next;
}

/**
 * Adjust demand from settlement stockpile pressure and recent sales.
 * Short stockpile → higher construction/wood/stone demand.
 * Heavy sales of a category → temporarily lower that demand.
 */
export function tickDemand(prev={},{stockpile={},needs={},soldCategory=null,soldQty=0,eventBias=null}={}){
  const next=normalizeDemand(prev);
  const wood=Number(stockpile.wood||0),stone=Number(stockpile.stone||0),herbs=Number(stockpile.herbs||0);
  const score=Number(needs?.score??50);
  next.wood=clamp(next.wood+(wood<40?6:wood>120?-4:-1),5,100);
  next.stone=clamp(next.stone+(stone<25?6:stone>80?-4:-1),5,100);
  next.herbs=clamp(next.herbs+(herbs<20?5:herbs>60?-3:0),5,100);
  next.construction=clamp(next.construction+(score<40?8:score>75?-3:1),5,100);
  next.food=clamp(next.food+(score<45?5:0),5,100);
  next.tools=clamp(next.tools+1,5,100);
  next.furniture=clamp(next.furniture+(score>60?-1:2),5,100);
  next.crafted=clamp(next.crafted+1,5,100);
  if(soldCategory&&DEMAND_CATEGORIES[soldCategory]){
    next[soldCategory]=clamp(next[soldCategory]-Math.min(12,2+Number(soldQty||1)),5,100);
  }
  if(eventBias&&typeof eventBias==='object'){
    for(const [key,delta] of Object.entries(eventBias)){
      if(key in DEFAULT_DEMAND)next[key]=clamp(next[key]+Number(delta||0),5,100);
    }
  }
  next.updatedAt=new Date().toISOString();
  return next;
}

export function historyEntryFromProject(project,{gameDay=null,playerName=null}={}){
  return{
    eventKey:`project_complete:${project.key}`,
    title:project.historyTitle||`${project.name} completed`,
    summary:project.historySummary||`${project.name} is now part of the settlement.`,
    gameDay,
    payload:{
      projectKey:project.key,
      unlocks:[...project.unlocks],
      structure:project.structure||null,
      completedBy:playerName||null
    }
  };
}
