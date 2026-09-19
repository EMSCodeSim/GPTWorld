import {RESOURCE_DEFAULTS,privateKindToResource} from '../../lib/resource-defaults.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const PRIVATE_RESOURCE_RULES=Object.freeze({
  tree:{resource:'wood',maxAmount:RESOURCE_DEFAULTS.wood.max,regrowMinutes:RESOURCE_DEFAULTS.wood.regrowMinutes},
  rock:{resource:'stone',maxAmount:RESOURCE_DEFAULTS.stone.max,regrowMinutes:RESOURCE_DEFAULTS.stone.regrowMinutes},
  herbs:{resource:'herbs',maxAmount:RESOURCE_DEFAULTS.herbs.max,regrowMinutes:RESOURCE_DEFAULTS.herbs.regrowMinutes}
});

export{RESOURCE_DEFAULTS,privateKindToResource};

export function seedFromPlayerId(playerId){
  let x=BigInt(playerId||1)*6364136223846793005n+1442695040888963407n;
  x=BigInt.asUintN(63,x^(x>>29n));
  return Number(x%2147483647n)||1;
}

export function seededRandom(seed){
  let state=(Number(seed)||1)>>>0;
  return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

function point(rand,minRadius=12,maxRadius=31){
  const angle=rand()*Math.PI*2,radius=minRadius+Math.sqrt(rand())*(maxRadius-minRadius);
  return{x:Number((Math.cos(angle)*radius).toFixed(2)),z:Number((Math.sin(angle)*radius).toFixed(2))};
}

export function generatePrivateWorld(seed){
  const rand=seededRandom(seed),objects=[];
  for(let i=0;i<38;i++){const p=point(rand,12,32);objects.push({id:`tree-${i}`,kind:'tree',x:p.x,z:p.z,scale:Number((.78+rand()*.5).toFixed(2))});}
  for(let i=0;i<14;i++){const p=point(rand,10,31);objects.push({id:`rock-${i}`,kind:'rock',x:p.x,z:p.z,scale:Number((.62+rand()*.52).toFixed(2))});}
  for(let i=0;i<12;i++){const p=point(rand,9,29);objects.push({id:`herb-${i}`,kind:'herbs',x:p.x,z:p.z,scale:1});}
  for(let i=0;i<7;i++){const p=point(rand,15,30);objects.push({id:`deer-${i}`,kind:'wildlife',species:'reed-runner',x:p.x,z:p.z,heading:Number((rand()*Math.PI*2).toFixed(3))});}
  return{
    version:2,
    size:70,
    spawn:{x:0,z:8},
    homestead:{x:0,z:3},
    structures:[],
    water:{kind:'pond',x:-19,z:-10,radius:6.5},
    farmland:{x:13,z:9,width:10,depth:8,fertility:Number((.72+rand()*.2).toFixed(2)),prepared:false},
    clearing:{x:0,z:4,radius:10},
    objects
  };
}

export function privateResourceSeeds(terrain){
  return (terrain?.objects||[]).flatMap(object=>{
    const rule=PRIVATE_RESOURCE_RULES[object.kind];
    if(!rule)return[];
    return[{
      nodeId:String(object.id),resourceType:rule.resource,x:Number(object.x),z:Number(object.z),
      maxAmount:rule.maxAmount,remaining:rule.maxAmount,generation:1,
      metadata:{objectKind:object.kind,regrowMinutes:rule.regrowMinutes}
    }];
  });
}

export function privateResourceView(rows){
  return (rows||[]).map(row=>{
    const view={
    nodeId:String(row.node_id??row.nodeId),resource:String(row.resource_type??row.resourceType),
    x:Number(row.x),z:Number(row.z),maxAmount:Number(row.max_amount??row.maxAmount),
    remaining:Number(row.remaining),regrowAt:row.regrow_at??row.regrowAt??null,
    generation:Number(row.generation||1)
    };if((row.metadata||{}).plant)view.plant=row.metadata.plant;if((row.metadata||{}).replacementAt)view.replacementAt=row.metadata.replacementAt;return view;
  });
}

export function initialPrivateEcology(seed){
  return{version:2,tick:0,worldHour:8,season:'Spring',seasonDay:1,weather:'clear',precipitationRate:0,temperatureC:13,wind:.22,treeCover:38,plantGrowth:.58,forage:.7,wildlife:7,soilMoisture:.64,drought:.18,snowCover:0,seed:Number(seed)||1};
}

export function synchronizePrivateLivingState(privateState,sharedWeather,sharedEcosystem){
  const local=structuredClone(privateState||initialPrivateEcology(1)),weather=sharedWeather||{},ecosystem=sharedEcosystem||{};
  const species=Array.isArray(ecosystem.species)?structuredClone(ecosystem.species):[];
  const plants=species.filter(item=>item.kind==='plant'),animals=species.filter(item=>item.kind!=='plant');
  const plantHealth=plants.length?plants.reduce((sum,item)=>{
    const life=item.lifeCycle||{};
    return sum+clamp(1-Number(life.waterStress||0)*.45-Number(life.grazingPressure||0)*.3,.25,1);
  },0)/plants.length:null;
  const animalPopulation=animals.reduce((sum,item)=>sum+Math.max(0,Number(item.population||0)),0);
  return{
    ...local,
    worldHour:Number.isFinite(Number(weather.worldHour))?Number(weather.worldHour):local.worldHour,
    season:weather.season||local.season,
    seasonDay:Number.isFinite(Number(weather.seasonDay))?Number(weather.seasonDay):local.seasonDay,
    weather:weather.precipitation||local.weather||'clear',
    precipitationRate:Number.isFinite(Number(weather.precipitationRate))?Number(weather.precipitationRate):local.precipitationRate,
    temperatureC:Number.isFinite(Number(weather.temperatureC))?Number(weather.temperatureC):local.temperatureC,
    wind:Number.isFinite(Number(weather.wind))?Number(weather.wind):local.wind,
    soilMoisture:Number.isFinite(Number(weather.soilMoisture))?Number(weather.soilMoisture):local.soilMoisture,
    drought:Number.isFinite(Number(weather.drought))?Number(weather.drought):local.drought,
    snowCover:Number.isFinite(Number(weather.snowCover))?Number(weather.snowCover):local.snowCover,
    plantGrowth:plantHealth===null?local.plantGrowth:Number(plantHealth.toFixed(3)),
    forage:plantHealth===null?local.forage:Number(clamp(plantHealth*(.7+Number(weather.soilMoisture||.5)*.3)-Number(weather.snowCover||0)*.18,.12,1).toFixed(3)),
    wildlife:animalPopulation||local.wildlife,
    species,
    plantPatches:structuredClone(Array.isArray(ecosystem.plantPatches)?ecosystem.plantPatches:[]),
    animalGroups:structuredClone(Array.isArray(ecosystem.animalGroups)?ecosystem.animalGroups:[]),
    sharedWeatherTick:Number(weather.tick||0),
    sharedEcologyYear:Number(ecosystem.simulatedYear||0)
  };
}

function privateLivingTransform(seed){
  const angle=((Math.abs(Number(seed)||1)%360)/180)*Math.PI;
  return{angle,cos:Math.cos(angle),sin:Math.sin(angle),scale:.9};
}

function privateLivingId(worldId,value){
  if(value===null||value===undefined||value==='')return value;
  return`private-${worldId}:${String(value)}`;
}

function privateLandPoint(x,z,terrain){
  const half=Math.max(4,Number(terrain?.size||70)/2-1.4);
  let px=clamp(Number(x),-half,half),pz=clamp(Number(z),-half,half);
  const water=terrain?.water;
  if(!water)return{x:px,z:pz};
  const dx=px-Number(water.x||0),dz=pz-Number(water.z||0),distance=Math.hypot(dx,dz),shore=Number(water.radius||0)+.65;
  if(distance>=shore)return{x:px,z:pz};
  const directionX=distance>.01?dx/distance:1,directionZ=distance>.01?dz/distance:0;
  px=clamp(Number(water.x||0)+directionX*shore,-half,half);
  pz=clamp(Number(water.z||0)+directionZ*shore,-half,half);
  return{x:px,z:pz};
}

export function privateObserverForLivingRenderer(observer,seed){
  const {cos,sin,scale}=privateLivingTransform(seed),x=Number(observer?.x||0)/scale,z=Number(observer?.z||0)/scale;
  return{x:Number((x*cos+z*sin).toFixed(4)),z:Number((-x*sin+z*cos).toFixed(4))};
}

export function privateLivingEntityView(entities,{worldId,seed,terrain}={}){
  const {angle,cos,sin,scale}=privateLivingTransform(seed);
  return(entities||[]).map(entity=>{
    const sourceX=Number(entity?.x||0),sourceZ=Number(entity?.z||0);
    const point=privateLandPoint((sourceX*cos-sourceZ*sin)*scale,(sourceX*sin+sourceZ*cos)*scale,terrain);
    const next={...entity,id:privateLivingId(worldId,entity.id),x:Number(point.x.toFixed(2)),z:Number(point.z.toFixed(2))};
    for(const key of['animalId','plantId','clusterId','foodTarget','consumedPlant','target']){
      if(typeof entity[key]==='string')next[key]=privateLivingId(worldId,entity[key]);
    }
    if(Number.isFinite(Number(entity.heading)))next.heading=Number((Number(entity.heading)+angle).toFixed(4));
    next.privateWorldId=String(worldId);
    return next;
  });
}

export function advancePrivateEcology(input,lastSimulatedAt,now=new Date()){
  const state=structuredClone(input||initialPrivateEcology(1));
  const upgraded=Number(state.version||1)<2;
  state.version=2;
  state.tick=Number(state.tick||0);
  state.seed=Number(state.seed)||1;
  state.season=state.season||'Spring';
  state.seasonDay=Number(state.seasonDay||1);
  state.worldHour=Number.isFinite(Number(state.worldHour))?Number(state.worldHour):8;
  state.precipitationRate=Number(state.precipitationRate||0);
  state.temperatureC=Number.isFinite(Number(state.temperatureC))?Number(state.temperatureC):13;
  state.wind=Number.isFinite(Number(state.wind))?Number(state.wind):.22;
  state.plantGrowth=Number.isFinite(Number(state.plantGrowth))?Number(state.plantGrowth):.58;
  state.forage=Number.isFinite(Number(state.forage))?Number(state.forage):.7;
  state.treeCover=Number.isFinite(Number(state.treeCover))?Number(state.treeCover):38;
  state.wildlife=Number.isFinite(Number(state.wildlife))?Number(state.wildlife):7;
  state.soilMoisture=Number.isFinite(Number(state.soilMoisture))?Number(state.soilMoisture):.64;
  state.drought=Number.isFinite(Number(state.drought))?Number(state.drought):.18;
  state.snowCover=Number(state.snowCover||0);
  const from=Date.parse(lastSimulatedAt||now);
  const elapsedMs=Math.max(0,now.getTime()-(Number.isFinite(from)?from:now.getTime()));
  const requestedSteps=Math.floor(elapsedMs/(6*60*60*1000));
  const steps=Math.min(120,requestedSteps);
  const rand=seededRandom((Number(state.seed)||1)+(Number(state.tick)||0));
  const seasons=['Spring','Summer','Autumn','Winter'];
  for(let i=0;i<steps;i++){
    state.tick=Number(state.tick||0)+1;
    state.worldHour=(Number(state.worldHour||0)+6)%24;
    state.seasonDay=Number(state.seasonDay||1)+.25;
    if(state.seasonDay>30){state.seasonDay=.25;state.season=seasons[(seasons.indexOf(state.season)+1)%4]||'Spring';}
    const rainChance={Spring:.45,Summer:.25,Autumn:.38,Winter:.22}[state.season]??.3;
    const weatherRoll=rand();
    const seasonalBase={Spring:13,Summer:24,Autumn:14,Winter:2}[state.season]??13;
    const diurnal=Math.sin((state.worldHour-7)/24*Math.PI*2)*5;
    state.temperatureC=Number((seasonalBase+diurnal+(rand()-.5)*3).toFixed(1));
    state.weather=weatherRoll<rainChance*.18?(state.temperatureC<=1?'snow':'heavy rain'):weatherRoll<rainChance?(state.temperatureC<=1?'snow':'rain'):'clear';
    state.precipitationRate=state.weather==='heavy rain'?.85:state.weather==='rain'?.42:state.weather==='snow'?.32:0;
    state.wind=Number(clamp(.08+rand()*.72,.05,1).toFixed(2));
    const moistureGain=state.precipitationRate*.1,drying=Math.max(0,state.temperatureC-9)/190+state.wind*.014;
    state.soilMoisture=Number(clamp(Number(state.soilMoisture||.6)+moistureGain-drying,.08,1).toFixed(3));
    state.drought=Number(clamp((1-state.soilMoisture)*.78+Math.max(0,state.temperatureC-22)/38,.02,1).toFixed(3));
    state.snowCover=Number(clamp(Number(state.snowCover||0)+(state.weather==='snow'?.18:0)-Math.max(0,state.temperatureC)*.025,0,1).toFixed(2));
    const growthBias={Spring:.018,Summer:.01,Autumn:-.006,Winter:-.012}[state.season]??0;
    state.plantGrowth=Number(clamp(Number(state.plantGrowth||.58)+growthBias+state.soilMoisture*.006-state.drought*.007,.25,1).toFixed(3));
    state.forage=Number(clamp(state.plantGrowth*(.65+state.soilMoisture*.35)-state.snowCover*.18,.12,1).toFixed(3));
    if(state.tick%4===0){const wildlifeDelta=state.forage>.55&&rand()>.62?1:state.forage<.3&&rand()>.45?-1:0;state.wildlife=Math.max(2,Number(state.wildlife||7)+wildlifeDelta);}
    if(state.tick%8===0&&state.plantGrowth>.72&&rand()>.55)state.treeCover=Math.min(55,Number(state.treeCover||38)+1);
  }
  return{state,steps,requestedSteps,capped:requestedSteps>steps,upgraded,simulatedUntil:new Date((Number.isFinite(from)?from:now.getTime())+steps*6*60*60*1000).toISOString()};
}

export function ownsWorld(requesterPlayerId,ownerPlayerId){return String(requesterPlayerId)===String(ownerPlayerId);}

export function normalizePosition(x,z,fallback={x:0,z:8}){
  return{x:clamp(Number.isFinite(Number(x))?Number(x):fallback.x,-33,33),z:clamp(Number.isFinite(Number(z))?Number(z):fallback.z,-33,33)};
}
