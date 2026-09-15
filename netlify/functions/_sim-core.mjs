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

function animalParts(out,s,i,x,z,body,heading){const predator=s.kind==='predator';const runner=s.id==='reed-runner';const color=predator?'#6b4d38':runner?'#b39a67':'#96784e';const dark=predator?'#3f3027':runner?'#735f3e':'#604c32';const base=`eco-animal-${s.id}-${i}`;const dx=Math.cos(heading),dz=Math.sin(heading),sx=-dz,sz=dx;
 const px=(forward,side=0)=>x+dx*forward+sx*side,pz=(forward,side=0)=>z+dz*forward+sz*side;
 const bodyLen=predator?body*1.75:runner?body*1.35:body*1.55,bodyWide=predator?body*.62:runner?body*.48:body*.72,bodyHigh=predator?body*.62:runner?body*.7:body*.82;
 part(out,`${base}-body`,x,z,bodyLen,bodyHigh,bodyWide,color,{species:s.id,part:'body'});
 const headF=bodyLen*.58,headSize=predator?body*.62:runner?body*.5:body*.58;
 part(out,`${base}-head`,px(headF),pz(headF),headSize,headSize,headSize,dark,{species:s.id,part:'head'});
 const legH=predator?body*.7:runner?body*.78:body*.86,legW=Math.max(.13,body*.16),front=bodyLen*.32,rear=-bodyLen*.32,side=bodyWide*.34;
 for(const [name,f,sd] of [['fl',front,side],['fr',front,-side],['rl',rear,side],['rr',rear,-side]])part(out,`${base}-${name}`,px(f,sd),pz(f,sd),legW,legH,legW,dark,{species:s.id,part:'leg'});
 const tailF=-bodyLen*.62;
 part(out,`${base}-tail`,px(tailF),pz(tailF),predator?body*.75:body*.52,Math.max(.14,body*.18),Math.max(.12,body*.14),dark,{species:s.id,part:'tail'});
 if(predator){
   part(out,`${base}-ear-l`,px(headF+body*.06,headSize*.28),pz(headF+body*.06,headSize*.28),body*.16,body*.28,body*.14,'#2f251f',{species:s.id,part:'ear'});
   part(out,`${base}-ear-r`,px(headF+body*.06,-headSize*.28),pz(headF+body*.06,-headSize*.28),body*.16,body*.28,body*.14,'#2f251f',{species:s.id,part:'ear'});
 }else if(!runner){
   part(out,`${base}-horn-l`,px(headF+body*.12,headSize*.32),pz(headF+body*.12,headSize*.32),body*.12,body*.34,body*.12,'#d0c39b',{species:s.id,part:'horn'});
   part(out,`${base}-horn-r`,px(headF+body*.12,-headSize*.32),pz(headF+body*.12,-headSize*.32),body*.12,body*.34,body*.12,'#d0c39b',{species:s.id,part:'horn'});
 }
}

export function ecologyRenderEntities(ecosystem,now=Date.now()){
 const species=Array.isArray(ecosystem?.species)?ecosystem.species:[];const out=[];const timeSlot=Math.floor(now/4000);
 for(const s of species){const pop=Math.max(0,Number(s.population||0));if(pop<=0)continue;const seed=hash01(s.id||s.name||'species');const area=habitat(s.habitat,seed);
  if(s.kind==='plant'){const count=Math.max(5,Math.min(24,Math.round(Math.sqrt(pop)/6)));for(let i=0;i<count;i++){const a=hash01(`${s.id}:a:${i}`)*Math.PI*2;const r=Math.sqrt(hash01(`${s.id}:r:${i}`));const x=clamp(area.x+Math.cos(a)*area.rx*r,-32,32);const z=clamp(area.z+Math.sin(a)*area.rz*r,-32,32);const size=.35+hash01(`${s.id}:s:${i}`)*.5;plantCluster(out,s,i,x,z,size);}continue;}
  const max=s.kind==='predator'?5:9;const count=Math.max(1,Math.min(max,Math.round(pop/(s.kind==='predator'?14:65))));
  for(let i=0;i<count;i++){const phase=hash01(`${s.id}:phase:${i}`)*Math.PI*2;const speed=s.kind==='predator'?.22:.15;const step=timeSlot*speed;const x=clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32);const z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32);const nextStep=(timeSlot+1)*speed;const nx=clamp(area.x+Math.sin(nextStep+phase)*area.rx*.62,-32,32);const nz=clamp(area.z+Math.cos(nextStep*.77+phase*1.4)*area.rz*.62,-32,32);const heading=Math.atan2(nz-z,nx-x);const body=.65+clamp(Number(s.traits?.size||.4),0,1)*.8;animalParts(out,s,i,x,z,body,heading);}
 }
 return out;
}

export function simulationSummary(world={}){return{ecology:world.ecosystem||null,weather:world.weather_sim||null,disasters:world.disaster_sim||null,narrativeDay:world.current_day||null};}
