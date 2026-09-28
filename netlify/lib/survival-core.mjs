import {resolveHuntAttempt,huntingRange} from './hunting-core.mjs';
import {cropYieldModifier} from './living-events-core.mjs';
import {farmTierModifiers,seasonStrategy,weatherStrategy} from './progression-core.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
export const CROPS=Object.freeze([
  {key:'wheat',name:'Wheat',unlock:0,growHours:1.25,yield:3,xp:2.0,color:0xd6b34c,season:'spring'},
  {key:'carrot',name:'Carrots',unlock:0,growHours:2.5,yield:3,xp:1.6,color:0xe98632,season:'spring'},
  {key:'potato',name:'Potatoes',unlock:15,growHours:3.5,yield:4,xp:2.0,color:0xb89462,season:'autumn'},
  {key:'pumpkin',name:'Pumpkins',unlock:45,growHours:6,yield:2,xp:2.8,color:0xe77422,season:'autumn'},
  {key:'farm-herbs',name:'Garden Herbs',unlock:65,growHours:4.5,yield:4,xp:2.4,color:0x71a84d,season:'summer'}
]);
export const HUNT_UNLOCKS=Object.freeze([
  {level:0,key:'tracking',name:'Basic tracking'},
  {level:0,key:'basic-bow',name:'Basic bow'},
  {level:15,key:'stalking',name:'Quiet stalking'},
  {level:30,key:'reinforced-bow',name:'Improved Bow'},
  {level:45,key:'wound_track',name:'Wound tracking'},
  {level:50,key:'advanced-tracking',name:'Advanced Tracking'},
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
export function seasonGrowthFactor(cropKey,season='spring'){
  const crop=cropByKey(cropKey);if(!crop?.season)return 1;
  const s=String(season||'spring').toLowerCase();
  if(s===crop.season)return 1.15;
  if((crop.season==='spring'&&s==='summer')||(crop.season==='autumn'&&s==='summer'))return 1;
  if(s==='winter')return 0.55;
  return 0.85;
}
export function advanceCrop(plot,{now=new Date(),weather='clear',temperature=18,season='spring',event=null,farmTier=1}={}){
  if(!plot?.crop_key)return{...plot,stage:'prepared',progress:0,moisture:clamp(plot?.moisture??0,0,100),health:clamp(plot?.health??100,0,100),soil:clamp(plot?.soil??plot?.metadata?.soil??55,0,100)};
  const crop=cropByKey(plot.crop_key);if(!crop)return{...plot,stage:'dead',progress:0,health:0};
  const tier=farmTierModifiers(Number(plot.metadata?.farmTier||farmTier||1));
  const weatherFx=weatherStrategy(weather,temperature);
  const seasonFx=seasonStrategy(season);
  const start=new Date(plot.planted_at).getTime(),end=new Date(now).getTime(),hours=Math.max(0,(end-start)/3600000);
  const moistureSince=new Date(plot.updated_at||plot.watered_at||plot.planted_at).getTime(),dryHours=Math.max(0,(end-moistureSince)/3600000);
  const rain=String(weather).toLowerCase().includes('rain');
  const drain=7*Number(tier.moistureDrainScale||1)*(weatherFx.cropGrowth<0.7?1.25:1);
  const moisture=clamp(Number(plot.moisture??80)-dryHours*drain+(rain?dryHours*20:0),0,100);
  const soil=clamp(Number(plot.soil??plot.metadata?.soil??55)+Number(tier.soilBonus||0)*0.02,0,100);
  const disease=Number(event?.effects?.cropHealthDrain||1)*Number(plot.metadata?.cropHealthDrainScale||1);
  const health=clamp(Number(plot.health??100)-(moisture<18?dryHours*3*disease:0)-(soil<25?dryHours*1.2:0),0,100);
  if(health<=0)return{...plot,stage:'dead',progress:0,moisture,health,soil,farmTier:tier};
  const placeableGrowth=Number(plot.metadata?.farmGrowthBonus||1);
  const progress=clamp(
    hours/crop.growHours
      *weatherGrowthFactor(weather,temperature)
      *seasonGrowthFactor(plot.crop_key,season)
      *Number(weatherFx.cropGrowth||1)
      *Number(seasonFx.cropGrowth||1)
      *Number(tier.growthBonus||1)
      *placeableGrowth
      *(health/100)
      *(0.85+soil/400),
    0,
    1
  );
  const stage=progress>=1?'ready':progress>=.65?'mature':progress>=.32?'young':progress>=.1?'sprout':'seed';
  return{...plot,stage,progress:Number(progress.toFixed(3)),moisture:Number(moisture.toFixed(1)),health:Number(health.toFixed(1)),soil:Number(soil.toFixed(1)),farmTier:tier};
}
export function cropHarvest(cropKey,skill=0,health=100,{soil=55,event=null,season='spring',yieldBonus=0}={}){
  const crop=cropByKey(cropKey);if(!crop)return null;
  const bonus=Math.floor(clamp(skill,0,100)/35);
  const soilMod=0.75+clamp(soil,0,100)/200;
  const eventMod=cropYieldModifier(event);
  const seasonFx=seasonStrategy(season);
  const harvestMod=Number(seasonFx.harvestBonus||1);
  const quantity=Math.max(1,Math.round(crop.yield*(clamp(health,10,100)/100)*soilMod*eventMod*harvestMod)+bonus+Math.max(0,Math.floor(Number(yieldBonus)||0)));
  return{itemKey:crop.key,name:crop.name,quantity,xp:Number((crop.xp+quantity*.12).toFixed(2)),seedPouches:1,soilRemaining:clamp(soil-8,10,100)};
}
export function fertilizeSoil(soil=55,amount=20){return clamp(Number(soil||55)+clamp(amount,1,40),0,100);}

export function huntChance({skill=0,equipment='basic-bow',distance=0,injury=0}={}){
  const equipmentBonus=equipment==='composite-bow'?.26:equipment==='reinforced-bow'?.18:equipment==='hunting-trap'?.12:0;
  return Number(clamp(.58+clamp(skill,0,100)*.003+equipmentBonus-clamp(distance-2,0,6)*.055+clamp(injury,0,1)*.12,.18,.95).toFixed(3));
}
export function deterministicRoll(key){let hash=2166136261;for(const char of String(key)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967296;}
export function resolveHunt({key='',species='wildlife',kind='herbivore',skill=0,equipment='basic-bow',distance=0,injury=0,noise=0.4,tracked=false,stalked=false,wounded=false,eventPenalty=0}={}){
  const attempt=resolveHuntAttempt({key,species,kind,skill,equipment,distance,injury,noise,tracked,stalked,wounded,eventPenalty});
  if(!attempt.ok)return{success:false,chance:0,roll:0,xp:0,rewards:[],species,error:attempt.error,maxRange:attempt.maxRange};
  return{
    success:attempt.success,
    chance:attempt.chance,
    roll:attempt.roll,
    xp:attempt.xp,
    rewards:attempt.rewards,
    species,
    wounded:attempt.wounded,
    woundOnly:attempt.woundOnly,
    trackingXp:attempt.trackingXp||0,
    maxRange:attempt.maxRange||huntingRange(equipment)
  };
}
