from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor='function evolveOneYear(state) {'
helper=r'''function applyPlantHabitats(state) {
  const species=Array.isArray(state.species)?state.species:[];
  const herbivores=species.filter(s=>s.kind==='herbivore');
  const grazing=herbivores.reduce((a,s)=>a+Number(s.population||0),0);
  const rain=clamp(Number(state.climate?.rainfall||.5),0,1), fertility=clamp(Number(state.climate?.fertility||.5),0,1);
  state.habitats ||= {};
  const defs={riverbank:{moisture:clamp(rain+.24,0,1),fertility:clamp(fertility+.12,0,1)},grassland:{moisture:clamp(rain+.02,0,1),fertility},scrub:{moisture:clamp(rain-.18,0,1),fertility:clamp(fertility-.08,0,1)},ridge:{moisture:clamp(rain-.28,0,1),fertility:clamp(fertility-.16,0,1)}};
  for(const [id,h] of Object.entries(defs)) state.habitats[id]={...h,vegetation:0,grazingPressure:0,status:'stable'};
  for(const plant of species.filter(s=>s.kind==='plant')){
    const hid=String(plant.habitat||'grassland').includes('river')?'riverbank':String(plant.habitat||'').includes('scrub')?'scrub':String(plant.habitat||'').includes('ridge')?'ridge':'grassland';
    const h=state.habitats[hid], biomass=Number(plant.population||0);h.vegetation+=biomass;
    const pressure=clamp(grazing/Math.max(1,biomass)*7,0,1);h.grazingPressure=round(pressure,2);
    plant.lifeCycle={stage:biomass<1200?'recovering':biomass>7000?'mature':'growing',waterStress:round(1-h.moisture,2),grazingPressure:round(pressure,2),spreadPotential:round(clamp(h.moisture*.45+h.fertility*.45-pressure*.3,0,1),2)};
    if(pressure>.55) plant.population=Math.max(50,Math.round(biomass*(1-pressure*.06)));
    else if(plant.lifeCycle.spreadPotential>.62) plant.population=Math.round(biomass*(1+plant.lifeCycle.spreadPotential*.025));
    h.status=h.moisture<.28?'dry':pressure>.65?'overgrazed':h.vegetation>6500?'lush':'stable';
  }
  for(const h of Object.values(state.habitats)){h.vegetation=Math.round(h.vegetation);if(!h.vegetation&&h.moisture>.5)h.status='open';}
  return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old='  applyFoodChainNeeds(next);\n  return next;'
new='  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  return next;'
assert old in s;s=s.replace(old,new,1)
old='  applyFoodChainNeeds(state);'
new='  applyPlantHabitats(state);\n  applyFoodChainNeeds(state);'
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

p=Path('netlify/functions/_sim-core.mjs');s=p.read_text()
old="if(s.kind==='plant'){const count=Math.max(5,Math.min(24,Math.round(Math.sqrt(pop)/6)));"
new="if(s.kind==='plant'){const life=s.lifeCycle||{};const health=clamp(1-Number(life.waterStress||0)*.45-Number(life.grazingPressure||0)*.3,.35,1);const count=Math.max(3,Math.min(28,Math.round(Math.sqrt(pop)/6*health)));"
assert old in s;s=s.replace(old,new,1)
old="const size=.35+hash01(`${s.id}:s:${i}`)*.5;plantCluster(out,s,i,x,z,size);"
new="const size=(.35+hash01(`${s.id}:s:${i}`)*.5)*(.65+health*.45);plantCluster(out,s,i,x,z,size);"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
