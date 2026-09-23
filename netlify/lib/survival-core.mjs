const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const CROPS=Object.freeze([
  {key:'wheat',name:'Wheat',unlock:0,growHours:2,yield:3,xp:1.2,color:0xd6b34c},
  {key:'carrot',name:'Carrots',unlock:0,growHours:3,yield:3,xp:1.4,color:0xe98632},
  {key:'potato',name:'Potatoes',unlock:20,growHours:4,yield:4,xp:1.8,color:0xb89462},
  {key:'pumpkin',name:'Pumpkins',unlock:45,growHours:7,yield:2,xp:2.8,color:0xe77422},
  {key:'farm-herbs',name:'Garden Herbs',unlock:65,growHours:5,yield:4,xp:2.4,color:0x71a84d}
]);
export const HUNT_UNLOCKS=Object.freeze([
  {level:0,key:'tracking',name:'Basic tracking'},
  {level:0,key:'basic-bow',name:'Basic bow'},
  {level:30,key:'reinforced-bow',name:'Reinforced bow'},
  {level:55,key:'hunting-trap',name:'Hunting trap'},
  {level:70,key:'composite-bow',name:'Composite bow'}
]);
export const CROP_STAGES=Object.freeze(['seed','sprout','young','mature','ready','dead']);

export function cropByKey(key){return CROPS.find(crop=>crop.key===String(key))||null;}
export function cropUnlocked(key,skill=0){const crop=cropByKey(key);return Boolean(crop&&Number(skill)>=crop.unlock);}
export function weatherGrowthFactor(weather='clear',temperature=18){
  const w=String(weather).toLowerCase();
  let factor=w.includes('rain') ? 1.2 : (w.includes('storm') ? .72 : (w.includes('snow') ? .35 : (w.includes('drought') ? .5 : 1)));
  if(Number(temperature)<3)factor*=.45;if(Number(temperature)>32)factor*=.7;return clamp(factor,.2,1.35);
}
export function advanceCrop(plot,{now=new Date(),weather='clear',temperature=18}={}){
  if(!plot?.crop_key)return{...plot,stage:'prepared',progress:0,moisture:clamp(plot?.moisture??0,0,100),health:clamp(plot?.health??100,0,100)};
  const crop=cropByKey(plot.crop_key);if(!crop)return{...plot,stage:'dead',progress:0,health:0};
  const start=new Date(plot.planted_at).getTime(),end=new Date(now).getTime(),hours=Math.max(0,(end-start)/3600000);
  const moistureSince=new Date(plot.updated_at||plot.watered_at||plot.planted_at).getTime(),dryHours=Math.max(0,(end-moistureSince)/3600000);
  const rain=String(weather).toLowerCase().includes('rain'),moisture=clamp(Number(plot.moisture??80)-dryHours*7+(rain?dryHours*20:0),0,100);
  const health=clamp(Number(plot.health??100)-(moisture<18?dryHours*3:0),0,100);
  if(health<=0)return{...plot,stage:'dead',progress:0,moisture,health};
  const progress=clamp(hours/crop.growHours*weatherGrowthFactor(weather,temperature)*(health/100),0,1);
  const stage=progress>=1?'ready':progress>=.65?'mature':progress>=.32?'young':progress>=.1?'sprout':'seed';
  return{...plot,stage,progress:Number(progress.toFixed(3)),moisture:Number(moisture.toFixed(1)),health:Number(health.toFixed(1))};
}
export function cropHarvest(cropKey,skill=0,health=100){const crop=cropByKey(cropKey);if(!crop)return null;const bonus=Math.floor(clamp(skill,0,100)/35),quantity=Math.max(1,Math.round(crop.yield*(clamp(health,10,100)/100))+bonus);return{itemKey:crop.key,name:crop.name,quantity,xp:Number((crop.xp+quantity*.12).toFixed(2)),seedPouches:1};}

export function huntChance({skill=0,equipment='basic-bow',distance=0,injury=0}={}){
  const equipmentBonus=equipment==='composite-bow'?.26:equipment==='reinforced-bow'?.18:equipment==='hunting-trap'?.12:0;
  return Number(clamp(.58+clamp(skill,0,100)*.003+equipmentBonus-clamp(distance-2,0,6)*.055+clamp(injury,0,1)*.12,.18,.95).toFixed(3));
}
export function deterministicRoll(key){let hash=2166136261;for(const char of String(key)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967296;}
export function resolveHunt({key='',species='wildlife',kind='herbivore',skill=0,equipment='basic-bow',distance=0,injury=0}={}){
  const chance=huntChance({skill,equipment,distance,injury}),roll=deterministicRoll(key),success=roll<chance,predator=kind==='predator';
  return{success,chance,roll:Number(roll.toFixed(4)),xp:Number((success?(predator?2.8:1.8):.25).toFixed(2)),rewards:success?[{key:'raw-meat',name:'Raw Meat',quantity:predator?3:2},{key:'hide',name:'Hide',quantity:1}]:[],species};
}
