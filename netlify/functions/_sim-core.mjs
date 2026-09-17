const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function noise(seed){const x=Math.sin(Number(seed||0)*999.91)*43758.5453;return x-Math.floor(x);}

export function initialWeather(){return{version:1,tick:0,worldHour:8,worldDay:1,season:'Spring',seasonDay:1,temperatureC:12,precipitation:'clear',precipitationRate:0,wind:0.22,soilMoisture:0.62,drought:0.18,snowDepthCm:0,snowCover:0,lastTickAt:null};}

export function advanceWeather(input,hours=1){const s=structuredClone(input||initialWeather());const steps=Math.max(1,Math.min(24,Math.floor(hours||1)));for(let n=0;n<steps;n++){s.tick=Number(s.tick||0)+1;s.worldHour=(Number(s.worldHour||0)+6)%24;if(s.worldHour===2){s.worldDay=Number(s.worldDay||1)+1;s.seasonDay=Number(s.seasonDay||1)+1;if(s.seasonDay>30){s.seasonDay=1;const seasons=['Spring','Summer','Autumn','Winter'];s.season=seasons[(seasons.indexOf(s.season)+1)%4]||'Spring';}}
const seasonal={Spring:13,Summer:23,Autumn:14,Winter:2}[s.season]??13;const diurnal=Math.sin((s.worldHour-7)/24*Math.PI*2)*5;const jitter=(noise(s.tick*3.7)-.5)*3;s.temperatureC=round(seasonal+diurnal+jitter,1);const wetBias={Spring:.42,Summer:.22,Autumn:.34,Winter:.28}[s.season]??.3;const roll=noise(s.tick*7.31);s.precipitation=roll<wetBias*.22?(s.temperatureC<=1?'snow':'heavy rain'):roll<wetBias?(s.temperatureC<=1?'snow':'rain'):'clear';s.precipitationRate=s.precipitation==='heavy rain'?.85:s.precipitation==='rain'?.42:s.precipitation==='snow'?.32:0;s.wind=round(clamp(.08+noise(s.tick*4.91)*.72,0,1),2);const moistureGain=s.precipitationRate*.11;const drying=Math.max(0,s.temperatureC-8)/180+s.wind*.018;s.soilMoisture=round(clamp(Number(s.soilMoisture||.6)+moistureGain-drying,.05,1),3);s.drought=round(clamp((1-s.soilMoisture)*.8+Math.max(0,s.temperatureC-20)/35,.02,1),3);const oldSnow=Number(s.snowDepthCm||0);const snowfall=s.precipitation==='snow'?s.precipitationRate*4.5:0;const warmMelt=Math.max(0,s.temperatureC)*.38;const rainMelt=s.precipitation.includes('rain')?s.precipitationRate*1.8:0;s.snowDepthCm=round(clamp(oldSnow+snowfall-warmMelt-rainMelt,0,80),1);s.snowCover=round(clamp(s.snowDepthCm/12,0,1),2);}
s.lastTickAt=new Date().toISOString();return s;}

export function initialDisasters(){return{version:1,tick:0,risks:{wildfire:.05,flood:.04,severeStorm:.04,disease:.03},active:[],history:[],mitigation:{habitatCare:0,brushCleared:0,response:0},lastTickAt:null};}

export function advanceDisasters(input,weather,ecosystem){const s=structuredClone(input||initialDisasters());s.tick=Number(s.tick||0)+1;const w=weather||initialWeather();const species=Array.isArray(ecosystem?.species)?ecosystem.species:[];const animals=species.filter(x=>x.kind!=='plant').reduce((a,x)=>a+Number(x.population||0),0);const plants=species.filter(x=>x.kind==='plant').reduce((a,x)=>a+Number(x.population||0),0);const mitigation=s.mitigation||{};s.risks={wildfire:round(clamp(Number(w.drought||0)*.72+Number(w.wind||0)*.22-Math.min(.18,Number(mitigation.brushCleared||0)*.004),0,1),3),flood:round(clamp(Number(w.soilMoisture||0)*.52+Number(w.precipitationRate||0)*.58-.34,0,1),3),severeStorm:round(clamp(Number(w.wind||0)*.58+Number(w.precipitationRate||0)*.42-.24,0,1),3),disease:round(clamp(animals/6500+Math.max(0,1-Number(w.soilMoisture||.5))*.12+(plants<5000?.12:0),0,1),3)};
const active=Array.isArray(s.active)?s.active:[];for(const d of active){d.remainingTicks=Math.max(0,Number(d.remainingTicks||1)-1);d.response=Math.max(0,Number(d.response||0));if(d.response>0)d.severity=round(clamp(Number(d.severity||.5)-d.response*.025,.1,1),2);}s.active=active.filter(d=>d.remainingTicks>0&&Number(d.severity||0)>.12);
if(!s.active.length){const order=[['wildfire',s.risks.wildfire],['flood',s.risks.flood],['severeStorm',s.risks.severeStorm],['disease',s.risks.disease]].sort((a,b)=>b[1]-a[1]);const [type,risk]=order[0];const trigger=noise(s.tick*19.17+String(type).length*3.1);if(risk>.55&&trigger>.92){const event={id:`${type}-${s.tick}`,type,severity:round(clamp(risk*.75+noise(s.tick*2.3)*.2,.25,1),2),startedTick:s.tick,remainingTicks:3+Math.floor(noise(s.tick*8.4)*5),response:0};s.active.push(event);s.history=[...(Array.isArray(s.history)?s.history:[]),{...event}].slice(-20);}}
s.lastTickAt=new Date().toISOString();return s;}

function hash01(text){let h=2166136261;for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619);}return((h>>>0)%100000)/100000;}
export function ecologyHabitatZones(h,seed=0){
 h=String(h||'').toLowerCase();const j=(Number(seed||0)-.5)*2;
 if(h.includes('river')||h.includes('wet'))return[{x:-17+j,z:-21,rx:5,rz:10},{x:-17-j,z:1,rx:5,rz:11},{x:-17+j*.5,z:22,rx:5,rz:9},{x:-29,z:8+j*4,rx:3.5,rz:14}];
 if(h.includes('ridge')||h.includes('upland'))return[{x:24,z:-21+j*2,rx:8,rz:8},{x:27-j,z:1,rx:6,rz:11},{x:23,z:22-j*2,rx:8,rz:8},{x:10+j*2,z:-26,rx:10,rz:5}];
 if(h.includes('scrub')||h.includes('dry'))return[{x:11+j*2,z:23,rx:10,rz:7},{x:27,z:11-j*2,rx:6,rz:10},{x:23-j*2,z:-17,rx:8,rz:9},{x:-5,z:-25+j*2,rx:11,rz:6}];
 return[{x:-10+j*2,z:23,rx:10,rz:7},{x:14,z:24-j*2,rx:10,rz:7},{x:26-j*2,z:7,rx:7,rz:11},{x:20,z:-20+j*2,rx:10,rz:8},{x:-8-j*2,z:-24,rx:11,rz:6}];
}
function habitat(h,seed){const zones=ecologyHabitatZones(h,seed),index=Math.floor(hash01(`${h}:${seed}:zone`)*zones.length)%zones.length;return zones[index];}
function outsideTown(x,z,key,minRadius=12.5){const d=Math.hypot(x,z);if(d>=minRadius)return{x,z};const angle=d>.01?Math.atan2(z,x):hash01(`${key}:angle`)*Math.PI*2;return{x:Math.cos(angle)*(minRadius+hash01(`${key}:edge`)*3),z:Math.sin(angle)*(minRadius+hash01(`${key}:edge-z`)*3)};}
const ANIMAL_LIMIT=31.2,RIVER_LEFT=-29,RIVER_RIGHT=-19,BRIDGE_HALF_WIDTH=1.45;
export function animalLandPoint(x,z,key='animal'){
 x=clamp(x,-ANIMAL_LIMIT,ANIMAL_LIMIT);z=clamp(z,-ANIMAL_LIMIT,ANIMAL_LIMIT);
 if(x>RIVER_LEFT&&x<RIVER_RIGHT&&Math.abs(z)>BRIDGE_HALF_WIDTH){
  const bank=x<(RIVER_LEFT+RIVER_RIGHT)/2?RIVER_LEFT-.25:RIVER_RIGHT+.25;
  x=bank;
 }
 return{x:round(x,4),z:round(z,4)};
}
export function animalLandRoute(from,target,progress,key='animal-route'){
 const start=animalLandPoint(from?.x,from?.z,`${key}:start`),end=animalLandPoint(target?.x,target?.z,`${key}:end`),q=clamp(progress,0,1);
 const crossesWest=start.x<=RIVER_LEFT&&end.x>=RIVER_RIGHT,crossesEast=start.x>=RIVER_RIGHT&&end.x<=RIVER_LEFT;
 if(!crossesWest&&!crossesEast)return animalLandPoint(start.x+(end.x-start.x)*q,start.z+(end.z-start.z)*q,key);
 const entry={x:crossesWest?RIVER_LEFT-.25:RIVER_RIGHT+.25,z:0},exit={x:crossesWest?RIVER_RIGHT+.25:RIVER_LEFT-.25,z:0};
 let a,b,local;
 if(q<.38){a=start;b=entry;local=q/.38;}
 else if(q<.62){a=entry;b=exit;local=(q-.38)/.24;}
 else{a=exit;b=end;local=(q-.62)/.38;}
 return animalLandPoint(a.x+(b.x-a.x)*local,a.z+(b.z-a.z)*local,key);
}
function habitatPoint(h,key,spread=1){const seed=hash01(key),zones=ecologyHabitatZones(h,seed),zone=zones[Math.floor(hash01(`${key}:zone`)*zones.length)%zones.length],angle=hash01(`${key}:angle`)*Math.PI*2,radius=Math.sqrt(hash01(`${key}:radius`))*spread;return outsideTown(zone.x+Math.cos(angle)*zone.rx*radius,zone.z+Math.sin(angle)*zone.rz*radius,key);}
function part(out,id,x,z,width,height,depth,color,extra={}){out.push({id:String(id).slice(0,80),type:'object',x:round(x,2),z:round(z,2),width:round(width,2),height:round(height,2),depth:round(depth,2),color,...extra});}

function plantCluster(out,s,i,x,z,size){const base=`eco-plant-${s.id}-${i}`,name=s.name||String(s.id||'plant').replaceAll('-',' '),clusterId=base;if(s.id==='rivergrass'){
 const green='#79a85b',dark='#426f3d',seed='#d8bd62',meta={species:s.id,speciesName:name,clusterId};
 part(out,`${base}-center`,x,z,size*.34,.9+size*1.8,size*.34,green,{...meta,part:'blade'});
 part(out,`${base}-left`,x-size*.38,z+size*.14,size*.24,.62+size*1.35,size*.24,dark,{...meta,part:'blade'});
 part(out,`${base}-right`,x+size*.38,z-size*.12,size*.24,.68+size*1.48,size*.24,green,{...meta,part:'blade'});
 part(out,`${base}-seed`,x+.03,z-.03,size*.42,.22,size*.42,seed,{...meta,part:'flower'});
 return;
 }
 const leaf='#436f37',bright='#698d43',branch='#684b32',berry='#b45f45',meta={species:s.id,speciesName:name,clusterId};
 part(out,`${base}-stem`,x,z,size*.32,.68+size*.95,size*.32,branch,{...meta,part:'stem'});
 part(out,`${base}-crown`,x,z,size*1.5,.7+size*1.05,size*1.35,leaf,{...meta,part:'crown'});
 part(out,`${base}-side`,x+size*.58,z-size*.25,size*.9,.5+size*.72,size*.82,bright,{...meta,part:'crown'});
 part(out,`${base}-berries`,x-size*.28,z+size*.2,size*.48,.34,size*.48,berry,{...meta,part:'flower'});
}

function animalParts(out,s,i,x,z,body,heading,behavior='roaming'){const predator=s.kind==='predator';const runner=s.id==='reed-runner';const color=predator?'#6b4d38':runner?'#b39a67':'#96784e';const bodyLen=predator?body*1.75:runner?body*1.35:body*1.55,bodyWide=predator?body*.62:runner?body*.48:body*.72,bodyHigh=predator?body*.62:runner?body*.7:body*.82;part(out,`eco-animal-${s.id}-${i}`,x,z,bodyLen,bodyHigh,bodyWide,color,{species:s.id,animalId:`${s.id}-${i}`,behavior,part:'creature',kind:s.kind,heading:round(heading,4),bodyScale:round(body,3)});}

function motionTick(frame,phase,feeding){if(!feeding)return frame;const offset=Math.floor(phase*20);const local=frame+offset;const cycle=24,move=18;const effective=Math.floor(local/cycle)*move+Math.min(local%cycle,move);return effective-offset;}
function animalPosition(s,i,frame,weather,forestPressure=null){const need=s.needs||{},goal=String(s.goal||'');const season=String(weather?.season||'Spring');const phase=hash01(`${s.id}:phase:${i}`)*Math.PI*2,seed=hash01(s.id||s.name||'species'),zones=ecologyHabitatZones(s.habitat,seed);const predator=s.kind==='predator';const runner=s.id==='reed-runner';const cycle=(frame+Math.floor(hash01(`${s.id}:feed:${i}`)*24))%24;const feeding=!predator&&cycle>=18;const mt=motionTick(frame,phase,feeding);const weatherSlow=1-clamp(Number(weather?.precipitationRate||0)*.45+Number(weather?.wind||0)*.12,0,.55);const hunted=Boolean(s.lastHunt&&Number(s.lastHunt.year)>=(Number(s.bornYear||0)));const needBoost=goal.includes('hunt')?1.3:goal.includes('water')||goal.includes('predator')?1.22:goal.includes('rest')?.72:hunted?.92:1;const speed=(predator?.038:runner?.05:.034)*weatherSlow*needBoost;const step=mt*speed,route=(frame/110+hash01(`${s.id}:route:${i}`)*zones.length),routeIndex=Math.floor(route)%zones.length,nextIndex=(routeIndex+1)%zones.length,q=route-Math.floor(route),smooth=q*q*(3-2*q),from=zones[routeIndex],to=zones[nextIndex],center=animalLandRoute(from,to,smooth,`${s.id}:${i}:${routeIndex}:roam`),area={x:center.x,z:center.z,rx:from.rx+(to.rx-from.rx)*smooth,rz:from.rz+(to.rz-from.rz)*smooth};const seasonIndex={Spring:0,Summer:1,Autumn:2,Winter:3}[season]??0,migrate=zones[(seasonIndex+i)%zones.length];let x=clamp(area.x+Math.sin(step+phase)*area.rx*.48,-32,32),z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.48,-32,32);const migrationStrength=s.kind==='herbivore'?.12:.07;x=x+(migrate.x-x)*migrationStrength;z=z+(migrate.z-z)*migrationStrength;const forestShift=clamp(Number(forestPressure?.pressure||0)/100,0,1);if(forestShift>=.20){const refuge=zones[(routeIndex+2)%zones.length],pull=forestShift*(s.kind==='herbivore'?.24:.16);x=x+(refuge.x-x)*pull;z=z+(refuge.z-z)*pull;}if(goal.includes('water')){const water=ecologyHabitatZones('riverbank',seed)[(i+routeIndex)%4];x=x+(water.x-x)*.16;z=z+(water.z-z)*.16;}if(center.x>RIVER_LEFT&&center.x<RIVER_RIGHT){x=center.x;z=clamp(z,-BRIDGE_HALF_WIDTH+.1,BRIDGE_HALF_WIDTH-.1);}const safe=outsideTown(x,z,`${s.id}:${i}:${frame}`,11.5),land=animalLandPoint(safe.x,safe.z,`${s.id}:${i}:${frame}`);return{phase,area,feeding:feeding&&Number(need.hunger||0)<.7,x:land.x,z:land.z,season,forestShift};}

export function ecologyRenderEntities(ecosystem,now=Date.now(),weather=null,observer=null,forestPressure=null){
 const disturbance=ecosystem?.disturbance||{};const last=(disturbance.history||[]).slice(-1)[0]||null;
 const species=Array.isArray(ecosystem?.species)?ecosystem.species:[],out=[],plantParts=[],plantFoods=[],animals=[];const frame=Math.floor(now/800),ox=Number(observer?.x),oz=Number(observer?.z);
 for(const s of species.filter(item=>item.kind==='plant'&&Number(item.population||0)>0)){const pop=Math.max(0,Number(s.population||0)),life=s.lifeCycle||{},health=clamp(1-Number(life.waterStress||0)*.45-Number(life.grazingPressure||0)*.3,.2,1),count=Math.max(1,Math.min(28,Math.round(Math.sqrt(pop)/6*health)));
  for(let i=0;i<count;i++){const point=habitatPoint(s.habitat,`${s.id}:plant:${i}`,1),breeze=Number(weather?.wind||0)*.12*Math.sin(frame*.18+i),safe=outsideTown(point.x+breeze,point.z,`${s.id}:plant:${i}:wind`),x=clamp(safe.x,-32,32),z=clamp(safe.z,-32,32),size=(.35+hash01(`${s.id}:s:${i}`)*.5)*(.65+health*.45),parts=[];plantCluster(parts,s,i,x,z,size);plantParts.push(...parts);plantFoods.push({id:`eco-plant-${s.id}-${i}`,species:s.id,x,z});}
 }
 const herbivoreRecords=[];
 for(const s of species.filter(item=>item.kind==='herbivore'&&Number(item.population||0)>0)){const pop=Number(s.population||0),count=Math.max(1,Math.min(9,Math.round(pop/65)));
  for(let i=0;i<count;i++){const base=animalPosition(s,i,frame,weather,forestPressure),nextBase=animalPosition(s,i,frame+1,weather,forestPressure),epoch=Math.floor((frame+Math.floor(hash01(`${s.id}:${i}:meal`)*70))/70),local=(frame+Math.floor(hash01(`${s.id}:${i}:meal`)*70))%70,target=plantFoods.length?plantFoods[Math.floor(hash01(`${s.id}:${i}:${epoch}:food`)*plantFoods.length)%plantFoods.length]:null;let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior=base.forestShift>=.2?'migrating':'roaming';
   if(target&&local>=18){const q=clamp((local-18)/24,0,1),smooth=q*q*(3-2*q),position=animalLandRoute(base,target,smooth,`${s.id}:${i}:${epoch}:food`),next=animalLandRoute(base,target,clamp(smooth+.04,0,1),`${s.id}:${i}:${epoch}:food-next`);x=position.x;z=position.z;nx=next.x;nz=next.z;behavior=local>=42?'feeding':'seeking food';}
   if(Number.isFinite(ox)&&Number.isFinite(oz)){const dx=x-ox,dz=z-oz,d=Math.hypot(dx,dz);if(d<7){const force=(7-d)/7*5;x=clamp(x+(dx/(d||1))*force,-32,32);z=clamp(z+(dz/(d||1))*force,-32,32);behavior='fleeing';}}
   const safe=outsideTown(x,z,`${s.id}:${i}:${frame}:feeding`,11.5),land=animalLandPoint(safe.x,safe.z,`${s.id}:${i}:${frame}:feeding`),nextLand=animalLandPoint(nx,nz,`${s.id}:${i}:${frame}:feeding-next`);x=land.x;z=land.z;nx=nextLand.x;nz=nextLand.z;const record={s,i,x,z,nx,nz,behavior,target,consumedPlant:target&&local>=58?target.id:null,id:`${s.id}-${i}`};herbivoreRecords.push(record);animals.push(record);}
 }
 const killedPrey=new Set();
 for(const s of species.filter(item=>item.kind==='predator'&&Number(item.population||0)>0)){const pop=Number(s.population||0),count=Math.max(1,Math.min(5,Math.round(pop/14)));
  for(let i=0;i<count;i++){const base=animalPosition(s,i,frame,weather,forestPressure),nextBase=animalPosition(s,i,frame+1,weather,forestPressure),offset=Math.floor(hash01(`${s.id}:${i}:hunt`)*110),epoch=Math.floor((frame+offset)/110),local=(frame+offset)%110,prey=herbivoreRecords.length?herbivoreRecords[Math.floor(hash01(`${s.id}:${i}:${epoch}:prey`)*herbivoreRecords.length)%herbivoreRecords.length]:null;let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior='patrolling';
   if(prey&&local>=38){const q=clamp((local-38)/52,0,1),smooth=q*q*(3-2*q),position=animalLandRoute(base,prey,smooth,`${s.id}:${i}:${epoch}:hunt`),next=animalLandRoute(base,prey,clamp(smooth+.04,0,1),`${s.id}:${i}:${epoch}:hunt-next`);x=position.x;z=position.z;nx=next.x;nz=next.z;behavior=local>=90?'feeding':'stalking';if(local>=98)killedPrey.add(prey.id);}
   {const safe=outsideTown(x,z,`${s.id}:${i}:${frame}:hunting`,11.5),land=animalLandPoint(safe.x,safe.z,`${s.id}:${i}:${frame}:hunting`),nextLand=animalLandPoint(nx,nz,`${s.id}:${i}:${frame}:hunting-next`);x=land.x;z=land.z;nx=nextLand.x;nz=nextLand.z;}animals.push({s,i,x,z,nx,nz,behavior,target:prey?.id||null});}
 }
 const eatenPlants=new Set(herbivoreRecords.map(record=>record.consumedPlant).filter(Boolean));out.push(...plantParts.filter(entity=>!eatenPlants.has(entity.clusterId)));
 for(const record of animals){if(record.s.kind==='herbivore'&&killedPrey.has(record.id))continue;const heading=Math.atan2(record.nz-record.z,record.nx-record.x),body=.65+clamp(Number(record.s.traits?.size||.4),0,1)*.8,before=out.length;animalParts(out,record.s,record.i,record.x,record.z,body,heading,record.behavior);const entity=out[before];if(entity){entity.foodWeb=true;entity.foodTarget=record.target?.id||record.target||null;entity.consumedPlant=record.consumedPlant||null;entity.preyKilled=record.s.kind==='predator'&&record.behavior==='feeding';}}
 // Persistent-looking seasonal game trails derived deterministically from current ecology and season.
 if(last?.type==='wildfire'){for(let i=0;i<8;i++)part(out,`eco-burn-scar-${i}`,-2+i*2.1,10+(i%2)*1.2,1.8,.03,1.3,'#3f392f',{part:'burn-scar',disaster:last.id});}
 if(last?.type==='flood'){for(let i=0;i<6;i++)part(out,`eco-flood-mark-${i}`,-20+i*.8,-5+i*2.3,.7,.04,1.4,'#526f73',{part:'flood-mark',disaster:last.id});}
 const patches=Array.isArray(ecosystem?.plantPatches)?ecosystem.plantPatches:[];for(const p of patches.slice(-24)){const count=Math.max(1,Math.min(4,Math.ceil(Number(p.population||0)/250))),speciesName=species.find(s=>s.id===p.speciesId)?.name||String(p.speciesId||'new plant patch').replaceAll('-',' ');for(let n=0;n<count;n++){const a=habitatPoint(p.habitat,`${p.id}:patch:${n}`,.72),color=p.speciesId==='rivergrass'?'#83a653':'#597b3f';part(out,`eco-patch-${p.id}-${n}`,a.x,a.z,.72,.28,.72,color,{part:'plant-patch',species:p.speciesId,speciesName,stage:p.stage,habitat:p.habitat});}}
 const groups=Array.isArray(ecosystem?.animalGroups)?ecosystem.animalGroups:[];for(const g of groups){const a=habitatPoint(g.habitat,`${g.id}:home`,.42),pred=g.type==='pack';part(out,`eco-home-${g.id}`,a.x,a.z,pred?1.1:1.35,pred?.35:.12,pred?1.1:1.35,pred?'#51443a':'#7b6849',{part:g.shelterType,species:g.speciesId,group:g.type,groups:g.groups,young:g.young||0});}
 const season=String(weather?.season||'Spring');
 for(const s of species.filter(x=>x.kind!=='plant'&&Number(x.population||0)>0)){
  const seed=hash01(s.id||s.name),zones=ecologyHabitatZones(s.habitat,seed),a=zones[0],target=zones[({Spring:1,Summer:2,Autumn:3,Winter:4}[season]??1)%zones.length];
  for(let n=1;n<=3;n++){const q=n/4,x=a.x+(target.x-a.x)*q,z=a.z+(target.z-a.z)*q;part(out,`eco-trail-${s.id}-${n}`,x,z,1.4,.025,.5,'#776b52',{species:s.id,part:'trail',season});}
 }
 return out;
}

export function simulationSummary(world={}){return{ecology:world.ecosystem||null,weather:world.weather_sim||null,disasters:world.disaster_sim||null,narrativeDay:world.current_day||null};}
