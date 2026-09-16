import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const cleanName = (value) => String(value || 'Traveler').replace(/[<>]/g, '').trim().slice(0, 20) || 'Traveler';
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegativeInt = (value) => Math.max(0, Math.min(100000, Math.floor(finite(value, 0))));
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
  next.species = survivors;

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
  applyLifeCycleEvents(next, year);
  applyPlantHabitats(next);
  applyFoodChainNeeds(next);
  applyMigrationAndTerritories(next);
  return next;
}

async function ensureAndAdvanceEcosystem(sql) {
  const seed = initialEcosystem();
  await sql`INSERT INTO world_state (key, value, updated_at) VALUES ('ecosystem', ${JSON.stringify(seed)}::jsonb, now()) ON CONFLICT (key) DO NOTHING`;
  const rows = await sql`SELECT value FROM world_state WHERE key = 'ecosystem' LIMIT 1`;
  let state = rows[0]?.value || seed;
  applyPlantHabitats(state);
  applyFoodChainNeeds(state);
  applyPlantSeeds(state);
  applyMigrationAndTerritories(state);
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastRealDate !== today) {
    state = evolveOneYear(state);
    state.lastRealDate = today;
    await sql`UPDATE world_state SET value = ${JSON.stringify(state)}::jsonb, updated_at = now() WHERE key = 'ecosystem'`;
    await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (NULL, 'ecosystem_year_advanced', ${JSON.stringify({ simulatedYear: state.simulatedYear, species: state.species.length, extinct: state.extinct.length })}::jsonb)`;
  }
  return state;
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = (url.searchParams.get('clientId') || '').slice(0, 80);
      const ecosystem = await ensureAndAdvanceEcosystem(sql);
      const [worldRows, onlineRows, meRows, entityRows] = await Promise.all([
        sql`SELECT key, value, updated_at FROM world_state ORDER BY key`,
        sql`SELECT client_id, display_name, x, z, last_seen_at FROM players WHERE last_seen_at > now() - interval '90 seconds' ORDER BY last_seen_at DESC LIMIT 50`,
        clientId ? sql`SELECT p.client_id, p.display_name, p.x, p.z, i.wood, i.stone, i.herbs FROM players p LEFT JOIN player_inventory i ON i.player_id = p.id WHERE p.client_id = ${clientId} LIMIT 1` : Promise.resolve([]),
        sql`SELECT entity_id, value, updated_at FROM world_entities ORDER BY entity_id`
      ]);
      return json({
        ok: true,
        world: Object.fromEntries(worldRows.map(r => [r.key, r.value])),
        ecosystem,
        entities: entityRows.map(r => ({ entity_id: r.entity_id, ...r.value, updated_at: r.updated_at })),
        online: onlineRows,
        me: meRows[0] || null
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const clientId = String(body.clientId || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const name = cleanName(body.name);
      const x = Math.max(-33, Math.min(33, finite(body.x, 0)));
      const z = Math.max(-33, Math.min(33, finite(body.z, 12)));
      const inventory = body.inventory || {};
      const wood = nonNegativeInt(inventory.wood);
      const stone = nonNegativeInt(inventory.stone);
      const herbs = nonNegativeInt(inventory.herbs);

      const players = await sql`
        INSERT INTO players (client_id, display_name, x, z, last_seen_at)
        VALUES (${clientId}, ${name}, ${x}, ${z}, now())
        ON CONFLICT (client_id) DO UPDATE SET display_name = EXCLUDED.display_name, x = EXCLUDED.x, z = EXCLUDED.z, last_seen_at = now()
        RETURNING id
      `;
      const playerId = players[0].id;

      await sql`
        INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at)
        VALUES (${playerId}, ${wood}, ${stone}, ${herbs}, now())
        ON CONFLICT (player_id) DO UPDATE SET
          wood = GREATEST(player_inventory.wood, EXCLUDED.wood),
          stone = GREATEST(player_inventory.stone, EXCLUDED.stone),
          herbs = GREATEST(player_inventory.herbs, EXCLUDED.herbs),
          updated_at = now()
      `;

      if (body.action === 'contribute_bridge') {
        const giveWood = Math.min(20, nonNegativeInt(body.wood));
        const giveStone = Math.min(10, nonNegativeInt(body.stone));
        if (giveWood + giveStone < 1) return json({ ok: false, error: 'nothing_to_contribute' }, 400);

        const inv = await sql`SELECT wood, stone FROM player_inventory WHERE player_id = ${playerId} LIMIT 1`;
        const haveWood = Number(inv[0]?.wood || 0);
        const haveStone = Number(inv[0]?.stone || 0);
        if (haveWood < giveWood || haveStone < giveStone) return json({ ok: false, error: 'not_enough_materials' }, 409);

        const currentRows = await sql`SELECT value FROM world_state WHERE key = 'western_crossing' LIMIT 1`;
        const current = currentRows[0]?.value || { wood: 0, stone: 0, woodGoal: 60, stoneGoal: 30, complete: false };
        if (current.complete) return json({ ok: true, crossing: current, contributed: { wood: 0, stone: 0 } });

        const woodGoal = Number(current.woodGoal || 60);
        const stoneGoal = Number(current.stoneGoal || 30);
        const acceptedWood = Math.min(giveWood, Math.max(0, woodGoal - Number(current.wood || 0)));
        const acceptedStone = Math.min(giveStone, Math.max(0, stoneGoal - Number(current.stone || 0)));
        if (acceptedWood + acceptedStone < 1) return json({ ok: true, crossing: { ...current, complete: true }, contributed: { wood: 0, stone: 0 } });

        await sql`UPDATE player_inventory SET wood = wood - ${acceptedWood}, stone = stone - ${acceptedStone}, updated_at = now() WHERE player_id = ${playerId}`;
        const nextWood = Number(current.wood || 0) + acceptedWood;
        const nextStone = Number(current.stone || 0) + acceptedStone;
        const complete = nextWood >= woodGoal && nextStone >= stoneGoal;
        const crossing = { wood: nextWood, stone: nextStone, woodGoal, stoneGoal, complete };
        await sql`UPDATE world_state SET value = ${JSON.stringify(crossing)}::jsonb, updated_at = now() WHERE key = 'western_crossing'`;
        await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, 'bridge_contribution', ${JSON.stringify({ wood: acceptedWood, stone: acceptedStone, complete })}::jsonb)`;
        if (complete) await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, 'western_crossing_completed', ${JSON.stringify({ day: 2 })}::jsonb)`;
        return json({ ok: true, crossing, contributed: { wood: acceptedWood, stone: acceptedStone } });
      }

      if (body.event && typeof body.event.type === 'string') {
        const eventType = body.event.type.replace(/[^a-z0-9_.-]/gi, '').slice(0, 40);
        const payload = JSON.stringify(body.event.payload || {});
        if (eventType) await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, ${eventType}, ${payload}::jsonb)`;
      }

      const online = await sql`SELECT count(*)::int AS count FROM players WHERE last_seen_at > now() - interval '90 seconds'`;
      return json({ ok: true, playerId, online: online[0]?.count || 1 });
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (error) {
    console.error('GPTWorld API error', error);
    return json({ ok: false, error: 'world_api_failed' }, 500);
  }
};