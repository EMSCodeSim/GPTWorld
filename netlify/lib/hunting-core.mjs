/**
 * Hunting loop helpers: signs → track → stalk → hunt → harvest.
 * Deterministic and skill-driven; keeps mobile controls simple.
 */

import {animalProfile,loudPlayerFleeBonus,timeOfDayEffects,animalBehaviorState} from './progression-core.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const TRACK_FRESHNESS=Object.freeze([
  {key:'fresh',maxAgeSec:90,label:'Fresh tracks',quality:1},
  {key:'warm',maxAgeSec:300,label:'Warm tracks',quality:0.7},
  {key:'old',maxAgeSec:900,label:'Old tracks',quality:0.35},
  {key:'cold',maxAgeSec:Infinity,label:'Cold sign',quality:0.15}
]);

export function freshnessForAge(ageSec=0){
  const age=Math.max(0,Number(ageSec)||0);
  return TRACK_FRESHNESS.find(tier=>age<=tier.maxAgeSec)||TRACK_FRESHNESS[TRACK_FRESHNESS.length-1];
}

export function cardinalDirection(dx,dz){
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return'unknown';
  if(Math.abs(dx)<0.35&&Math.abs(dz)<0.35)return'here';
  const angle=Math.atan2(dx,dz); // 0 = +z (south in many scenes; treat as forward)
  const deg=((angle*180/Math.PI)+360)%360;
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg/45)%8];
}

export function playerNoise({moving=false,running=false,crouching=false}={}){
  if(crouching)return moving?0.25:0.08;
  if(running)return 1;
  if(moving)return 0.55;
  return 0.15;
}

export function animalDetectionRange({species='wildlife',kind='herbivore',skill=0,wary=false,noise=0,hour=12}={}){
  const profile=animalProfile(species);
  const base=kind==='predator'||profile.kind==='predator'?7.5:kind==='bird'?9:Number(profile.fleeDistance||5.5);
  const waryBonus=wary||profile.temperament==='skittish'?1.8:0;
  const skillShrink=clamp(skill,0,100)*0.025;
  const loud=loudPlayerFleeBonus(noise);
  const tod=timeOfDayEffects(hour);
  const nightShrink=tod.period==='night'&&profile.kind!=='predator'?0.8:1;
  return Number(clamp((base+waryBonus+loud-skillShrink)*nightShrink,3.2,14).toFixed(2));
}

export function huntingRange(equipment='basic-bow'){
  if(equipment==='composite-bow')return 7.5;
  if(equipment==='reinforced-bow')return 6.2;
  if(equipment==='hunting-trap')return 3.2;
  return 5;
}

export function buildTrackSign({animal,player,now=Date.now(),lastSeenAt=null,skill=0,hour=12,weather='clear',tracksWashed=false}={}){
  if(!animal)return null;
  let ageSec=lastSeenAt?Math.max(0,(now-Number(lastSeenAt))/1000):120;
  if(tracksWashed)ageSec=Math.max(ageSec,950);
  const fresh=freshnessForAge(ageSec);
  const tod=timeOfDayEffects(hour);
  const profile=animalProfile(animal.speciesName||animal.species||'wildlife');
  const advanced=clamp(skill,0,100)>=50;
  const skillBonus=clamp(skill,0,100)>=30||advanced;
  const quality=Number(clamp(fresh.quality+Number(tod.trackingBonus||0)-(profile.trackDifficulty||0)*0.15,0.08,1).toFixed(2));
  const dx=Number(animal.x)-Number(player?.x||0);
  const dz=Number(animal.z)-Number(player?.z||0);
  const distance=Number(Math.hypot(dx,dz).toFixed(1));
  const direction=cardinalDirection(dx,dz);
  const behavior=animal.behavior||animalBehaviorState(animal.species||animal.speciesName,{hour}).behavior;
  return{
    animalId:String(animal.id),
    species:String(animal.speciesName||animal.species||'wildlife'),
    kind:String(animal.kind||profile.kind||'herbivore'),
    freshness:fresh.key,
    freshnessLabel:fresh.label,
    quality,
    direction:skillBonus?direction:'roughly '+direction,
    distance:skillBonus?distance:Math.round(distance),
    behavior,
    temperament:profile.temperament,
    ageSec:Math.round(ageSec),
    xp:Number((0.35+quality*0.4+(advanced?0.25:0)).toFixed(2))
  };
}

export function resolveStalk({noise=0.55,detectionRange=5.5,distance=4,skill=0,crouching=false}={}){
  const hideBonus=crouching?0.18:0;
  const skillBonus=clamp(skill,0,100)*0.004;
  const proximity=clamp(1-(distance/Math.max(detectionRange,1)),0,1);
  const alertChance=clamp(noise*0.55+proximity*0.4-hideBonus-skillBonus,0.05,0.92);
  const rollKeyNoise=clamp(noise,0,1);
  return{
    alertChance:Number(alertChance.toFixed(3)),
    detected:false, // filled by resolve with roll
    recommended:crouching||noise<0.35?'Hold low and close slowly.':'Crouch or stop moving — you are noisy.',
    rollHint:rollKeyNoise
  };
}

export function resolveHuntAttempt({
  key='',
  species='wildlife',
  kind='herbivore',
  skill=0,
  equipment='basic-bow',
  distance=0,
  injury=0,
  noise=0.4,
  tracked=false,
  stalked=false,
  wounded=false,
  eventPenalty=0
}={}){
  const maxRange=huntingRange(equipment);
  if(distance>maxRange)return{ok:false,error:'animal_out_of_range',maxRange,distance};
  const equipmentBonus=equipment==='composite-bow'?0.26:equipment==='reinforced-bow'?0.18:equipment==='hunting-trap'?0.12:0;
  const trackBonus=tracked?0.08:0;
  const stalkBonus=stalked?0.1:0;
  const woundBonus=wounded?0.14:0;
  const noisePenalty=clamp(noise-0.2,0,0.8)*0.12;
  const chance=clamp(
    0.5+clamp(skill,0,100)*0.003+equipmentBonus+trackBonus+stalkBonus+woundBonus
      -clamp(distance-2,0,8)*0.05-noisePenalty-clamp(eventPenalty,0,0.35)+clamp(injury,0,1)*0.1,
    0.12,
    0.96
  );
  let hash=2166136261;
  for(const char of String(key)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const roll=(hash>>>0)/4294967296;
  const success=roll<chance;
  const profile=animalProfile(species);
  const predator=kind==='predator'||profile.kind==='predator';
  const value=Number(profile.harvestValue||1);
  // Near-miss can wound instead of full harvest.
  const woundOnly=!success&&roll<chance+0.12&&equipment!=='hunting-trap';
  const rewards=success?[
    {key:'raw-meat',name:'Raw Meat',quantity:Math.max(1,Math.round((predator?3:2)*value))},
    {key:'hide',name:'Hide',quantity:value>=1.4?2:1}
  ]:[];
  return{
    ok:true,
    success,
    wounded:woundOnly||(success?false:wounded),
    woundOnly,
    chance:Number(chance.toFixed(3)),
    roll:Number(roll.toFixed(4)),
    maxRange,
    xp:Number((success?(predator?2.8:1.8)*value+(tracked?0.3:0)+(stalked?0.3:0):(woundOnly?0.7:0.25)).toFixed(2)),
    rewards,
    species,
    temperament:profile.temperament,
    trackingXp:tracked?0.5:0
  };
}

export function harvestWoundedAnimal({kind='herbivore',skill=0}={}){
  const bonus=Math.floor(clamp(skill,0,100)/40);
  const predator=kind==='predator';
  return{
    rewards:[
      {key:'raw-meat',name:'Raw Meat',quantity:predator?2+bonus:1+bonus},
      {key:'hide',name:'Hide',quantity:1}
    ],
    xp:Number((1.2+bonus*0.2).toFixed(2))
  };
}
