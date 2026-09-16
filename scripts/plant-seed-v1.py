from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor='function applyPlantHabitats(state) {'
helper=r'''function applyPlantSeeds(state, year=Number(state.simulatedYear||0)) {
  const plants=(state.species||[]).filter(s=>s.kind==='plant');
  state.seedBank ||= {version:1,year,seeds:{}};
  for(const plant of plants){
    const id=plant.id, traits=plant.traits||{}, life=plant.lifeCycle||{};
    const mature=Number(plant.population||0)>1200;
    const produced=mature?Math.max(0,Math.round(Number(plant.population||0)*(.012+Number(life.spreadPotential||.4)*.018))):0;
    const wind=round(clamp(.25+Math.abs(seededNoise(year*9.7+id.length))*0.45,0,1),2);
    const water=String(plant.habitat||'').includes('river')?.55:.08;
    const animal=round(clamp((state.foodChain?.herbivorePopulation||0)/1200,0,.65),2);
    const viability=round(clamp(.35+Number(traits.drought||.5)*.2+Number(traits.cold||.5)*.15+Number(life.spreadPotential||.4)*.3,0,1),2);
    const previous=state.seedBank.seeds[id]||{};
    const dormant=Math.round(Number(previous.dormant||0)*.82+produced*(1-viability*.28));
    const germinated=Math.round(produced*viability*.18);
    state.seedBank.seeds[id]={speciesId:id,produced,dormant,germinated,viability,dispersal:{wind,water,animals:animal},year};
    plant.seedCycle={produced,dormant,germinated,viability,year};
    if(germinated>0&&Number(life.spreadPotential||0)>.55)plant.population=Math.round(Number(plant.population||0)+germinated*.35);
  }
  state.seedBank.year=year;return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old='  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  applyLifeCycleEvents(next, year);'
new='  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  applyPlantSeeds(next, year);\n  applyLifeCycleEvents(next, year);'
assert old in s;s=s.replace(old,new,1)
old='  applyPlantHabitats(state);\n  applyFoodChainNeeds(state);'
new='  applyPlantHabitats(state);\n  applyFoodChainNeeds(state);\n  applyPlantSeeds(state);'
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
