/**
 * GPTWorld progression: milestones, property tiers, structure upgrades,
 * field journal, discoveries, animal behavior, time/weather strategy,
 * specialization, cart transport, town identity/population, legacy,
 * returning-player summaries, and rare emergent moments.
 *
 * Pure rules only — no DB access. Additive and backward-compatible.
 */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function skillMap(skills=[]){
  const map=new Map();
  for(const skill of skills||[]){
    const key=skill.key||skill.skill_key;
    if(!key)continue;
    map.set(key,Number(skill.value??skill.skill_value??0));
  }
  return map;
}

function hasBuilding(buildings=[],matcher){
  return (buildings||[]).some(building=>{
    const key=String(building.key||building.building_key||'');
    const type=String(building.type||building.building_type||'');
    return matcher({key,type,level:Number(building.level||1),building});
  });
}

function placedKeys(placedItems=[]){
  return new Set((placedItems||[]).map(item=>String(item.key||item.item_key||'')));
}

function productivePlots(plots=[]){
  return (plots||[]).filter(plot=>{
    const stage=String(plot.stage||'');
    return Boolean(plot.cropKey||plot.crop_key)&&stage!=='dead'&&stage!=='prepared';
  });
}

/* ─── Phase 1: Homestead Milestones + Property Development ─── */

export const HOMESTEAD_MILESTONES=Object.freeze([
  {
    key:'first_shelter',
    name:'First Shelter',
    summary:'Construct your first permanent shelter.',
    check:({buildings,placed})=>hasBuilding(buildings,({key,type})=>key==='homestead'||type==='house')||placed.has('shelter-frame')
  },
  {
    key:'self_sufficient',
    name:'Self-Sufficient',
    summary:'Produce food, fuel, and basic tools on your own property.',
    check:({plots,placed,inventory})=>{
      const food=productivePlots(plots).length>0||Number(inventory?.herbs||0)>=3;
      const fuel=placed.has('campfire-kit')||Number(inventory?.wood||0)>=6;
      const tools=placed.has('stone-hammer')||placed.has('workbench')||placed.has('forged-knife');
      return food&&fuel&&tools;
    }
  },
  {
    key:'skilled_hunter',
    name:'Skilled Hunter',
    summary:'Reach Hunting 25 and successfully harvest several different animal types.',
    check:({skills,journal})=>{
      const hunting=skillMap(skills).get('hunting')||0;
      const hunted=new Set((journal?.animals||[]).filter(a=>a.successfullyHunted).map(a=>a.key||a.species));
      return hunting>=25&&hunted.size>=2;
    }
  },
  {
    key:'working_farm',
    name:'Working Farm',
    summary:'Maintain multiple productive crop plots.',
    check:({plots})=>productivePlots(plots).length>=2
  },
  {
    key:'craftsman',
    name:'Craftsman',
    summary:'Reach Carpentry 30 and create an advanced crafted item.',
    check:({skills,craftedKeys})=>{
      const carpentry=skillMap(skills).get('carpentry')||0;
      const advanced=new Set(['workbench','fence-panel','wooden-door','cabin-frame','masterwork-chest','storage-shed','improved-cabin','hand-cart']);
      return carpentry>=30&&[...craftedKeys||[]].some(key=>advanced.has(key));
    }
  },
  {
    key:'established_homestead',
    name:'Established Homestead',
    summary:'Own a shelter, storage, food production, and workshop.',
    check:({buildings,placed,plots})=>{
      const shelter=hasBuilding(buildings,({key,type})=>key==='homestead'||type==='house'||key==='shelter');
      const storage=placed.has('wooden-crate')||placed.has('storage-shed')||placed.has('masterwork-chest')||hasBuilding(buildings,({key})=>key==='storage');
      const food=productivePlots(plots).length>0;
      const workshop=placed.has('workbench')||hasBuilding(buildings,({key,type})=>key==='workshop'||type==='workshop');
      return shelter&&storage&&food&&workshop;
    }
  },
  {
    key:'town_contributor',
    name:'Town Contributor',
    summary:'Make meaningful contributions to several Community Projects.',
    check:({townContributions})=>Number(townContributions||0)>=3
  },
  {
    key:'master_builder',
    name:'Master Builder',
    summary:'Construct a major advanced structure.',
    check:({buildings,placed,skills})=>{
      const construction=skillMap(skills).get('construction')||0;
      const advanced=hasBuilding(buildings,({key,level,type})=>
        (key==='homestead'||type==='house')&&level>=3
      )||placed.has('improved-cabin')||placed.has('advanced-house')||construction>=80&&hasBuilding(buildings,({key})=>key==='homestead');
      return advanced;
    }
  }
]);

export function evaluateMilestones(context={}){
  const earned=new Set(context.earned||[]);
  const results=[];
  for(const milestone of HOMESTEAD_MILESTONES){
    const already=earned.has(milestone.key);
    const met=already||Boolean(milestone.check(context));
    results.push({
      key:milestone.key,
      name:milestone.name,
      summary:milestone.summary,
      complete:met,
      newlyEarned:!already&&met
    });
  }
  return results;
}

export function newlyEarnedMilestones(previousKeys=[],context={}){
  return evaluateMilestones({...context,earned:previousKeys}).filter(item=>item.newlyEarned);
}

export const PROPERTY_TIERS=Object.freeze([
  {
    key:'wilderness_camp',
    name:'Wilderness Camp',
    summary:'Basic fire, primitive storage, simple shelter.',
    minScore:0
  },
  {
    key:'homestead',
    name:'Homestead',
    summary:'Permanent shelter, crops, storage, workshop.',
    minScore:3
  },
  {
    key:'established',
    name:'Established Property',
    summary:'Multiple structures, specialized production, orchard/livestock-ready space.',
    minScore:5
  },
  {
    key:'developed_estate',
    name:'Developed Estate',
    summary:'Advanced workshop, large storage, permanent food systems, high-skill structures.',
    minScore:7
  }
]);

export function propertyChecklist({buildings=[],placedItems=[],plots=[],skills=[]}={}){
  const placed=placedKeys(placedItems);
  const skill=skillMap(skills);
  const shelter=hasBuilding(buildings,({key,type})=>key==='homestead'||type==='house'||key==='shelter')||placed.has('shelter-frame');
  const workshop=placed.has('workbench')||hasBuilding(buildings,({key,type})=>key==='workshop'||type==='workshop');
  const food=productivePlots(plots).length>0;
  const storage=placed.has('wooden-crate')||placed.has('storage-shed')||placed.has('masterwork-chest')||hasBuilding(buildings,({key})=>key==='storage');
  const advanced=hasBuilding(buildings,({level})=>level>=3)
    ||placed.has('improved-cabin')
    ||placed.has('advanced-house')
    ||placed.has('hand-cart')
    ||(skill.get('carpentry')||0)>=45
    ||(skill.get('construction')||0)>=80;
  const multipleStructures=(buildings||[]).filter(b=>String(b.status||'active')==='active').length
    +(placed.has('workbench')?1:0)+(placed.has('wooden-crate')?1:0)+(placed.has('campfire-kit')?1:0)>=3;
  const specialized=productivePlots(plots).length>=2||placed.has('irrigation-kit')||placed.has('raised-bed-kit')||placed.has('orchard-kit');
  return[
    {key:'shelter',label:'Permanent shelter',met:shelter},
    {key:'workshop',label:'Workshop',met:workshop},
    {key:'food',label:'Food production',met:food},
    {key:'storage',label:'Storage',met:storage},
    {key:'multiple',label:'Multiple structures',met:multipleStructures},
    {key:'specialized',label:'Specialized production',met:specialized},
    {key:'advanced',label:'Advanced structure',met:advanced}
  ];
}

export function propertyDevelopmentLevel(context={}){
  const checklist=propertyChecklist(context);
  const score=checklist.filter(item=>item.met).length;
  let tier=PROPERTY_TIERS[0];
  for(const candidate of PROPERTY_TIERS){
    if(score>=candidate.minScore)tier=candidate;
  }
  const next=PROPERTY_TIERS.find(item=>item.minScore>tier.minScore)||null;
  return{
    key:tier.key,
    name:tier.name,
    summary:tier.summary,
    score,
    checklist,
    nextHint:next
      ?checklist.filter(item=>!item.met).slice(0,2).map(item=>item.label+' needed').join(' · ')||next.summary
      :'Your property is fully developed for now.'
  };
}

/* ─── Phase 2: Structure Upgrades ─── */

export const STRUCTURE_UPGRADES=Object.freeze({
  shelter:Object.freeze([
    {tier:1,key:'lean-to',name:'Lean-to',benefits:Object.freeze(['basic weather cover','light rest']),minSkill:{carpentry:0},inputs:{wood:8,stone:2,herbs:0},visual:{width:5,depth:4,wallColor:0x7a6248}},
    {tier:2,key:'cabin',name:'Cabin',benefits:Object.freeze(['better weather protection','more storage','interior crafting']),minSkill:{carpentry:30,construction:40},inputs:{wood:28,stone:14,herbs:1},visual:{width:7,depth:6,wallColor:0x8f7354}},
    {tier:3,key:'improved-cabin',name:'Improved Cabin',benefits:Object.freeze(['strong weather protection','expanded storage','faster rest recovery']),minSkill:{carpentry:45,construction:60},inputs:{wood:40,stone:22,herbs:2},visual:{width:8,depth:7,wallColor:0x9a7d5c}}
  ]),
  storage:Object.freeze([
    {tier:1,key:'crate',name:'Crate',benefits:Object.freeze(['small capacity']),minSkill:{carpentry:10},inputs:{wood:8,stone:0,herbs:0},capacity:60},
    {tier:2,key:'storage-shed',name:'Storage Shed',benefits:Object.freeze(['moderate capacity','weatherproof']),minSkill:{carpentry:30},inputs:{wood:18,stone:6,herbs:0},capacity:160},
    {tier:3,key:'warehouse',name:'Warehouse',benefits:Object.freeze(['large capacity','bulk ready']),minSkill:{carpentry:55},inputs:{wood:32,stone:14,herbs:1},capacity:320}
  ]),
  workshop:Object.freeze([
    {tier:1,key:'work-bench',name:'Work Bench',benefits:Object.freeze(['basic crafting station']),minSkill:{carpentry:50},inputs:{wood:12,stone:2,herbs:0}},
    {tier:2,key:'carpentry-shop',name:'Carpentry Shop',benefits:Object.freeze(['improved craft odds','interior access']),minSkill:{carpentry:60},inputs:{wood:22,stone:8,herbs:1}},
    {tier:3,key:'master-workshop',name:'Master Workshop',benefits:Object.freeze(['masterwork chance bonus','advanced recipes']),minSkill:{carpentry:80},inputs:{wood:36,stone:16,herbs:2}}
  ]),
  farm:Object.freeze([
    {tier:1,key:'basic-plot',name:'Basic Plot',benefits:Object.freeze(['standard growth']),minSkill:{farming:0},soilBonus:0,moistureCap:100},
    {tier:2,key:'improved-soil',name:'Improved Soil',benefits:Object.freeze(['healthier crops','slightly faster growth']),minSkill:{farming:20},soilBonus:15,moistureCap:100},
    {tier:3,key:'irrigated-plot',name:'Irrigated Plot',benefits:Object.freeze(['moisture retention','dry-spell resilience']),minSkill:{farming:50},soilBonus:25,moistureCap:100,moistureDrainScale:0.55}
  ])
});

export function structureUpgradeDef(family,tier){
  const list=STRUCTURE_UPGRADES[family];
  if(!list)return null;
  return list.find(item=>item.tier===Number(tier))||null;
}

export function nextStructureUpgrade(family,currentTier=1){
  return structureUpgradeDef(family,Number(currentTier||1)+1);
}

export function canUpgradeStructure(family,currentTier=1,skills=[],inventory={}){
  const next=nextStructureUpgrade(family,currentTier);
  if(!next)return{ok:false,error:'max_tier',next:null};
  const map=skillMap(skills);
  for(const [skill,need] of Object.entries(next.minSkill||{})){
    if((map.get(skill)||0)<need)return{ok:false,error:'skill_locked',skill,need,current:map.get(skill)||0,next};
  }
  for(const [resource,amount] of Object.entries(next.inputs||{})){
    if(Number(inventory[resource]||0)<Number(amount||0))return{ok:false,error:'missing_materials',resource,need:amount,next};
  }
  return{ok:true,next};
}

export function farmTierModifiers(tier=1){
  const def=structureUpgradeDef('farm',tier)||STRUCTURE_UPGRADES.farm[0];
  return{
    soilBonus:Number(def.soilBonus||0),
    moistureDrainScale:Number(def.moistureDrainScale??1),
    growthBonus:def.tier>=2?1.08:1,
    name:def.name
  };
}

/* ─── Phase 2/10: Advanced Crafting Unlocks (catalog helpers) ─── */

export const ADVANCED_UNLOCKS=Object.freeze([
  {skill:'carpentry',level:30,key:'storage-shed',name:'Large Storage Shed',kind:'structure'},
  {skill:'carpentry',level:45,key:'improved-cabin',name:'Improved Cabin',kind:'structure'},
  {skill:'carpentry',level:60,key:'hand-cart',name:'Hand Cart',kind:'transport'},
  {skill:'carpentry',level:80,key:'advanced-house',name:'Advanced House',kind:'structure'},
  {skill:'hunting',level:30,key:'reinforced-bow',name:'Improved Bow',kind:'tool'},
  {skill:'hunting',level:50,key:'advanced-tracking',name:'Advanced Tracking',kind:'technique'},
  {skill:'farming',level:30,key:'orchard-kit',name:'Orchard',kind:'farm'},
  {skill:'farming',level:50,key:'irrigation-kit',name:'Irrigation',kind:'farm'}
]);

export function advancedUnlocksForSkills(skills=[]){
  const map=skillMap(skills);
  return ADVANCED_UNLOCKS.map(unlock=>({
    ...unlock,
    unlocked:(map.get(unlock.skill)||0)>=unlock.level,
    current:map.get(unlock.skill)||0
  }));
}

export function recentlyUnlockedAdvanced(skills=[],previousSkills=[]){
  const before=skillMap(previousSkills);
  const after=skillMap(skills);
  return ADVANCED_UNLOCKS.filter(unlock=>{
    const prior=before.get(unlock.skill)??0;
    const next=after.get(unlock.skill)??0;
    return prior<unlock.level&&next>=unlock.level;
  }).map(unlock=>({
    ...unlock,
    message:`${unlock.skill.replace(/^./,c=>c.toUpperCase())} ${unlock.level}: ${unlock.name} unlocked.`
  }));
}

/* ─── Phase 3: Field Journal + Rare Discoveries ─── */

export const DISCOVERY_TYPES=Object.freeze([
  {key:'abandoned_camp',name:'Abandoned Camp',summary:'A cold fire ring and scattered gear.',rarity:0.08,loot:Object.freeze({wood:2,herbs:1}),lore:'Someone left in a hurry seasons ago.',recipeHint:null},
  {key:'hunting_blind',name:'Old Hunting Blind',summary:'Weathered stakes and a brush screen.',rarity:0.07,loot:Object.freeze({wood:1,stone:0,herbs:0}),lore:'Hunters once watched the forest edge from here.',recipeHint:'hunter-blind'},
  {key:'supply_cache',name:'Forgotten Supply Cache',summary:'A half-buried crate of trail goods.',rarity:0.06,loot:Object.freeze({wood:3,stone:1,herbs:2}),lore:'Marked with an old settlement brand.',recipeHint:null},
  {key:'rare_plant',name:'Rare Plant Patch',summary:'Unusual herbs thriving in a sheltered hollow.',rarity:0.09,loot:Object.freeze({herbs:4}),lore:'These plants prefer damp shade.',recipeHint:'field-medicine-kit'},
  {key:'ruined_cabin',name:'Ruined Cabin',summary:'Collapsed walls and a stone hearth.',rarity:0.05,loot:Object.freeze({wood:4,stone:3}),lore:'The chimney stones still hold warmth in memory.',recipeHint:'stone-hearth'},
  {key:'animal_den',name:'Animal Den',summary:'Fresh bedding and tracks around a burrow.',rarity:0.08,loot:Object.freeze({herbs:1}),lore:'A family of small animals shelters here.',recipeHint:null},
  {key:'old_wagon',name:'Old Wagon',summary:'A broken wagon frame half-claimed by moss.',rarity:0.05,loot:Object.freeze({wood:5,stone:1}),lore:'Axles snapped on the north trail.',recipeHint:'hand-cart'},
  {key:'mineral_deposit',name:'Unusual Mineral Deposit',summary:'Glinting stone unlike the common ridge rock.',rarity:0.06,loot:Object.freeze({stone:5}),lore:'Useful for finer fittings and tools.',recipeHint:'iron-fittings'},
  {key:'trail_marker',name:'Old Trail Marker',summary:'A carved post pointing away from town.',rarity:0.1,loot:Object.freeze({}),lore:'North Trail — toward the old mining country.',recipeHint:null,regionalHint:'north_trail'},
  {key:'strange_landmark',name:'Strange Landmark',summary:'A standing stone with weathered notches.',rarity:0.04,loot:Object.freeze({stone:2,herbs:1}),lore:'Travelers carve days into the stone when they pass.',recipeHint:null}
]);

export function discoveryByKey(key){
  return DISCOVERY_TYPES.find(item=>item.key===String(key))||null;
}

export function deterministicUnit(seed){
  let hash=2166136261;
  for(const char of String(seed)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return(hash>>>0)/4294967296;
}

/** Place uncommon discoveries from world seed — sparse, not map-covered. */
export function generateDiscoveries(seed,count=5){
  const picks=[];
  const pool=[...DISCOVERY_TYPES];
  for(let i=0;i<count&&pool.length;i++){
    const roll=deterministicUnit(`${seed}:discovery:${i}`);
    const index=Math.floor(roll*pool.length)%pool.length;
    const type=pool.splice(index,1)[0];
    const angle=deterministicUnit(`${seed}:ang:${type.key}`)*Math.PI*2;
    const radius=16+deterministicUnit(`${seed}:rad:${type.key}`)*14;
    picks.push({
      id:`discovery-${type.key}`,
      key:type.key,
      name:type.name,
      summary:type.summary,
      lore:type.lore,
      recipeHint:type.recipeHint||null,
      regionalHint:type.regionalHint||null,
      loot:{...(type.loot||{})},
      x:Number((Math.cos(angle)*radius).toFixed(2)),
      z:Number((Math.sin(angle)*radius).toFixed(2)),
      found:false
    });
  }
  return picks;
}

export function resolveDiscoveryFind(discovery,existingJournal={}){
  if(!discovery||discovery.found)return{ok:false,error:'already_found'};
  const def=discoveryByKey(discovery.key)||discovery;
  const journal=normalizeFieldJournal(existingJournal);
  journal.rareDiscoveries=journal.rareDiscoveries||[];
  if(!journal.rareDiscoveries.some(item=>item.key===def.key)){
    journal.rareDiscoveries.push({
      key:def.key,
      name:def.name,
      summary:def.summary,
      lore:def.lore||null,
      foundAt:new Date().toISOString()
    });
  }
  if(def.lore){
    journal.locations=journal.locations||[];
    if(!journal.locations.some(item=>item.key===def.key)){
      journal.locations.push({key:def.key,name:def.name,note:def.lore,visited:1});
    }
  }
  if(def.recipeHint){
    journal.craftingKnowledge=journal.craftingKnowledge||[];
    if(!journal.craftingKnowledge.some(item=>item.key===def.recipeHint)){
      journal.craftingKnowledge.push({
        key:def.recipeHint,
        name:def.recipeHint,
        source:def.name,
        note:`Clue found at ${def.name}.`
      });
    }
  }
  return{
    ok:true,
    discovery:{...discovery,found:true,foundAt:new Date().toISOString()},
    loot:{...(def.loot||{})},
    journal,
    message:`Discovered: ${def.name}. ${def.summary}`
  };
}

export function emptyFieldJournal(){
  return{
    version:1,
    animals:[],
    plants:[],
    locations:[],
    weatherEvents:[],
    townHistory:[],
    rareDiscoveries:[],
    craftingKnowledge:[]
  };
}

export function normalizeFieldJournal(raw={}){
  const base=emptyFieldJournal();
  if(!raw||typeof raw!=='object')return base;
  for(const key of Object.keys(base)){
    if(key==='version'){base.version=Number(raw.version||1);continue;}
    base[key]=Array.isArray(raw[key])?raw[key].slice(-80):[];
  }
  return base;
}

export function recordAnimalObservation(journal,species,{tracks=false,hunted=false,behavior=null}={}){
  const next=normalizeFieldJournal(journal);
  const key=String(species||'wildlife');
  let entry=next.animals.find(item=>item.key===key);
  if(!entry){
    entry={key,name:prettyName(key),observed:0,tracksIdentified:false,successfullyHunted:false,knownBehavior:null};
    next.animals.push(entry);
  }
  entry.observed=Number(entry.observed||0)+1;
  if(tracks)entry.tracksIdentified=true;
  if(hunted)entry.successfullyHunted=true;
  if(behavior&&!entry.knownBehavior)entry.knownBehavior=behavior;
  return next;
}

export function recordPlantObservation(journal,plantKey,{note=null}={}){
  const next=normalizeFieldJournal(journal);
  const key=String(plantKey||'plant');
  let entry=next.plants.find(item=>item.key===key);
  if(!entry){
    entry={key,name:prettyName(key),observed:0,note:null};
    next.plants.push(entry);
  }
  entry.observed=Number(entry.observed||0)+1;
  if(note&&!entry.note)entry.note=note;
  return next;
}

export function recordWeatherEvent(journal,{condition,season,note}={}){
  const next=normalizeFieldJournal(journal);
  const key=`${String(condition||'weather')}:${String(season||'')}`;
  if(next.weatherEvents.some(item=>item.key===key))return next;
  next.weatherEvents.push({
    key,
    condition:String(condition||'unknown'),
    season:season||null,
    note:note||`Experienced ${condition} during ${season||'the season'}.`,
    at:new Date().toISOString()
  });
  return next;
}

function prettyName(value){
  return String(value||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

/* ─── Phase 4: Animal Behavior + Time of Day ─── */

export const ANIMAL_PROFILES=Object.freeze({
  'reed-runner':Object.freeze({
    name:'Reed Runner',
    kind:'herbivore',
    temperament:'skittish',
    habitats:Object.freeze(['forest_edge','riverbank']),
    fleeDistance:7.5,
    groupTendency:0.55,
    trackDifficulty:0.35,
    harvestValue:1,
    activePeriods:Object.freeze(['dawn','morning','evening']),
    behaviors:Object.freeze(['feeding','wandering','drinking','fleeing','group_movement'])
  }),
  'meadow-grazer':Object.freeze({
    name:'Meadow Grazer',
    kind:'herbivore',
    temperament:'wary',
    habitats:Object.freeze(['grassland','forest_edge']),
    fleeDistance:6.2,
    groupTendency:0.7,
    trackDifficulty:0.55,
    harvestValue:1.4,
    activePeriods:Object.freeze(['morning','midday','evening']),
    behaviors:Object.freeze(['feeding','wandering','resting','fleeing','group_movement'])
  }),
  rabbit:Object.freeze({
    name:'Rabbit',
    kind:'herbivore',
    temperament:'common',
    habitats:Object.freeze(['grassland','clearing']),
    fleeDistance:3.8,
    groupTendency:0.25,
    trackDifficulty:0.2,
    harvestValue:0.7,
    activePeriods:Object.freeze(['dawn','morning','evening','night']),
    behaviors:Object.freeze(['feeding','wandering','fleeing'])
  }),
  'ridge-stalker':Object.freeze({
    name:'Ridge Stalker',
    kind:'predator',
    temperament:'dangerous',
    habitats:Object.freeze(['ridge','forest']),
    fleeDistance:4.5,
    groupTendency:0.15,
    trackDifficulty:0.75,
    harvestValue:2,
    activePeriods:Object.freeze(['dusk','night','dawn']),
    behaviors:Object.freeze(['hunting','wandering','resting','following_prey']),
    followsPrey:true
  })
});

export function animalProfile(species){
  const key=String(species||'').toLowerCase();
  if(ANIMAL_PROFILES[key])return ANIMAL_PROFILES[key];
  if(/rabbit|hare/.test(key))return ANIMAL_PROFILES.rabbit;
  if(/deer|grazer|runner/.test(key))return ANIMAL_PROFILES['reed-runner'];
  if(/stalker|wolf|predator/.test(key))return ANIMAL_PROFILES['ridge-stalker'];
  return Object.freeze({
    name:prettyName(species||'Wildlife'),
    kind:'herbivore',
    temperament:'wary',
    habitats:Object.freeze(['clearing']),
    fleeDistance:5.5,
    groupTendency:0.4,
    trackDifficulty:0.4,
    harvestValue:1,
    activePeriods:Object.freeze(['morning','evening']),
    behaviors:Object.freeze(['wandering','feeding','fleeing'])
  });
}

export function timeOfDayPeriod(hour=12){
  const h=((Number(hour)%24)+24)%24;
  if(h<5)return'night';
  if(h<8)return'dawn';
  if(h<11)return'morning';
  if(h<16)return'midday';
  if(h<19)return'evening';
  if(h<21)return'dusk';
  return'night';
}

export function timeOfDayEffects(hour=12){
  const period=timeOfDayPeriod(hour);
  const effects={
    period,
    animalActivity:1,
    trackingBonus:0,
    visibility:1,
    townActivity:0.7,
    businessesOpen:true,
    nightAnimals:false,
    note:''
  };
  if(period==='dawn'||period==='morning'){
    effects.animalActivity=1.25;
    effects.trackingBonus=0.12;
    effects.note='Animals are active near cover. Tracks read clearly.';
  }else if(period==='midday'){
    effects.townActivity=1;
    effects.animalActivity=0.85;
    effects.note='Town activity is highest. Wildlife rests in shade.';
  }else if(period==='evening'||period==='dusk'){
    effects.animalActivity=1.15;
    effects.trackingBonus=0.05;
    effects.note='Animals return to feeding areas.';
  }else if(period==='night'){
    effects.visibility=0.62;
    effects.townActivity=0.35;
    effects.businessesOpen=false;
    effects.nightAnimals=true;
    effects.animalActivity=0.9;
    effects.note='Visibility drops. Night animals appear. Town businesses quiet down.';
  }
  return effects;
}

export function animalActiveNow(species,hour=12){
  const profile=animalProfile(species);
  const period=timeOfDayPeriod(hour);
  if((profile.activePeriods||[]).includes(period))return true;
  if(period==='night'&&profile.kind==='predator')return true;
  return false;
}

export function animalBehaviorState(species,{hour=12,noise=0.2,nearWater=false,energy=0.7}={}){
  const profile=animalProfile(species);
  const period=timeOfDayPeriod(hour);
  if(noise>0.55)return{behavior:'fleeing',fleeDistance:profile.fleeDistance*(profile.temperament==='skittish'?1.25:1)};
  if(nearWater&&(profile.behaviors||[]).includes('drinking'))return{behavior:'drinking',fleeDistance:profile.fleeDistance};
  if(energy<0.3)return{behavior:'resting',fleeDistance:profile.fleeDistance*0.8};
  if(period==='dawn'||period==='evening')return{behavior:'feeding',fleeDistance:profile.fleeDistance};
  if(profile.followsPrey&&(period==='night'||period==='dusk'))return{behavior:'following_prey',fleeDistance:profile.fleeDistance};
  if(profile.groupTendency>0.5)return{behavior:'group_movement',fleeDistance:profile.fleeDistance};
  return{behavior:'wandering',fleeDistance:profile.fleeDistance};
}

export function loudPlayerFleeBonus(noise=0){
  return clamp(Number(noise||0)*2.2,0,3.5);
}

/* ─── Phase 5: Weather / Season strategy ─── */

export function weatherStrategy(weather='clear',temperature=18){
  const w=String(weather||'clear').toLowerCase();
  const effects={
    condition:w,
    cropGrowth:1,
    trackBonus:0,
    firewoodEfficiency:1,
    tracksWashAway:false,
    foodConsumption:1,
    shelterValue:1,
    repairDemand:0,
    fireDanger:0.15,
    travelSpeed:1,
    note:''
  };
  if(w.includes('heavy rain')||w.includes('storm')){
    effects.cropGrowth=1.15;
    effects.trackBonus=0.08;
    effects.firewoodEfficiency=0.65;
    effects.tracksWashAway=true;
    effects.repairDemand=w.includes('storm')?0.2:0.1;
    effects.shelterValue=1.25;
    effects.note=w.includes('storm')
      ?'Storm: shelter matters; town needs repair materials.'
      :'Heavy rain helps crops but washes older tracks away.';
  }else if(w.includes('rain')){
    effects.cropGrowth=1.2;
    effects.trackBonus=0.15;
    effects.firewoodEfficiency=0.8;
    effects.note='Rain benefits crops and briefly clarifies tracks.';
  }else if(w.includes('snow')){
    effects.cropGrowth=0.4;
    effects.trackBonus=0.28;
    effects.travelSpeed=0.82;
    effects.foodConsumption=1.12;
    effects.shelterValue=1.35;
    effects.note='Snow makes tracking easier and travel slower.';
  }else if(w.includes('drought')||(w.includes('clear')&&Number(temperature)>30)){
    effects.cropGrowth=0.55;
    effects.fireDanger=0.55;
    effects.note='Dry period: crops need attention; fire danger rises.';
  }
  if(Number(temperature)<4){
    effects.foodConsumption=Math.max(effects.foodConsumption,1.1);
    effects.shelterValue=Math.max(effects.shelterValue,1.2);
    if(!effects.note)effects.note='Cold: food use rises slightly; shelter is valuable.';
  }
  return effects;
}

export const SEASON_EFFECTS=Object.freeze({
  Spring:Object.freeze({plantingBonus:1.15,rainLikely:true,cropGrowth:1.1,wildlife:1.05,note:'Planting advantages and frequent rain.'}),
  Summer:Object.freeze({plantingBonus:1,rainLikely:false,cropGrowth:1.2,wildlife:0.95,drySpellRisk:true,note:'Faster crop growth; watch for dry spells.'}),
  Autumn:Object.freeze({plantingBonus:0.9,rainLikely:false,cropGrowth:1.05,wildlife:1.2,harvestBonus:1.15,note:'Harvest bonuses and lively wildlife.'}),
  Winter:Object.freeze({plantingBonus:0.45,rainLikely:false,cropGrowth:0.5,wildlife:0.85,trackingBonus:0.2,shelterValue:1.4,note:'Harder farming, easier tracking, greater shelter importance.'})
});

export function seasonStrategy(season='Spring'){
  const key=String(season||'Spring').replace(/^./,c=>c.toUpperCase());
  return SEASON_EFFECTS[key]||SEASON_EFFECTS.Spring;
}

/* ─── Phase 6: Cart / Bulk Transport ─── */

export const TRANSPORT_TIERS=Object.freeze([
  {key:'backpack',name:'Backpack',capacity:40,speedMod:1,minSkill:0},
  {key:'hand-cart',name:'Hand Cart',capacity:140,speedMod:0.88,minSkill:60,recipeKey:'hand-cart'},
  {key:'wagon',name:'Wagon',capacity:320,speedMod:0.78,minSkill:90,future:true}
]);

export function transportForPlayer({hasCart=false,cartLoad=0,skills=[]}={}){
  const carpentry=skillMap(skills).get('carpentry')||0;
  const tier=hasCart&&carpentry>=60
    ?TRANSPORT_TIERS.find(item=>item.key==='hand-cart')
    :TRANSPORT_TIERS[0];
  const load=clamp(cartLoad,0,tier.capacity);
  const loadRatio=load/Math.max(1,tier.capacity);
  const speedMod=tier.key==='backpack'?1:Number(clamp(tier.speedMod+(1-tier.speedMod)*(1-loadRatio),tier.speedMod,1).toFixed(3));
  return{
    key:tier.key,
    name:tier.name,
    capacity:tier.capacity,
    load,
    remaining:Math.max(0,tier.capacity-load),
    speedMod,
    heavilyLoaded:loadRatio>=0.65
  };
}

export function cartLoadSpeed(load=0,capacity=140){
  const ratio=clamp(load/Math.max(1,capacity),0,1);
  return Number(clamp(0.88+(1-0.88)*(1-ratio),0.75,1).toFixed(3));
}

/* ─── Phase 9: Player specialization (descriptive) ─── */

export const SPECIALIZATION_LABELS=Object.freeze([
  {key:'master_carpenter',label:'Master Carpenter',skill:'carpentry',min:40},
  {key:'experienced_hunter',label:'Experienced Hunter',skill:'hunting',min:30},
  {key:'skilled_farmer',label:'Skilled Farmer',skill:'farming',min:30},
  {key:'trader',label:'Trader',skill:'coins',min:80,fromInventory:true},
  {key:'explorer',label:'Explorer',skill:'discoveries',min:3,fromDiscoveries:true},
  {key:'builder',label:'Builder',skill:'construction',min:40}
]);

export function playerSpecialization({skills=[],inventory={},discoveryCount=0,milestonesComplete=0}={}){
  const map=skillMap(skills);
  const ranked=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([key,value])=>({key,name:prettyName(key),value:Number(value.toFixed?value.toFixed(1):value)}));
  const knownFor=[];
  for(const spec of SPECIALIZATION_LABELS){
    if(spec.fromInventory&&Number(inventory.coins||0)>=spec.min)knownFor.push(spec.label);
    else if(spec.fromDiscoveries&&discoveryCount>=spec.min)knownFor.push(spec.label);
    else if(!spec.fromInventory&&!spec.fromDiscoveries&&(map.get(spec.skill)||0)>=spec.min)knownFor.push(spec.label);
  }
  if(!knownFor.length&&milestonesComplete>=1)knownFor.push('Settler');
  return{
    strongestSkills:ranked,
    knownFor:knownFor.slice(0,2),
    primary:knownFor[0]||(ranked[0]?prettyName(ranked[0].key):'Traveler')
  };
}

/* ─── Phase 12: Resource quality (crafted/food focus) ─── */

export const QUALITY_TIERS=Object.freeze(['poor','standard','fine','exceptional']);

export function resolveItemQuality({skill=0,difficulty=0,materialBonus=0,key=''}={}){
  const mastery=clamp((Number(skill)-Number(difficulty)+20)/120,0,1);
  const roll=deterministicUnit(`${key}:quality:${skill}:${difficulty}`);
  const score=roll+mastery*0.35+clamp(materialBonus,0,0.2);
  if(score<0.12)return'poor';
  if(score<0.55)return'standard';
  if(score<0.85)return'fine';
  return'exceptional';
}

export function foodQualityPriceMod(quality='standard'){
  return{poor:0.7,standard:1,fine:1.25,exceptional:1.55}[String(quality)]||1;
}

/* ─── Phase 13–15: NPC familiarity, town identity, population ─── */

export function familiarityTier(familiarity=0,helpfulActs=0){
  const score=Number(familiarity||0)+Number(helpfulActs||0)*4;
  if(score>=55)return{key:'trusted',label:'Trusted neighbor'};
  if(score>=18)return{key:'familiar',label:'Familiar face'};
  return{key:'stranger',label:'Passing traveler'};
}

export function npcFamiliarityLine({npcName='',role='',traveler='',familiarity=0,helpfulActs=0,recentActs=[]}={}){
  const tier=familiarityTier(familiarity,helpfulActs);
  const acts=new Set(recentActs||[]);
  if(acts.has('lumber')||acts.has('wood'))return`You've been keeping us supplied with lumber lately, ${traveler||'friend'}.`;
  if(acts.has('town_project')||acts.has('contribution'))return`${traveler||'Traveler'}, your work on the town projects hasn't gone unnoticed.`;
  if(acts.has('food')||acts.has('hunt'))return`Skilled local hunter — the kitchens remember your deliveries.`;
  if(acts.has('herbs')&&(/heal/i.test(role)||/Edda/i.test(npcName)))return`Those herb bundles you bring make a real difference.`;
  if(tier.key==='trusted')return`Good to see you again, ${traveler||'neighbor'}. You've become part of this place.`;
  if(tier.key==='familiar')return`Back again? The settlement is better for regular hands like yours.`;
  return null;
}

export const TOWN_IDENTITIES=Object.freeze([
  {key:'frontier_settlement',name:'Frontier Settlement',requires:Object.freeze([]),minCompleted:0},
  {key:'trade_village',name:'Trade Village',requires:Object.freeze(['marketplace','blacksmith']),minCompleted:2},
  {key:'agricultural_center',name:'Agricultural Center',requires:Object.freeze(['mill','marketplace']),minCompleted:2},
  {key:'river_hub',name:'River Hub',requires:Object.freeze(['docks','marketplace']),minCompleted:2},
  {key:'growing_town',name:'Growing Town',requires:Object.freeze(['blacksmith','mill','marketplace']),minCompleted:3}
]);

export function townIdentityFromProjects(completedKeys=[]){
  const done=new Set((completedKeys||[]).map(String));
  let identity=TOWN_IDENTITIES[0];
  for(const candidate of TOWN_IDENTITIES){
    const ok=candidate.requires.every(key=>done.has(key))&&done.size>=candidate.minCompleted;
    if(ok)identity=candidate;
  }
  return{
    key:identity.key,
    name:identity.name,
    completed:[...done],
    explanation:done.size
      ?`Identity shaped by: ${[...done].map(prettyName).join(', ')}`
      :'A young frontier settlement still finding its shape.'
  };
}

export const TOWN_ARRIVALS=Object.freeze([
  {projectKey:'marketplace',npcKey:'Lira the Merchant',role:'Merchant',value:'Buys and sells trade goods.',routine:Object.freeze({day:['Marketplace',0.5,10.5,'trading at the stalls'],night:['Wayfarer Inn',2,-4,'resting after market day']})},
  {projectKey:'clinic',npcKey:'Bram the Healer',role:'Healer',value:'Treats injuries and prepares remedies.',routine:Object.freeze({day:['Settlement Clinic',-7.2,-9.5,'tending patients'],night:['healer’s cottage',-4,-4,'resting']})},
  {projectKey:'mill',npcKey:'Osa the Miller',role:'Miller',value:'Processes grain and tracks food stores.',routine:Object.freeze({day:['Community Mill',-10.5,-2.2,'milling grain'],night:['Wayfarer Inn',2,-4,'sharing news over supper']})},
  {projectKey:'tavern',npcKey:'Perrin the Host',role:'Host',value:'Shares rumors and keeps evening company.',routine:Object.freeze({day:['Settlement Tavern',7.5,-10.5,'welcoming travelers'],night:['Settlement Tavern',7.5,-10.5,'keeping the hearth']})},
  {foodSecurity:true,npcKey:'The Calder Family',role:'Settlers',value:'New hands for fields and small chores.',routine:Object.freeze({day:['herb plots',-10,13,'working the edge fields'],night:['Wayfarer Inn',2,-4,'settling in for the night']})}
]);

export function pendingTownArrivals({completedProjects=[],existingNpcs=[],foodSecure=false}={}){
  const have=new Set((existingNpcs||[]).map(String));
  const done=new Set((completedProjects||[]).map(String));
  const arrivals=[];
  for(const arrival of TOWN_ARRIVALS){
    if(have.has(arrival.npcKey))continue;
    if(arrival.projectKey&&done.has(arrival.projectKey))arrivals.push(arrival);
    else if(arrival.foodSecurity&&foodSecure&&done.size>=1)arrivals.push(arrival);
  }
  return arrivals.slice(0,2);
}

/* ─── Phase 16: Regional exploration hooks ─── */

export const REGIONAL_HOOKS=Object.freeze([
  {key:'north_trail',name:'North Trail',summary:'Leads toward the old mining country.',x:2,z:-28,status:'visible'},
  {key:'mountain_pass',name:'Mountain Pass',summary:'A high notch beyond the ridge — not yet open.',x:26,z:-18,status:'locked'},
  {key:'river_trail',name:'River Trail',summary:'Follows the water toward distant wetlands.',x:-24,z:12,status:'visible'},
  {key:'abandoned_signpost',name:'Abandoned Signpost',summary:'Weathered wood points to roads no map names.',x:18,z:22,status:'visible'},
  {key:'unfinished_bridge',name:'Locked Bridge Span',summary:'Timbers wait for a future crossing east.',x:28,z:4,status:'unfinished'}
]);

export function regionalHooksView(foundHints=[]){
  const found=new Set(foundHints||[]);
  return REGIONAL_HOOKS.map(hook=>({
    ...hook,
    known:found.has(hook.key)||hook.status==='visible',
    tease:hook.status==='visible'
      ?hook.summary
      :hook.status==='unfinished'
        ?`${hook.summary} (Not built yet.)`
        :'A path for another season.'
  }));
}

/* ─── Phase 18: Meaningful random moments ─── */

export const EMERGENT_MOMENTS=Object.freeze([
  {key:'deer_crosses_road',name:'Deer Crossing',summary:'A deer crosses the road ahead and vanishes into cover.',weight:3},
  {key:'merchant_lost_supplies',name:'Scattered Supplies',summary:'A merchant’s spilled crate lies near the trail.',weight:2},
  {key:'sudden_thunderstorm',name:'Sudden Thunderstorm',summary:'Thunder rolls in faster than expected.',weight:2},
  {key:'storm_fallen_tree',name:'Fallen Tree',summary:'A tree falls across a path during the storm.',weight:1},
  {key:'rare_animal_track',name:'Rare Animal Track',summary:'An uncommon track appears in soft ground.',weight:2},
  {key:'traveling_npc',name:'Traveling Visitor',summary:'A traveler passes through with news from farther roads.',weight:2},
  {key:'exceptional_crop',name:'Exceptional Yield',summary:'A crop plot produces an unexpectedly fine harvest.',weight:1}
]);

export function pickEmergentMoment({seed='',hour=12,weather='clear',rare=0.08}={}){
  const roll=deterministicUnit(`${seed}:moment:${Math.floor(hour)}:${weather}`);
  if(roll>Number(rare))return null;
  const stormy=/storm|heavy rain/i.test(String(weather));
  const pool=EMERGENT_MOMENTS.filter(moment=>{
    if(moment.key==='storm_fallen_tree'||moment.key==='sudden_thunderstorm')return stormy||roll<0.03;
    return true;
  });
  const total=pool.reduce((sum,item)=>sum+item.weight,0);
  let cursor=deterministicUnit(`${seed}:pick:${hour}`)*total;
  for(const moment of pool){
    cursor-=moment.weight;
    if(cursor<=0)return{...moment,at:new Date().toISOString()};
  }
  return pool[0]?{...pool[0],at:new Date().toISOString()}:null;
}

/* ─── Phase 19–20: Legacy + Returning player summary ─── */

export function legacyCandidates({milestones=[],discoveries=[],skills=[],buildings=[],townContributions=0,playerName='A traveler',gameDay=null}={}){
  const entries=[];
  const complete=new Set((milestones||[]).filter(m=>m.complete||m.earned).map(m=>m.key||m));
  if(complete.has('master_builder')||hasBuilding(buildings,({level,key,type})=>(key==='homestead'||type==='house')&&level>=3)){
    entries.push({
      eventKey:`legacy-master-cabin-${String(playerName).toLowerCase()}`,
      title:`${playerName} completed an advanced cabin`,
      summary:`Day ${gameDay??'—'} — ${playerName} completed the settlement’s first master-built cabin.`,
      kind:'structure'
    });
  }
  const map=skillMap(skills);
  for(const [skill,value] of map.entries()){
    if(value>=50)entries.push({
      eventKey:`legacy-skill-${skill}-50-${String(playerName).toLowerCase()}`,
      title:`${playerName} reached ${prettyName(skill)} 50`,
      summary:`${playerName} became known for ${prettyName(skill)}.`,
      kind:'skill'
    });
  }
  for(const discovery of discoveries||[]){
    if(discovery.key==='strange_landmark'||discovery.key==='ruined_cabin'){
      entries.push({
        eventKey:`legacy-discovery-${discovery.key}-${String(playerName).toLowerCase()}`,
        title:`${playerName} discovered ${discovery.name||discovery.key}`,
        summary:`${playerName} found ${discovery.name||'a rare landmark'} in the wilds.`,
        kind:'discovery'
      });
    }
  }
  if(Number(townContributions||0)>=5){
    entries.push({
      eventKey:`legacy-town-${String(playerName).toLowerCase()}`,
      title:`${playerName} shaped the town`,
      summary:`${playerName} contributed heavily to major town projects.`,
      kind:'town'
    });
  }
  return entries.slice(0,4);
}

export function whileYouWereAwaySummary({
  catchUpSteps=0,
  readyCrops=0,
  projectProgress=null,
  weatherPassed=null,
  demandShift=null,
  arrivals=[],
  milestones=[],
  discoveries=[]
}={}){
  const lines=[];
  if(readyCrops>0)lines.push(`Your ${readyCrops===1?'crop is':'crops are'} ready to harvest (${readyCrops}).`);
  if(projectProgress&&Number(projectProgress.percent||0)>0){
    lines.push(`The ${projectProgress.name||'town project'} reached ${Math.round(projectProgress.percent)}% completion.`);
  }
  if(weatherPassed)lines.push(`A ${weatherPassed} passed through the settlement.`);
  if(demandShift)lines.push(`${prettyName(demandShift)} demand increased.`);
  if(arrivals.length)lines.push(`${arrivals[0].npcKey||'A new resident'} arrived in town.`);
  if(catchUpSteps>=4)lines.push(`Your land lived through ${catchUpSteps} ecology steps while you were away.`);
  for(const milestone of milestones||[]){
    if(milestone.newlyEarned)lines.push(`Milestone earned: ${milestone.name}.`);
  }
  if(discoveries.length)lines.push(`A discovery awaits: ${discoveries[0].name}.`);
  return lines.slice(0,5);
}

export function profileCard({
  playerName='Traveler',
  property=null,
  skills=[],
  inventory={},
  discoveryCount=0,
  milestones=[]
}={}){
  const development=property||propertyDevelopmentLevel({});
  const specialization=playerSpecialization({
    skills,
    inventory,
    discoveryCount,
    milestonesComplete:(milestones||[]).filter(m=>m.complete).length
  });
  return{
    name:playerName,
    homesteadLevel:development.name,
    homesteadKey:development.key,
    checklist:development.checklist,
    nextHint:development.nextHint,
    strongestSkills:specialization.strongestSkills,
    knownFor:specialization.knownFor,
    primary:specialization.primary
  };
}
