const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const round=(v,d=2)=>Number(Number(v).toFixed(d));

export function noise(seed){const x=Math.sin(Number(seed||0)*999.91)*43758.5453;return x-Math.floor(x);}

export function initialWeather(){return{version:1,tick:0,worldHour:8,worldDay:1,season:'Spring',seasonDay:1,temperatureC:12,precipitation:'clear',precipitationRate:0,wind:0.22,soilMoisture:0.62,drought:0.18,lastTickAt:null};}

export function advanceWeather(input,hours=1){const s=structuredClone(input||initialWeather());const steps=Math.max(1,Math.min(24,Math.floor(hours||1)));for(let n=0;n<steps;n++){s.tick=Number(s.tick||0)+1;s.worldHour=(Number(s.worldHour||0)+6)%24;if(s.worldHour===2){s.worldDay=Number(s.worldDay||1)+1;s.seasonDay=Number(s.seasonDay||1)+1;if(s.seasonDay>30){s.seasonDay=1;const seasons=['Spring','Summer','Autumn','Winter'];s.season=seasons[(seasons.indexOf(s.season)+1)%4]||'Spring';}}
const seasonal={Spring:13,Summer:23,Autumn:14,Winter:2}[s.season]??13;const diurnal=Math.sin((s.worldHour-7)/24*Math.PI*2)*5;const jitter=(noise(s.tick*3.7)-.5)*3;s.temperatureC=round(seasonal+diurnal+jitter,1);const wetBias={Spring:.42,Summer:.22,Autumn:.34,Winter:.28}[s.season]??.3;const roll=noise(s.tick*7.31);s.precipitation=roll<wetBias*.22?(s.temperatureC<=1?'snow':'heavy rain'):roll<wetBias?(s.temperatureC<=1?'snow':'rain'):'clear';s.precipitationRate=s.precipitation==='heavy rain'?.85:s.precipitation==='rain'?.42:s.precipitation==='snow'?.32:0;s.wind=round(clamp(.08+noise(s.tick*4.91)*.72,0,1),2);const moistureGain=s.precipitationRate*.11;const drying=Math.max(0,s.temperatureC-8)/180+s.wind*.018;s.soilMoisture=round(clamp(Number(s.soilMoisture||.6)+moistureGain-drying,.05,1),3);s.drought=round(clamp((1-s.soilMoisture)*.8+Math.max(0,s.temperatureC-20)/35,.02,1),3);}
s.lastTickAt=new Date().toISOString();return s;}

export function initialDisasters(){return{version:1,tick:0,risks:{wildfire:.05,flood:.04,severeStorm:.04,disease:.03},active:[],history:[],mitigation:{habitatCare:0,brushCleared:0,response:0},lastTickAt:null};}

export function advanceDisasters(input,weather,ecosystem){const s=structuredClone(input||initialDisasters());s.tick=Number(s.tick||0)+1;const w=weather||initialWeather();const species=Array.isArray(ecosystem?.species)?ecosystem.species:[];const animals=species.filter(x=>x.kind!=='plant').reduce((a,x)=>a+Number(x.population||0),0);const plants=species.filter(x=>x.kind==='plant').reduce((a,x)=>a+Number(x.population||0),0);const mitigation=s.mitigation||{};s.risks={wildfire:round(clamp(Number(w.drought||0)*.72+Number(w.wind||0)*.22-Math.min(.18,Number(mitigation.brushCleared||0)*.004),0,1),3),flood:round(clamp(Number(w.soilMoisture||0)*.52+Number(w.precipitationRate||0)*.58-.34,0,1),3),severeStorm:round(clamp(Number(w.wind||0)*.58+Number(w.precipitationRate||0)*.42-.24,0,1),3),disease:round(clamp(animals/6500+Math.max(0,1-Number(w.soilMoisture||.5))*.12+(plants<5000?.12:0),0,1),3)};
const active=Array.isArray(s.active)?s.active:[];for(const d of active){d.remainingTicks=Math.max(0,Number(d.remainingTicks||1)-1);d.response=Math.max(0,Number(d.response||0));if(d.response>0)d.severity=round(clamp(Number(d.severity||.5)-d.response*.025,.1,1),2);}s.active=active.filter(d=>d.remainingTicks>0&&Number(d.severity||0)>.12);
if(!s.active.length){const order=[['wildfire',s.risks.wildfire],['flood',s.risks.flood],['severeStorm',s.risks.severeStorm],['disease',s.risks.disease]].sort((a,b)=>b[1]-a[1]);const [type,risk]=order[0];const trigger=noise(s.tick*19.17+String(type).length*3.1);if(risk>.55&&trigger>.92){const event={id:`${type}-${s.tick}`,type,severity:round(clamp(risk*.75+noise(s.tick*2.3)*.2,.25,1),2),startedTick:s.tick,remainingTicks:3+Math.floor(noise(s.tick*8.4)*5),response:0};s.active.push(event);s.history=[...(Array.isArray(s.history)?s.history:[]),{...event}].slice(-20);}}
s.lastTickAt=new Date().toISOString();return s;}

function hash01(text){let h=2166136261;for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619);}return((h>>>0)%100000)/100000;}
function habitat(h,seed){h=String(h||'').toLowerCase();if(h.includes('river'))return{x:-16+seed*3,z:-8+seed*20,rx:5,rz:11};if(h.includes('ridge')||h.includes('upland'))return{x:18,z:-5+seed*14,rx:9,rz:8};if(h.includes('scrub'))return{x:9,z:14,rx:11,rz:7};return{x:4,z:5,rx:13,rz:12};}
function part(out,id,x,z,width,height,depth,color,extra={}){out.push({id:String(id).slice(0,80),type:'object',x:round(x,2),z:round(z,2),width:round(width,2),height:round(height,2),depth:round(depth,2),color,...extra});}

function plantCluster(out,s,i,x,z,size){const base=`eco-plant-${s.id}-${i}`;if(s.id==='rivergrass'){
 const green='#6f9b55',dark='#4f7b43';
 part(out,`${base}-center`,x,z,size*.28,.75+size*1.6,size*.28,green,{species:s.id,part:'blade'});
 part(out,`${base}-left`,x-size*.3,z+size*.12,size*.2,.48+size*1.2,size*.2,dark,{species:s.id,part:'blade'});
 part(out,`${base}-right`,x+size*.3,z-size*.1,size*.2,.55+size*1.35,size*.2,green,{species:s.id,part:'blade'});
 return;
 }
 const leaf='#4f793e',branch='#5f4a32';
 part(out,`${base}-stem`,x,z,size*.24,.5+size*.8,size*.24,branch,{species:s.id,part:'stem'});
 part(out,`${base}-crown`,x,z,size*1.2,.55+size*.9,size*1.05,leaf,{species:s.id,part:'crown'});
 part(out,`${base}-side`,x+size*.48,z-size*.22,size*.72,.4+size*.65,size*.7,'#5f8448',{species:s.id,part:'crown'});
}

function animalParts(out,s,i,x,z,body,heading,behavior='roaming'){const predator=s.kind==='predator';const runner=s.id==='reed-runner';const color=predator?'#6b4d38':runner?'#b39a67':'#96784e';const bodyLen=predator?body*1.75:runner?body*1.35:body*1.55,bodyWide=predator?body*.62:runner?body*.48:body*.72,bodyHigh=predator?body*.62:runner?body*.7:body*.82;part(out,`eco-animal-${s.id}-${i}`,x,z,bodyLen,bodyHigh,bodyWide,color,{species:s.id,animalId:`${s.id}-${i}`,behavior,part:'creature',kind:s.kind,heading:round(heading,4),bodyScale:round(body,3)});}

function motionTick(frame,phase,feeding){if(!feeding)return frame;const offset=Math.floor(phase*20);const local=frame+offset;const cycle=24,move=18;const effective=Math.floor(local/cycle)*move+Math.min(local%cycle,move);return effective-offset;}
function animalPosition(s,i,frame,weather){const need=s.needs||{},goal=String(s.goal||'');const season=String(weather?.season||'Spring');const phase=hash01(`${s.id}:phase:${i}`)*Math.PI*2;const area=habitat(s.habitat,hash01(s.id||s.name||'species'));const predator=s.kind==='predator';const runner=s.id==='reed-runner';const cycle=(frame+Math.floor(hash01(`${s.id}:feed:${i}`)*24))%24;const feeding=!predator&&cycle>=18;const mt=motionTick(frame,phase,feeding);const weatherSlow=1-clamp(Number(weather?.precipitationRate||0)*.45+Number(weather?.wind||0)*.12,0,.55);const hunted=Boolean(s.lastHunt&&Number(s.lastHunt.year)>=(Number(s.bornYear||0)));const needBoost=goal.includes('hunt')?1.3:goal.includes('water')||goal.includes('predator')?1.22:goal.includes('rest')?.72:hunted?.92:1;const speed=(predator?.038:runner?.05:.034)*weatherSlow*needBoost;const step=mt*speed;const migrate=s.kind==='herbivore'?(season==='Winter'?{x:-8,z:-4}:season==='Summer'?{x:-15,z:2}:season==='Autumn'?{x:1,z:1}:{x:4,z:5}):(season==='Winter'?{x:12,z:-3}:{x:18,z:-5});let x=clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32),z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32);const migrationStrength=s.kind==='herbivore'?.22:.10;x=x+(migrate.x-x)*migrationStrength;z=z+(migrate.z-z)*migrationStrength;if(goal.includes('water'))x=x+(-18-x)*.18;return{phase,area,feeding:feeding&&Number(need.hunger||0)<.7,x,z,season};}

export function ecologyRenderEntities(ecosystem,now=Date.now(),weather=null,observer=null){
 const species=Array.isArray(ecosystem?.species)?ecosystem.species:[];const out=[];const frame=Math.floor(now/800);const herbivores=species.filter(s=>s.kind==='herbivore'&&Number(s.population||0)>0);
 for(const s of species){const pop=Math.max(0,Number(s.population||0));if(pop<=0)continue;const seed=hash01(s.id||s.name||'species');const area=habitat(s.habitat,seed);
  if(s.kind==='plant'){const life=s.lifeCycle||{};const health=clamp(1-Number(life.waterStress||0)*.45-Number(life.grazingPressure||0)*.3,.35,1);const count=Math.max(3,Math.min(28,Math.round(Math.sqrt(pop)/6*health)));for(let i=0;i<count;i++){const a=hash01(`${s.id}:a:${i}`)*Math.PI*2;const r=Math.sqrt(hash01(`${s.id}:r:${i}`));const breeze=Number(weather?.wind||0)*.12*Math.sin(frame*.18+i);const x=clamp(area.x+Math.cos(a)*area.rx*r+breeze,-32,32);const z=clamp(area.z+Math.sin(a)*area.rz*r,-32,32);const size=(.35+hash01(`${s.id}:s:${i}`)*.5)*(.65+health*.45);plantCluster(out,s,i,x,z,size);}continue;}
  const max=s.kind==='predator'?5:9;const count=Math.max(1,Math.min(max,Math.round(pop/(s.kind==='predator'?14:65))));
  for(let i=0;i<count;i++){const pos=animalPosition(s,i,frame,weather);let x=pos.x,z=pos.z,behavior=pos.feeding?'feeding':'roaming';
   if(s.kind==='predator'&&herbivores.length){const prey=herbivores[(i+Math.floor(frame/30))%herbivores.length];const preyPos=animalPosition(prey,i%3,frame,weather);const d=Math.hypot(preyPos.x-x,preyPos.z-z);if(d<18){x=x+(preyPos.x-x)*.18;z=z+(preyPos.z-z)*.18;behavior='stalking';}}
   const ox=Number(observer?.x),oz=Number(observer?.z);if(s.kind==='herbivore'&&Number.isFinite(ox)&&Number.isFinite(oz)){const dx=x-ox,dz=z-oz,d=Math.hypot(dx,dz);if(d<7){const force=(7-d)/7*5;x=clamp(x+(dx/(d||1))*force,-32,32);z=clamp(z+(dz/(d||1))*force,-32,32);behavior='fleeing';}}
   const next=animalPosition(s,i,frame+1,weather);let nx=next.x,nz=next.z;if(behavior==='feeding'){nx=x;nz=z;}else if(behavior==='stalking'&&herbivores.length){const prey=herbivores[(i+Math.floor(frame/30))%herbivores.length];const preyNext=animalPosition(prey,i%3,frame+1,weather);nx=next.x+(preyNext.x-next.x)*.18;nz=next.z+(preyNext.z-next.z)*.18;}else if(behavior==='fleeing'&&Number.isFinite(ox)&&Number.isFinite(oz)){const dx=next.x-ox,dz=next.z-oz,d=Math.hypot(dx,dz);const force=d<7?(7-d)/7*5:0;nx=clamp(next.x+(dx/(d||1))*force,-32,32);nz=clamp(next.z+(dz/(d||1))*force,-32,32);}
   const heading=Math.atan2(nz-z,nx-x);const body=.65+clamp(Number(s.traits?.size||.4),0,1)*.8;animalParts(out,s,i,x,z,body,heading,behavior);}
 }
 // Persistent-looking seasonal game trails derived deterministically from current ecology and season.
 const season=String(weather?.season||'Spring');
 for(const s of species.filter(x=>x.kind!=='plant'&&Number(x.population||0)>0)){
  const seed=hash01(s.id||s.name),a=habitat(s.habitat,seed),target=s.kind==='herbivore'?(season==='Winter'?{x:-8,z:-4}:season==='Summer'?{x:-15,z:2}:season==='Autumn'?{x:1,z:1}:{x:4,z:5}):(season==='Winter'?{x:12,z:-3}:{x:18,z:-5});
  for(let n=1;n<=3;n++){const q=n/4,x=a.x+(target.x-a.x)*q,z=a.z+(target.z-a.z)*q;part(out,`eco-trail-${s.id}-${n}`,x,z,1.4,.025,.5,'#776b52',{species:s.id,part:'trail',season});}
 }
 return out;
}

export function simulationSummary(world={}){return{ecology:world.ecosystem||null,weather:world.weather_sim||null,disasters:world.disaster_sim||null,narrativeDay:world.current_day||null};}
