from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor="function evolveOneYear(state) {"
helper=r'''function applyFoodChainNeeds(state) {
  const species=Array.isArray(state.species)?state.species:[];
  const plants=species.filter(s=>s.kind==='plant');
  const herbivores=species.filter(s=>s.kind==='herbivore');
  const predators=species.filter(s=>s.kind==='predator');
  const plantFood=plants.reduce((a,s)=>a+Number(s.population||0),0);
  const prey=herbivores.reduce((a,s)=>a+Number(s.population||0),0);
  const moisture=clamp(Number(state.climate?.rainfall||.5),0,1);
  for(const s of species){
    s.needs ||= {};
    const pop=Math.max(1,Number(s.population||1));
    if(s.kind==='plant'){
      s.needs={water:round(clamp(.25+(1-moisture)*.65,0,1),2),competition:round(clamp(pop/10000,0,1),2)};
      s.goal=moisture<.3?'survive drought':'grow and spread';
    }else if(s.kind==='herbivore'){
      const food=clamp(plantFood/Math.max(1,herbivores.reduce((a,x)=>a+Number(x.population||0),0)*18),0,1);
      const predatorPressure=clamp(predators.reduce((a,x)=>a+Number(x.population||0),0)/Math.max(1,pop*.22),0,1);
      s.needs={hunger:round(1-food,2),thirst:round(clamp((1-moisture)*.8,0,1),2),energy:round(clamp(.45+food*.4-predatorPressure*.2,0,1),2),fear:round(predatorPressure,2)};
      s.goal=s.needs.fear>.65?'avoid predators':s.needs.thirst>.62?'seek water':s.needs.hunger>.55?'seek plants':'feed and rest';
    }else{
      const preyFit=clamp(prey/Math.max(1,predators.reduce((a,x)=>a+Number(x.population||0),0)*11),0,1);
      s.needs={hunger:round(1-preyFit,2),thirst:round(clamp((1-moisture)*.7,0,1),2),energy:round(clamp(.35+preyFit*.5,0,1),2),fear:.08};
      s.goal=s.needs.thirst>.65?'seek water':s.needs.hunger>.48?'hunt prey':'patrol territory';
    }
  }
  state.foodChain={version:1,plantBiomass:plantFood,herbivorePopulation:prey,predatorPopulation:predators.reduce((a,s)=>a+Number(s.population||0),0),updatedYear:Number(state.simulatedYear||0)};
  return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old="  return next;\n}\n\nasync function ensureAndAdvanceEcosystem"
new="  applyFoodChainNeeds(next);\n  return next;\n}\n\nasync function ensureAndAdvanceEcosystem"
assert old in s;s=s.replace(old,new,1)
# Seed/old states get needs even before next year.
old="  let state = rows[0]?.value || seed;"
new="  let state = rows[0]?.value || seed;\n  applyFoodChainNeeds(state);"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

p=Path('netlify/functions/_sim-core.mjs');s=p.read_text()
old="function animalPosition(s,i,frame,weather){const phase="
new="function animalPosition(s,i,frame,weather){const need=s.needs||{},goal=String(s.goal||'');const phase="
assert old in s;s=s.replace(old,new,1)
old="const speed=(predator?.038:runner?.05:.034)*weatherSlow;const step=mt*speed;return{phase,area,feeding,x:"
new="const needBoost=goal.includes('hunt')||goal.includes('water')||goal.includes('predator')?1.22:goal.includes('rest')?.72:1;const speed=(predator?.038:runner?.05:.034)*weatherSlow*needBoost;const step=mt*speed;let x="
assert old in s;s=s.replace(old,new,1)
old="clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32),z:clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32)};}"
new="clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32),z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32);if(goal.includes('water'))x=x+( -18-x)*.18;return{phase,area,feeding:feeding&&Number(need.hunger||0)<.7,x,z};}"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
