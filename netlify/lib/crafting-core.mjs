const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const CRAFTING_SKILLS=Object.freeze([
  {key:'carpentry',name:'Carpentry'},
  {key:'masonry',name:'Masonry'},
  {key:'herbalism',name:'Herbalism'}
]);

export const CRAFTING_RECIPES=Object.freeze([
  {key:'campfire-kit',name:'Campfire Kit',description:'A portable fire ring and kindling bundle.',skill:'carpentry',difficulty:0,station:'Field Crafting',inputs:{wood:3,stone:2,herbs:0},durability:40},
  {key:'wooden-crate',name:'Wooden Crate',description:'Place it in your world to store and retrieve wood, stone, and herbs.',skill:'carpentry',difficulty:12,station:'Field Crafting',inputs:{wood:8,stone:0,herbs:0},durability:65},
  {key:'stone-hammer',name:'Stone Hammer',description:'A basic construction and stoneworking tool.',skill:'masonry',difficulty:4,station:'Field Crafting',inputs:{wood:2,stone:4,herbs:0},durability:55},
  {key:'stone-hearth',name:'Stone Hearth Kit',description:'Fitted stones for a cabin or outdoor kitchen.',skill:'masonry',difficulty:18,station:'Field Crafting',inputs:{wood:2,stone:10,herbs:0},durability:85},
  {key:'healing-poultice',name:'Healing Poultice',description:'A prepared bundle of restorative wild herbs.',skill:'herbalism',difficulty:0,station:'Field Crafting',inputs:{wood:0,stone:0,herbs:3},durability:1},
  {key:'weather-tonic',name:'Weather Tonic',description:'A concentrated trail tonic for harsh weather.',skill:'herbalism',difficulty:14,station:'Field Crafting',inputs:{wood:1,stone:0,herbs:6},durability:1}
]);

export function craftingRecipe(key){return CRAFTING_RECIPES.find(recipe=>recipe.key===String(key))||null;}

export function craftingChance(skillValue,difficulty){
  if(Number(difficulty)<=4)return 1;
  return Number(clamp(.72+(Number(skillValue)||0)*.009-(Number(difficulty)||0)*.018,.18,.98).toFixed(3));
}

export function craftingHash(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967296;}

export function resolveCraftAttempt({skillValue=0,difficulty=0,key=''}){
  const chance=craftingChance(skillValue,difficulty),roll=craftingHash(`${key}:success`),success=roll<chance;
  const qualityRoll=craftingHash(`${key}:quality`),mastery=clamp((Number(skillValue)-Number(difficulty)+20)/120,0,1);
  const quality=!success?null:qualityRoll<.05+mastery*.14?'exceptional':qualityRoll<.32+mastery*.28?'fine':'standard';
  const currentSkill=clamp(skillValue,0,100);
  const skillGain=currentSkill>=100?0:Number((.1+craftingHash(`${key}:gain-size`)*.3).toFixed(2));
  return{success,chance,roll:Number(roll.toFixed(4)),quality,skillGain};
}

export function spentInputs(recipe,success){
  return Object.fromEntries(Object.entries(recipe.inputs).map(([resource,amount])=>[resource,success?amount:Math.ceil(amount/2)]));
}

export function qualityDurability(base,quality){
  const multiplier=quality==='exceptional'?1.35:quality==='fine'?1.15:1;
  return Math.max(1,Math.round(Number(base||1)*multiplier));
}
