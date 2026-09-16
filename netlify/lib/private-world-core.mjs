const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

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
    version:1,
    size:70,
    spawn:{x:0,z:8},
    homestead:{x:0,z:3},
    water:{kind:'pond',x:-19,z:-10,radius:6.5},
    farmland:{x:13,z:9,width:10,depth:8,fertility:Number((.72+rand()*.2).toFixed(2))},
    clearing:{x:0,z:4,radius:10},
    objects
  };
}

export function initialPrivateEcology(seed){
  return{version:1,tick:0,season:'Spring',seasonDay:1,weather:'clear',treeCover:38,wildlife:7,soilMoisture:.64,seed:Number(seed)||1};
}

export function advancePrivateEcology(input,lastSimulatedAt,now=new Date()){
  const state=structuredClone(input||initialPrivateEcology(1));
  const from=Date.parse(lastSimulatedAt||now);
  const elapsedMs=Math.max(0,now.getTime()-(Number.isFinite(from)?from:now.getTime()));
  const requestedSteps=Math.floor(elapsedMs/(6*60*60*1000));
  const steps=Math.min(120,requestedSteps);
  const rand=seededRandom((Number(state.seed)||1)+(Number(state.tick)||0));
  const seasons=['Spring','Summer','Autumn','Winter'];
  for(let i=0;i<steps;i++){
    state.tick=Number(state.tick||0)+1;
    state.seasonDay=Number(state.seasonDay||1)+.25;
    if(state.seasonDay>30){state.seasonDay=.25;state.season=seasons[(seasons.indexOf(state.season)+1)%4]||'Spring';}
    const rainChance={Spring:.45,Summer:.25,Autumn:.38,Winter:.22}[state.season]??.3;
    state.weather=rand()<rainChance?'rain':'clear';
    state.soilMoisture=Number(clamp(Number(state.soilMoisture||.6)+(state.weather==='rain'?.035:-.012),.08,1).toFixed(3));
  }
  return{state,steps,requestedSteps,capped:requestedSteps>steps,simulatedUntil:new Date((Number.isFinite(from)?from:now.getTime())+steps*6*60*60*1000).toISOString()};
}

export function ownsWorld(requesterPlayerId,ownerPlayerId){return String(requesterPlayerId)===String(ownerPlayerId);}

export function normalizePosition(x,z,fallback={x:0,z:8}){
  return{x:clamp(Number.isFinite(Number(x))?Number(x):fallback.x,-33,33),z:clamp(Number.isFinite(Number(z))?Number(z):fallback.z,-33,33)};
}
