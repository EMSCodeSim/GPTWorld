import { advanceIndividuals } from './individual-wildlife.mjs';
import { advancePlantIndividuals } from './individual-plants.mjs';
import { advanceAnimalSpecies } from './animal-needs.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

function seededNoise(seed) {
  const x = Math.sin(seed * 999.91) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function initialEcosystem() {
  return {
    version: 1,
    simulatedYear: 0,
    startedOn: new Date().toISOString().slice(0, 10),
    lastRealDate: null,
    climate: { temperatureC: 13.5, rainfall: 0.62, fertility: 0.74 },
    species: [
      { id: 'rivergrass', name: 'Rivergrass', kind: 'plant', diet: 'sunlight', population: 7200, bornYear: 0, parentId: null, habitat: 'riverbank', traits: { size: 0.18, speed: 0, drought: 0.42, cold: 0.55 } },
      { id: 'thornbrush', name: 'Thornbrush', kind: 'plant', diet: 'sunlight', population: 4100, bornYear: 0, parentId: null, habitat: 'scrub', traits: { size: 0.38, speed: 0, drought: 0.7, cold: 0.44 } },
      { id: 'meadow-grazer', name: 'Meadow Grazer', kind: 'herbivore', diet: 'plants', population: 380, bornYear: 0, parentId: null, habitat: 'grassland', traits: { size: 0.36, speed: 0.52, drought: 0.38, cold: 0.48 } },
      { id: 'reed-runner', name: 'Reed Runner', kind: 'herbivore', diet: 'plants', population: 240, bornYear: 0, parentId: null, habitat: 'riverbank', traits: { size: 0.18, speed: 0.68, drought: 0.28, cold: 0.52 } },
      { id: 'ridge-stalker', name: 'Ridge Stalker', kind: 'predator', diet: 'herbivores', population: 42, bornYear: 0, parentId: null, habitat: 'ridge', traits: { size: 0.54, speed: 0.63, drought: 0.46, cold: 0.58 } }
    ],
    extinct: [],
    recentEvents: [
      { year: 0, type: 'origin', text: 'The first known ecosystem record begins in the settlement valley.' }
    ]
  };
}

function applyFoodChainNeeds(state) {
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

function applyPlantSeeds(state, year=Number(state.simulatedYear||0)) {
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

function applyPlantColonizationAndSuccession(state, year=Number(state.simulatedYear||0)) {
  const plants=(state.species||[]).filter(s=>s.kind==='plant'), habitats=state.habitats||{}, bank=state.seedBank?.seeds||{};
  state.plantPatches ||= [];
  for(const plant of plants){
    const seed=bank[plant.id]||{}, available=Number(seed.germinated||0)+Math.round(Number(seed.dormant||0)*.04);if(available<=0)continue;
    for(const [hid,h] of Object.entries(habitats)){
      if(hid===plant.habitat||state.plantPatches.some(p=>p.speciesId===plant.id&&p.habitat===hid))continue;
      const fit=clamp(Number(h.moisture||.4)*.42+Number(h.fertility||.4)*.38+(1-Number(h.grazingPressure||0))*.2,0,1),d=seed.dispersal||{},reach=clamp(Number(d.wind||0)*.45+Number(d.water||0)*.25+Number(d.animals||0)*.3,0,1),chance=fit*reach,roll=(seededNoise(year*17.3+plant.id.length*7.1+hid.length*3.7)+1)/2;
      if(chance>.38&&roll<chance*.48){state.plantPatches.push({id:`${plant.id}-${hid}-${year}`,speciesId:plant.id,habitat:hid,population:Math.max(12,Math.round(available*.12)),stage:'pioneer',foundedYear:year,lastYear:year});state.recentEvents.push({year,type:'colonization',text:`${plant.name} established a new patch in the ${hid}.`});}
    }
  }
  for(const patch of state.plantPatches){const h=habitats[patch.habitat]||{},age=Math.max(0,year-Number(patch.foundedYear||year)),stress=clamp((1-Number(h.moisture||.5))*.45+Number(h.grazingPressure||0)*.4+(String(h.status||'').includes('burn')?.35:0),0,1),growth=clamp(.88+Number(h.fertility||.4)*.2+Number(h.moisture||.4)*.18-stress*.22,.55,1.22);patch.population=Math.max(0,Math.round(Number(patch.population||0)*growth));patch.lastYear=year;patch.stage=patch.population<=0?'lost':String(h.status||'').includes('burn')?'disturbed':age<2?'pioneer':age<5?'establishing':patch.population>900?'mature':'developing';}
  for(const patch of state.plantPatches.filter(p=>p.population<=0))state.recentEvents.push({year,type:'local_extinction',text:`A ${patch.speciesId} patch disappeared from the ${patch.habitat}.`});
  state.plantPatches=state.plantPatches.filter(p=>p.population>0).slice(-80);state.succession={version:1,year,patches:state.plantPatches.length,stages:state.plantPatches.reduce((a,p)=>(a[p.stage]=(a[p.stage]||0)+1,a),{})};return state;
}

function applyPlantHabitats(state) {
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

function applyLifeCycleEvents(state, year) {
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

function applyAnimalSocialAndBreeding(state, year=Number(state.simulatedYear||0)) {
  const animals=(state.species||[]).filter(s=>s.kind==='herbivore'||s.kind==='predator');
  state.animalGroups ||= [];
  for(const sp of animals){
    const groupType=sp.kind==='predator'?'pack':'herd', shelterType=sp.kind==='predator'?'den':'nesting ground';
    let g=state.animalGroups.find(x=>x.speciesId===sp.id);
    if(!g){g={id:`${sp.id}-${groupType}`,speciesId:sp.id,type:groupType,shelterType,habitat:sp.habitat,foundedYear:year};state.animalGroups.push(g);}
    g.population=Number(sp.population||0);g.size=sp.kind==='predator'?Math.max(2,Math.min(9,Math.round(g.population/8))):Math.max(4,Math.min(28,Math.round(g.population/20)));g.groups=Math.max(1,Math.ceil(g.population/g.size));g.habitat=sp.migration?.driver==='water'?'river corridor':sp.habitat;g.lastYear=year;
    const seasonIndex=((year%4)+4)%4, season=['Spring','Summer','Autumn','Winter'][seasonIndex];g.breedingSeason=sp.kind==='herbivore'?'Spring':'Winter';g.breedingActive=season===g.breedingSeason;
    const fit=Number(sp.demography?.reproductionFit||.5), stress=Number(sp.needs?.hunger||0)*.5+Number(sp.needs?.thirst||0)*.5;
    if(g.breedingActive&&fit>.55&&stress<.65&&g.lastBreedingYear!==year){const bonus=Math.max(1,Math.round(g.population*(sp.kind==='predator'?.012:.025)*fit));sp.population+=bonus;g.young=bonus;g.lastBreedingYear=year;(state.recentEvents||=[]).push({year,type:'breeding',text:`${sp.name} ${groupType}s produced ${bonus} young near their ${shelterType}.`});}else g.young=0;
  }
  state.animalGroups=state.animalGroups.filter(g=>animals.some(s=>s.id===g.speciesId)).slice(-30);
  state.socialEcology={version:1,year,herds:state.animalGroups.filter(g=>g.type==='herd').length,packs:state.animalGroups.filter(g=>g.type==='pack').length,activeBreeders:state.animalGroups.filter(g=>g.breedingActive).map(g=>g.speciesId)};return state;
}

function applyMigrationAndTerritories(state) {
  const year=Number(state.simulatedYear||0), species=Array.isArray(state.species)?state.species:[];
  for(const s of species.filter(x=>x.kind!=='plant')){
    const predator=s.kind==='predator';
    s.territory={type:predator?'territory':'seasonal range',homeHabitat:s.habitat,radius:predator?round(6+Number(s.traits?.size||.4)*7,1):round(8+Number(s.traits?.speed||.4)*6,1),year};
    s.migration={enabled:!predator,driver:Number(s.needs?.thirst||0)>.55?'water':Number(s.needs?.hunger||0)>.5?'food':'season',route:predator?'follow prey':'seasonal habitat route',year};
  }
  state.migration={version:1,year,activeSpecies:species.filter(x=>x.kind==='herbivore'&&x.migration?.enabled).map(x=>x.id),predatorsFollowingPrey:species.filter(x=>x.kind==='predator').map(x=>x.id)};
  return state;
}

// Persisted cohorts, injuries and wildlife journal advance once per ecological year.
function advanceWildlifeAges(state,year){
 state.wildlifeJournal ||= [];
 for(const sp of (state.species||[]).filter(s=>s.kind!=='plant')){
  const population=Math.max(0,Math.floor(Number(sp.population||0))),previous=sp.ageCohorts||{};
  const previousYoung=Math.min(population,Math.max(0,Math.floor(Number(previous.young||0))));
  const matured=Math.min(previousYoung,Math.max(0,Math.round(previousYoung*.65)));
  const born=Math.min(population,Math.max(0,Math.floor(Number(sp.demography?.births||0))));
  const breeding=Math.min(population,Math.max(0,Math.floor(Number(state.animalGroups?.find(g=>g.speciesId===sp.id)?.young||0))));
  const young=Math.min(population,Math.max(0,previousYoung-matured+born+breeding));
  const injuredBefore=Math.max(0,Math.floor(Number(sp.injuries?.injured||0)));
  const recovered=Math.min(injuredBefore,Math.round(injuredBefore*(.2+Number(sp.needs?.energy??.5)*.45)));
  const newInjuries=Math.min(Math.max(0,population-young),Math.round(Number(sp.demography?.predationDeaths||0)*.2+population*Number(sp.needs?.fear||0)*.012));
  const injured=Math.min(population,Math.max(0,injuredBefore-recovered+newInjuries));
  sp.ageCohorts={young,adults:population-young,matured,born:born+breeding,year};
  sp.injuries={injured,recovered,newInjuries,year};
  if(born+breeding||matured||newInjuries||recovered){state.wildlifeJournal.push({year,speciesId:sp.id,type:'life_cycle',births:born+breeding,matured,injured:newInjuries,recovered,deaths:Number(sp.demography?.naturalDeaths||0)+Number(sp.demography?.predationDeaths||0),text:`${sp.name}: ${born+breeding} young born, ${matured} matured, ${newInjuries} injured, ${recovered} recovered.`});}
 }
 state.wildlifeJournal=state.wildlifeJournal.slice(-60);
 state.wildlifeSummary={year,animals:(state.species||[]).filter(s=>s.kind!=='plant').reduce((n,s)=>n+Number(s.population||0),0),young:(state.species||[]).reduce((n,s)=>n+Number(s.ageCohorts?.young||0),0),injured:(state.species||[]).reduce((n,s)=>n+Number(s.injuries?.injured||0),0)};
 return state;
}

function evolveOneYear(state) {
  const next = structuredClone(state);
  const year = Number(next.simulatedYear || 0) + 1;
  next.simulatedYear = year;
  next.recentEvents = Array.isArray(next.recentEvents) ? next.recentEvents.slice(-11) : [];

  const tempShift = seededNoise(year * 3.1) * 0.55 + seededNoise(year * 0.21) * 0.18;
  const rainShift = seededNoise(year * 4.7) * 0.075;
  next.climate.temperatureC = round(clamp(Number(next.climate.temperatureC || 13.5) + tempShift, 7, 21), 2);
  next.climate.rainfall = round(clamp(Number(next.climate.rainfall || 0.62) + rainShift, 0.15, 0.95), 3);
  next.climate.fertility = round(clamp(0.42 + next.climate.rainfall * 0.48 - Math.max(0, next.climate.temperatureC - 17) * 0.02, 0.18, 0.92), 3);

  const species = Array.isArray(next.species) ? next.species : [];
  const plants = species.filter(s => s.kind === 'plant');
  const herbivores = species.filter(s => s.kind === 'herbivore');
  const predators = species.filter(s => s.kind === 'predator');
  const plantBiomassBefore = plants.reduce((sum, s) => sum + Number(s.population || 0), 0);
  const herbivoreBefore = herbivores.reduce((sum, s) => sum + Number(s.population || 0), 0);

  for (const s of species) {
    const noise = seededNoise(year * 13 + s.id.length * 5.3);
    const droughtFit = 1 - Math.abs(Number(s.traits?.drought || 0.5) - (1 - next.climate.rainfall));
    const coldTarget = clamp((16 - next.climate.temperatureC) / 10 + 0.5, 0, 1);
    const coldFit = 1 - Math.abs(Number(s.traits?.cold || 0.5) - coldTarget);
    const climateFit = clamp((droughtFit + coldFit) / 2, 0.25, 1.05);

    let growth = 1;
    if (s.kind === 'plant') {
      growth = 0.78 + next.climate.fertility * 0.48 + climateFit * 0.18 + noise * 0.08;
      const cap = 4200 + next.climate.fertility * 6200;
      growth *= clamp(1.18 - Number(s.population || 0) / cap * 0.42, 0.55, 1.18);
    } else if (s.kind === 'herbivore') {
      const foodPerAnimal = plantBiomassBefore / Math.max(1, herbivoreBefore);
      const foodFit = clamp(foodPerAnimal / 16, 0.35, 1.3);
      const predatorPressure = predators.reduce((sum, p) => sum + Number(p.population || 0), 0) / Math.max(80, Number(s.population || 0));
      growth = 0.82 + foodFit * 0.22 + climateFit * 0.11 - predatorPressure * 0.09 + noise * 0.06;
    } else {
      const preyFit = clamp(herbivoreBefore / Math.max(1, predators.reduce((sum, p) => sum + Number(p.population || 0), 0) * 9), 0.3, 1.35);
      growth = 0.8 + preyFit * 0.22 + climateFit * 0.09 + noise * 0.055;
    }

    s.population = Math.max(0, Math.round(Number(s.population || 0) * clamp(growth, 0.55, 1.45)));
    s.traits ||= { size: 0.4, speed: 0.4, drought: 0.5, cold: 0.5 };
    s.traits.drought = round(clamp(Number(s.traits.drought || 0.5) + ((1 - next.climate.rainfall) - Number(s.traits.drought || 0.5)) * 0.012 + noise * 0.006, 0, 1), 3);
    s.traits.cold = round(clamp(Number(s.traits.cold || 0.5) + (coldTarget - Number(s.traits.cold || 0.5)) * 0.01 + noise * 0.005, 0, 1), 3);
    if (s.kind !== 'plant') {
      s.traits.speed = round(clamp(Number(s.traits.speed || 0.4) + seededNoise(year * 7.7 + s.id.length) * 0.006, 0.08, 0.95), 3);
      s.traits.size = round(clamp(Number(s.traits.size || 0.4) + seededNoise(year * 9.9 + s.id.charCodeAt(0)) * 0.005, 0.08, 0.95), 3);
    }
  }

  const survivors = [];
  for (const s of species) {
    const extinctionFloor = s.kind === 'plant' ? 45 : s.kind === 'herbivore' ? 8 : 4;
    if (s.population < extinctionFloor) {
      const fossil = {
        id: s.id,
        name: s.name,
        kind: s.kind,
        parentId: s.parentId || null,
        bornYear: Number(s.bornYear || 0),
        extinctYear: year,
        lastHabitat: s.habitat,
        finalTraits: s.traits,
        cause: next.climate.rainfall < 0.3 ? 'prolonged drought pressure' : next.climate.temperatureC > 18 ? 'warming and habitat pressure' : 'ecological competition and population decline'
      };
      next.extinct ||= [];
      next.extinct.push(fossil);
      next.recentEvents.push({ year, type: 'extinction', text: `${s.name} disappears from the living record.` });
    } else survivors.push(s);
  }
  next.species = advanceAnimalSpecies(survivors, next.climate, 1);

  const candidates = survivors.filter(s => s.population > (s.kind === 'plant' ? 6200 : s.kind === 'herbivore' ? 500 : 65));
  if (candidates.length && year >= 8 && year % 7 === 0 && survivors.length < 18) {
    const parent = candidates[Math.abs(Math.floor(seededNoise(year * 2.2) * 1000)) % candidates.length];
    const branchShare = parent.kind === 'plant' ? 0.08 : 0.12;
    const branchPop = Math.max(parent.kind === 'predator' ? 8 : 20, Math.round(parent.population * branchShare));
    parent.population -= branchPop;
    const suffixes = ['Dune', 'Vale', 'Ash', 'Silver', 'Moss', 'Stone', 'Duskwater', 'Highland'];
    const suffix = suffixes[year % suffixes.length];
    const base = parent.name.replace(/^(River|Meadow|Reed|Ridge)\s/, '');
    const child = structuredClone(parent);
    child.id = `${parent.id}-branch-${year}`;
    child.name = `${suffix} ${base}`;
    child.parentId = parent.id;
    child.bornYear = year;
    child.population = branchPop;
    child.habitat = next.climate.rainfall < 0.4 ? 'dry upland' : next.climate.rainfall > 0.75 ? 'wet lowland' : parent.habitat;
    child.traits.drought = round(clamp(Number(child.traits.drought || 0.5) + seededNoise(year * 5.5) * 0.12, 0, 1), 3);
    child.traits.cold = round(clamp(Number(child.traits.cold || 0.5) + seededNoise(year * 6.5) * 0.1, 0, 1), 3);
    if (child.kind !== 'plant') {
      child.traits.speed = round(clamp(Number(child.traits.speed || 0.4) + seededNoise(year * 8.2) * 0.08, 0.08, 0.95), 3);
      child.traits.size = round(clamp(Number(child.traits.size || 0.4) + seededNoise(year * 9.2) * 0.07, 0.08, 0.95), 3);
    }
    next.species.push(child);
    next.recentEvents.push({ year, type: 'speciation', text: `${child.name} branches from ${parent.name}.` });
  }

  if (year % 5 === 0) {
    const climateText = next.climate.rainfall < 0.32 ? 'A dry cycle grips the valley.' : next.climate.rainfall > 0.78 ? 'Wet years expand the river habitats.' : next.climate.temperatureC > 17.5 ? 'A warmer cycle reshapes the valley.' : 'The valley climate remains comparatively stable.';
    next.recentEvents.push({ year, type: 'climate', text: climateText });
  }

  applyPlantHabitats(next);
  applyFoodChainNeeds(next);
  applyPlantSeeds(next, year);
  applyPlantColonizationAndSuccession(next, year);
  applyLifeCycleEvents(next, year);
  applyPlantHabitats(next);
  applyFoodChainNeeds(next);
  applyMigrationAndTerritories(next);
  applyAnimalSocialAndBreeding(next, year);
  advanceWildlifeAges(next, year);
  advanceIndividuals(next, year);
  advancePlantIndividuals(next, year);
  return next;
}


export {
  initialEcosystem,
  evolveOneYear,
  seededNoise,
  applyFoodChainNeeds,
  applyPlantHabitats,
  applyPlantSeeds,
  applyPlantColonizationAndSuccession,
  applyMigrationAndTerritories,
  applyAnimalSocialAndBreeding
};
