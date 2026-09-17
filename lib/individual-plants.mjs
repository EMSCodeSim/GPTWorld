// Persistent bounded visual representatives of the larger species populations.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(n))?Number(n):a));
const hash=(value)=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
const stage=(age)=>age<1?'seed':age<2?'sprout':age<4?'young':age<12?'mature':age<18?'old':'dead';
export function advancePlantIndividuals(state,year=Number(state?.simulatedYear||0)){
 const previous=Array.isArray(state.plantIndividuals)?state.plantIndividuals:[];
 const next=[];const events=Array.isArray(state.plantJournal)?state.plantJournal:[];
 for(const species of (state.species||[]).filter(s=>s.kind==='plant')){
  const cap=Math.min(28,Math.max(0,Math.round(Math.sqrt(Math.max(0,Number(species.population||0)))/6)));
  const existing=previous.filter(p=>p.speciesId===species.id);
  for(const plant of existing.slice(0,cap)){
   const p={...plant};const before=p.stage;
   const moisture=clamp(state.climate?.rainfall,.2,1),stress=clamp(species.lifeCycle?.waterStress||0),grazing=clamp(species.lifeCycle?.grazingPressure||0);
   p.age=Math.max(0,Number(p.age||0)+1);p.health=clamp(Number(p.health??1)+moisture*.12-.04-stress*.14-grazing*.09);
   p.stage=p.health<=0?'dead':stage(p.age);
   if(p.stage==='dead'&&before!=='dead')events.push({year,type:'plant_died',plantId:p.id,speciesId:p.speciesId});
   if(before!==p.stage&&p.stage!=='dead')events.push({year,type:'plant_matured',plantId:p.id,speciesId:p.speciesId,stage:p.stage});
   // Harvested plants regrow only when alive and supplied with water.
   p.resources=p.stage==='dead'?0:clamp(Number(p.resources??1)+(p.stage==='mature'||p.stage==='old'?.24:.12)*moisture*(.3+p.health*.7));
   next.push(p);
  }
  for(let slot=next.filter(p=>p.speciesId===species.id).length;slot<cap;slot++){
   const id=`plant-${species.id}-${year}-${slot}`;
   next.push({id,speciesId:species.id,birthYear:year,age:0,stage:'seed',health:1,resources:0,slot});
   events.push({year,type:'plant_germinated',plantId:id,speciesId:species.id});
  }
  for(const p of existing.slice(cap))events.push({year,type:'plant_lost',plantId:p.id,speciesId:p.speciesId});
 }
 state.plantIndividuals=next;state.plantJournal=events.slice(-80);return state;
}
export function harvestIndividualPlant(state,id,year=Number(state?.simulatedYear||0)){
 const p=(state.plantIndividuals||[]).find(p=>p.id===id);
 if(!p)return {ok:false,error:'plant_not_found'};
 if(p.stage==='dead'||p.health<=0||p.resources<.25)return {ok:false,error:'plant_not_ready'};
 const amount=Math.min(1,p.resources);p.resources=clamp(p.resources-amount);p.health=clamp(p.health-.06*amount);
 (state.plantJournal||=[]).push({year,type:'plant_harvested',plantId:p.id,speciesId:p.speciesId,amount});state.plantJournal=state.plantJournal.slice(-80);
 return {ok:true,plant:p,amount};
}
export function visiblePlantIndividuals(state,speciesId){return(state?.plantIndividuals||[]).filter(p=>p.speciesId===speciesId);}
export function plantScale(plant){if(!plant)return 1;return ({seed:.12,sprout:.28,young:.57,mature:1,old:1.12,dead:.68})[plant.stage]??1;}
