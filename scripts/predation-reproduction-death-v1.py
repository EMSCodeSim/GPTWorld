from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor='function evolveOneYear(state) {'
helper=r'''function applyLifeCycleEvents(state, year) {
  const species=Array.isArray(state.species)?state.species:[];
  const herbivores=species.filter(s=>s.kind==='herbivore'&&s.population>0);
  const predators=species.filter(s=>s.kind==='predator'&&s.population>0);
  state.lifeCycle ||= {version:1,totalBirths:0,totalNaturalDeaths:0,totalPredationDeaths:0,lastYear:null};
  if(state.lifeCycle.lastYear===year)return state;
  let births=0,naturalDeaths=0,predationDeaths=0;
  for(const s of species.filter(x=>x.kind!=='plant')){
    const pop=Math.max(0,Number(s.population||0)), needs=s.needs||{};
    const stress=clamp(Number(needs.hunger||0)*.45+Number(needs.thirst||0)*.35+(1-Number(needs.energy??.5))*.2,0,1);
    const naturalRate=clamp(.025+stress*.09+(Number(s.traits?.size||.4)>.7?.01:0),.015,.16);
    const deaths=Math.min(pop,Math.round(pop*naturalRate));s.population=Math.max(0,pop-deaths);naturalDeaths+=deaths;
    const safeEnergy=Number(needs.energy??.5),reproFit=clamp((1-Number(needs.hunger||0))*.45+(1-Number(needs.thirst||0))*.25+safeEnergy*.3,0,1);
    const birthRate=s.kind==='herbivore'?.10:.055;
    const born=Math.round(s.population*birthRate*reproFit);s.population+=born;births+=born;
    s.demography={births:born,naturalDeaths:deaths,predationDeaths:0,reproductionFit:round(reproFit,2),year};
  }
  for(const predator of predators){
    if(predator.population<=0||!herbivores.length)continue;
    const prey=herbivores.slice().sort((a,b)=>Number(b.population||0)-Number(a.population||0))[0];
    if(!prey||prey.population<=0)continue;
    const hunger=clamp(Number(predator.needs?.hunger||0),0,1),speed=clamp(Number(predator.traits?.speed||.5),0,1),preySpeed=clamp(Number(prey.traits?.speed||.5),0,1);
    const success=clamp(.16+hunger*.24+(speed-preySpeed)*.22,.05,.48);
    const kills=Math.min(prey.population,Math.round(predator.population*success*.65));
    if(kills>0){prey.population-=kills;predationDeaths+=kills;prey.demography ||= {births:0,naturalDeaths:0,predationDeaths:0,year};prey.demography.predationDeaths=(prey.demography.predationDeaths||0)+kills;predator.lastHunt={year,preyId:prey.id,kills,success:round(success,2)};state.recentEvents.push({year,type:'predation',text:`${predator.name} hunted ${prey.name}; ${kills} prey were lost.`});}
  }
  state.lifeCycle={version:1,totalBirths:Number(state.lifeCycle.totalBirths||0)+births,totalNaturalDeaths:Number(state.lifeCycle.totalNaturalDeaths||0)+naturalDeaths,totalPredationDeaths:Number(state.lifeCycle.totalPredationDeaths||0)+predationDeaths,lastYear:year,lastYearBirths:births,lastYearNaturalDeaths:naturalDeaths,lastYearPredationDeaths:predationDeaths};
  if(births||naturalDeaths)state.recentEvents.push({year,type:'life_cycle',text:`Wildlife cycle: ${births} births, ${naturalDeaths} natural deaths, ${predationDeaths} predation deaths.`});
  return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old='  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  return next;'
new='  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  applyLifeCycleEvents(next, year);\n  applyPlantHabitats(next);\n  applyFoodChainNeeds(next);\n  return next;'
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

p=Path('netlify/functions/_sim-core.mjs');s=p.read_text()
old="const needBoost=goal.includes('hunt')||goal.includes('water')||goal.includes('predator')?1.22:goal.includes('rest')?.72:1;"
new="const hunted=Boolean(s.lastHunt&&Number(s.lastHunt.year)>=(Number(s.bornYear||0)));const needBoost=goal.includes('hunt')?1.3:goal.includes('water')||goal.includes('predator')?1.22:goal.includes('rest')?.72:hunted?.92:1;"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
