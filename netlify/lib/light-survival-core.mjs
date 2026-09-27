/**
 * Light survival helpers — decision pressure, not meter micromanagement.
 * Penalties stay recoverable; storm/hunger create planning, not constant UI noise.
 */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export function advanceNeeds(state={},{elapsedHours=0,weather='clear',sheltered=false,ate=false}={}){
  const hours=Math.max(0,Number(elapsedHours)||0);
  let hunger=clamp(Number(state.hunger??20)+hours*4.5-(ate?55:0),0,100);
  let warmth=clamp(Number(state.warmth??70),0,100);
  const w=String(weather).toLowerCase();
  if(w.includes('storm')||w.includes('snow'))warmth-=hours*(sheltered?2:9);
  else if(w.includes('rain'))warmth-=hours*(sheltered?1:4);
  else if(w.includes('clear')&&Number(state.temperatureC||18)<5)warmth-=hours*(sheltered?1:3);
  else warmth+=hours*(sheltered?3:1);
  warmth=clamp(warmth,0,100);
  const exposure=(!sheltered&&(w.includes('storm')||w.includes('snow')))?clamp(Number(state.exposure||0)+hours*8,0,100):clamp(Number(state.exposure||0)-hours*5,0,100);
  const tips=[];
  if(w.includes('storm')&&!sheltered)tips.push('A storm is coming — gather food and firewood before night.');
  if(hunger>70)tips.push('You are getting hungry. Cook or eat trail rations.');
  if(warmth<35)tips.push('You are cold. Seek shelter or a campfire.');
  return{
    hunger:Number(hunger.toFixed(1)),
    warmth:Number(warmth.toFixed(1)),
    exposure:Number(exposure.toFixed(1)),
    tips,
    impaired:hunger>85||warmth<25,
    gatherMod:hunger>85?0.85:1,
    updatedAt:new Date().toISOString()
  };
}

export function foodSpoilageHours(itemKey='raw-meat'){
  if(itemKey==='raw-meat')return 18;
  if(['wheat','carrot','potato','pumpkin','farm-herbs'].includes(itemKey))return 72;
  if(['trail-rations','preserved-rations','field-meal'].includes(itemKey))return 240;
  return 120;
}
