const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const CRAFTING_SKILLS=Object.freeze([
  {key:'carpentry',name:'Carpentry'},
  {key:'masonry',name:'Masonry'},
  {key:'herbalism',name:'Herbalism'},
  {key:'blacksmithing',name:'Blacksmithing'},
  {key:'tailoring',name:'Tailoring'},
  {key:'cooking',name:'Cooking'},
  {key:'farming',name:'Farming'},
  {key:'construction',name:'Construction'}
]);

export const CRAFTING_SKILL_KEYS=Object.freeze(CRAFTING_SKILLS.map(skill=>skill.key));

/** Progressive unlock bands (skill floor → category label). */
export const SKILL_BANDS=Object.freeze([
  {min:0,max:9,label:'Primitive tools and basic items'},
  {min:10,max:19,label:'Improved tools and storage'},
  {min:20,max:29,label:'Workstations and simple furniture'},
  {min:30,max:39,label:'Fences, doors, and farm structures'},
  {min:40,max:49,label:'Shelters and basic construction'},
  {min:50,max:59,label:'Advanced workstations and furniture'},
  {min:60,max:69,label:'Cabins and larger structures'},
  {min:70,max:79,label:'Advanced construction components'},
  {min:80,max:89,label:'Fully usable houses'},
  {min:90,max:99,label:'Advanced houses and workshops'},
  {min:100,max:100,label:'Masterwork construction'}
]);

export const CRAFTING_RECIPES=Object.freeze([
  // Existing recipes preserved (minSkill 0 keeps them unlocked)
  {key:'campfire-kit',name:'Campfire Kit',description:'A portable fire ring and kindling bundle.',skill:'carpentry',minSkill:0,difficulty:0,station:'Field Crafting',category:'basic',inputs:{wood:3,stone:2,herbs:0},durability:40,placeable:true},
  {key:'wooden-crate',name:'Wooden Crate',description:'Place it in your world to store and retrieve wood, stone, and herbs.',skill:'carpentry',minSkill:10,difficulty:12,station:'Field Crafting',category:'storage',inputs:{wood:8,stone:0,herbs:0},durability:65,placeable:true},
  {key:'stone-hammer',name:'Stone Hammer',description:'A basic construction and stoneworking tool.',skill:'masonry',minSkill:0,difficulty:4,station:'Field Crafting',category:'tools',inputs:{wood:2,stone:4,herbs:0},durability:55,placeable:true},
  {key:'stone-hearth',name:'Stone Hearth Kit',description:'Fitted stones for a cabin or outdoor kitchen.',skill:'masonry',minSkill:20,difficulty:18,station:'Field Crafting',category:'furniture',inputs:{wood:2,stone:10,herbs:0},durability:85,placeable:true},
  {key:'healing-poultice',name:'Healing Poultice',description:'A prepared bundle of restorative wild herbs.',skill:'herbalism',minSkill:0,difficulty:0,station:'Field Crafting',category:'basic',inputs:{wood:0,stone:0,herbs:3},durability:1,placeable:false},
  {key:'weather-tonic',name:'Weather Tonic',description:'A concentrated trail tonic for harsh weather.',skill:'herbalism',minSkill:10,difficulty:14,station:'Field Crafting',category:'basic',inputs:{wood:1,stone:0,herbs:6},durability:1,placeable:false},
  // Component recipes for multi-profession construction
  {key:'wooden-beam',name:'Wooden Beam',description:'Squared timber for walls and roof frames.',skill:'carpentry',minSkill:20,difficulty:16,station:'Field Crafting',category:'components',inputs:{wood:6,stone:0,herbs:0},durability:80,placeable:false,component:true},
  {key:'wooden-door',name:'Wooden Door',description:'A hung door ready for a homestead frame.',skill:'carpentry',minSkill:30,difficulty:22,station:'Field Crafting',category:'components',inputs:{wood:5,stone:1,herbs:0},durability:70,placeable:false,component:true},
  {key:'stone-foundation',name:'Stone Foundation',description:'Packed footings that keep a cabin level and dry.',skill:'masonry',minSkill:20,difficulty:18,station:'Field Crafting',category:'components',inputs:{wood:1,stone:12,herbs:0},durability:90,placeable:false,component:true},
  {key:'iron-fittings',name:'Iron Fittings',description:'Hinges, nails, and brackets forged from trail metal.',skill:'blacksmithing',minSkill:20,difficulty:20,station:'Field Crafting',category:'components',inputs:{wood:1,stone:8,herbs:0},durability:75,placeable:false,component:true},
  {key:'reed-mat',name:'Reed Mat',description:'Woven floor covering for a finished cabin.',skill:'tailoring',minSkill:10,difficulty:10,station:'Field Crafting',category:'furniture',inputs:{wood:0,stone:0,herbs:5},durability:30,placeable:true},
  {key:'trail-rations',name:'Trail Rations',description:'Preserved food for long work days.',skill:'cooking',minSkill:0,difficulty:6,station:'Field Crafting',category:'basic',inputs:{wood:0,stone:0,herbs:4},durability:1,placeable:false},
  {key:'seed-pouch',name:'Seed Pouch',description:'Sorted seeds ready for a homestead garden bed.',skill:'farming',minSkill:10,difficulty:12,station:'Field Crafting',category:'farm',inputs:{wood:1,stone:0,herbs:4},durability:20,placeable:false}
]);

/** Configurable homestead blueprint — Construction 80+. */
export const HOUSE_BLUEPRINT=Object.freeze({
  key:'basic-house',
  name:'Basic Homestead',
  description:'A private walkable cabin with a door, interior room, and space for furniture.',
  skill:'construction',
  minSkill:80,
  materials:{wood:40,stone:28,herbs:2},
  components:Object.freeze(['wooden-beam','wooden-beam','wooden-door','stone-foundation','iron-fittings']),
  failureMaterialFraction:0.35,
  keepComponentsOnFailure:true,
  constructionMinutes:0,
  buildingKey:'homestead',
  buildingType:'house',
  width:7,
  depth:6
});

/** Interpolated house success curve (configurable points). */
export const HOUSE_SUCCESS_CURVE=Object.freeze([
  [80,.25],[85,.4],[90,.6],[95,.8],[100,.95]
]);

export function craftingRecipe(key){return CRAFTING_RECIPES.find(recipe=>recipe.key===String(key))||null;}

export function skillBandFor(value){
  const skill=clamp(value,0,100);
  return SKILL_BANDS.find(band=>skill>=band.min&&skill<=band.max)||SKILL_BANDS[0];
}

export function recipeUnlocked(recipe,skillValue){
  return clamp(skillValue,0,100)>=Number(recipe?.minSkill||0);
}

export function craftingChance(skillValue,difficulty){
  if(Number(difficulty)<=4)return 1;
  return Number(clamp(.72+(Number(skillValue)||0)*.009-(Number(difficulty)||0)*.018,.18,.98).toFixed(3));
}

export function houseSuccessChance(skillValue,curve=HOUSE_SUCCESS_CURVE){
  const skill=clamp(skillValue,0,100);
  if(skill<Number(curve[0][0]))return 0;
  for(let i=0;i<curve.length-1;i++){
    const [aSkill,aChance]=curve[i],[bSkill,bChance]=curve[i+1];
    if(skill<=bSkill){
      const t=(skill-aSkill)/Math.max(1e-6,bSkill-aSkill);
      return Number(clamp(aChance+(bChance-aChance)*t,0,1).toFixed(3));
    }
  }
  return Number(curve[curve.length-1][1]);
}

export function craftingHash(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967296;}

export function resolveCraftAttempt({skillValue=0,difficulty=0,key='',minSkill=0}={}){
  const currentSkill=clamp(skillValue,0,100);
  if(currentSkill<Number(minSkill||0))return{success:false,chance:0,roll:0,quality:null,skillGain:0,locked:true};
  const chance=craftingChance(currentSkill,difficulty),roll=craftingHash(`${key}:success`),success=roll<chance;
  const qualityRoll=craftingHash(`${key}:quality`),mastery=clamp((currentSkill-Number(difficulty)+20)/120,0,1);
  const quality=!success?null:qualityRoll<.05+mastery*.14?'exceptional':qualityRoll<.32+mastery*.28?'fine':'standard';
  // Anti-grind: trivial crafts vs current skill yield sharply reduced XP.
  const overskill=Math.max(0,currentSkill-Number(difficulty)-10);
  const grindScale=currentSkill>=100?0:Number(clamp(1-overskill/35,.05,1).toFixed(3));
  const baseGain=.1+craftingHash(`${key}:gain-size`)*.3;
  const skillGain=Number((baseGain*grindScale).toFixed(2));
  return{success,chance,roll:Number(roll.toFixed(4)),quality,skillGain,locked:false,grindScale};
}

export function resolveHouseAttempt({skillValue=0,key=''}={}){
  const chance=houseSuccessChance(skillValue),roll=craftingHash(`${key}:house`),success=roll<chance;
  const currentSkill=clamp(skillValue,0,100);
  const skillGain=currentSkill>=100||currentSkill<HOUSE_BLUEPRINT.minSkill?0:Number((.35+craftingHash(`${key}:house-gain`)*.45).toFixed(2));
  return{success,chance,roll:Number(roll.toFixed(4)),skillGain};
}

export function spentInputs(recipe,success){
  return Object.fromEntries(Object.entries(recipe.inputs||{}).map(([resource,amount])=>[resource,success?amount:Math.ceil(amount/2)]));
}

export function houseMaterialLoss(blueprint=HOUSE_BLUEPRINT,success=true){
  const fraction=success?1:clamp(blueprint.failureMaterialFraction??.35,0,1);
  return Object.fromEntries(Object.entries(blueprint.materials||{}).map(([resource,amount])=>[resource,success?amount:Math.max(0,Math.ceil(Number(amount)*fraction))]));
}

export function qualityDurability(base,quality){
  const multiplier=quality==='exceptional'?1.35:quality==='fine'?1.15:1;
  return Math.max(1,Math.round(Number(base||1)*multiplier));
}

export function recipesForSkillView(skills=[]){
  const skillMap=new Map(skills.map(skill=>[skill.key||skill.skill_key,Number(skill.value??skill.skill_value??0)]));
  return CRAFTING_RECIPES.map(recipe=>{
    const skillValue=skillMap.get(recipe.skill)||0;
    const unlocked=recipeUnlocked(recipe,skillValue);
    return{
      ...recipe,
      unlocked,
      locked:!unlocked,
      requiredSkill:Number(recipe.minSkill||0),
      currentSkill:skillValue,
      chance:unlocked?craftingChance(skillValue,recipe.difficulty):0,
      band:skillBandFor(recipe.minSkill||0).label
    };
  });
}

export function componentNeeds(blueprint=HOUSE_BLUEPRINT){
  const needs=new Map();
  for(const key of blueprint.components||[])needs.set(key,(needs.get(key)||0)+1);
  return [...needs.entries()].map(([key,amount])=>({key,amount,recipe:craftingRecipe(key)}));
}

export function hasComponentStock(ownedKeys=[],blueprint=HOUSE_BLUEPRINT){
  const available=new Map();
  for(const key of ownedKeys)available.set(key,(available.get(key)||0)+1);
  return componentNeeds(blueprint).every(({key,amount})=>(available.get(key)||0)>=amount);
}

export function recentlyUnlockedRecipes(skills=[],previousSkills=[]){
  const before=new Map(previousSkills.map(skill=>[skill.key||skill.skill_key,Number(skill.value??skill.skill_value??0)]));
  const unlocked=[];
  for(const skill of skills){
    const key=skill.key||skill.skill_key,after=Number(skill.value??skill.skill_value??0),prior=before.get(key)??after;
    for(const recipe of CRAFTING_RECIPES){
      if(recipe.skill!==key)continue;
      const floor=Number(recipe.minSkill||0);
      if(prior<floor&&after>=floor)unlocked.push({skill:key,skillValue:after,recipeKey:recipe.key,name:recipe.name,message:`${skillName(key)} reached ${Math.floor(after)}! ${recipe.name} unlocked.`});
    }
    if(key==='construction'){
      const floor=HOUSE_BLUEPRINT.minSkill;
      if(prior<floor&&after>=floor)unlocked.push({skill:key,skillValue:after,recipeKey:HOUSE_BLUEPRINT.key,name:HOUSE_BLUEPRINT.name,message:`Construction reached ${Math.floor(after)}! ${HOUSE_BLUEPRINT.name} Blueprint unlocked.`});
    }
  }
  return unlocked;
}

export function skillName(key){
  return CRAFTING_SKILLS.find(skill=>skill.key===key)?.name||String(key||'').replace(/^./,c=>c.toUpperCase());
}

export function housePreview(skills=[],inventory={},ownedComponents=[]){
  const constructionSkill=skills.find(skill=>(skill.key||skill.skill_key)==='construction');
  const construction=Number(constructionSkill?.value??constructionSkill?.skill_value??0);
  const materials=HOUSE_BLUEPRINT.materials;
  const haveMaterials=Object.entries(materials).every(([resource,amount])=>Number(inventory[resource]||0)>=amount);
  const haveComponents=hasComponentStock(ownedComponents,HOUSE_BLUEPRINT);
  const unlocked=construction>=HOUSE_BLUEPRINT.minSkill;
  return{
    ...HOUSE_BLUEPRINT,
    unlocked,
    locked:!unlocked,
    requiredSkill:HOUSE_BLUEPRINT.minSkill,
    currentSkill:construction,
    chance:unlocked?houseSuccessChance(construction):0,
    materials,
    inventory:{wood:Number(inventory.wood||0),stone:Number(inventory.stone||0),herbs:Number(inventory.herbs||0)},
    materialReady:haveMaterials,
    components:componentNeeds(HOUSE_BLUEPRINT).map(need=>({...need,owned:ownedComponents.filter(key=>key===need.key).length})),
    componentsReady:haveComponents,
    canAttempt:unlocked&&haveMaterials&&haveComponents
  };
}

export function isValidHomesteadSite(x,z,{existing=[],water=null}={}){
  const px=Number(x),pz=Number(z);
  if(!Number.isFinite(px)||!Number.isFinite(pz))return false;
  if(Math.abs(px)>28||Math.abs(pz)>28)return false;
  if(water){
    const radius=Number(water.radius||0)+HOUSE_BLUEPRINT.width*.55;
    if(Math.hypot(px-Number(water.x||0),pz-Number(water.z||0))<radius)return false;
  }
  for(const building of existing){
    if(Math.hypot(px-Number(building.x),pz-Number(building.z))<Math.max(6,Number(building.width||HOUSE_BLUEPRINT.width)))return false;
  }
  return true;
}
