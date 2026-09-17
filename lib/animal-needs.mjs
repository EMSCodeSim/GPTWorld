// Shared, deterministic survival rules for public and private ecology.
const clamp=(n)=>Math.max(0,Math.min(1,Number(n)||0));
const round=(n)=>Math.round(clamp(n)*1000)/1000;
export function animalNeeds(species={},weather={},steps=1){
  const old=species.needs||{};
  const n={hunger:clamp(old.hunger??.25),thirst:clamp(old.thirst??.2),energy:clamp(old.energy??.85)};
  const ticks=Math.max(0,Math.min(48,Math.floor(steps)));
  const heat=Math.max(0,Number(weather.temperatureC||12)-24)/100;
  for(let i=0;i<ticks;i++){
    n.hunger=clamp(n.hunger+.055);
    n.thirst=clamp(n.thirst+.075+heat);
    n.energy=clamp(n.energy-.045);
    const food=species.kind==='predator'?Number(species.preyAvailable||0)>0:Number(species.plantsAvailable||0)>0;
    if(n.hunger>.62&&food){n.hunger=clamp(n.hunger-(species.kind==='predator'?.48:.32));n.energy=clamp(n.energy-.03);}
    if(n.thirst>.57&&species.waterAvailable!==false)n.thirst=clamp(n.thirst-.5);
    if(n.energy<.28)n.energy=clamp(n.energy+.52);
  }
  const goal=n.thirst>.68?'seeking water':n.energy<.3?'resting':n.hunger>.62?(species.kind==='predator'?'hunting':'grazing'):'roaming';
  const health=round(1-Math.max(0,n.hunger-.78)*.65-Math.max(0,n.thirst-.75)*.85-Math.max(0,.2-n.energy)*.4);
  return {needs:{hunger:round(n.hunger),thirst:round(n.thirst),energy:round(n.energy)},goal,health};
}
export function advanceAnimalSpecies(species=[],weather={},steps=1){
  const plants=species.filter(s=>s.kind==='plant').reduce((n,s)=>n+Math.max(0,Number(s.population||0)),0);
  const prey=species.filter(s=>s.kind==='herbivore').reduce((n,s)=>n+Math.max(0,Number(s.population||0)),0);
  return species.map(s=>{
    if(!['predator','herbivore'].includes(s.kind))return s;
    const survival=animalNeeds({...s,plantsAvailable:plants,preyAvailable:prey,waterAvailable:true},weather,steps);
    const loss=survival.health<.75?Math.min(Number(s.population||0),Math.floor(Number(s.population||0)*(1-survival.health)*.03)):0;
    return {...s,...survival,population:Math.max(0,Number(s.population||0)-loss)};
  });
}
