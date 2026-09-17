// Persistent bounded visual representatives of the larger species populations.
import {advancePlant,growthStageForAge,harvestPlant,normalizePlant,plantScale} from './plant-lifecycle.mjs';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(n))?Number(n):a));
export function advancePlantIndividuals(state,year=Number(state?.simulatedYear||0)){
 const previous=Array.isArray(state.plantIndividuals)?state.plantIndividuals:[];
 const next=[];const events=Array.isArray(state.plantJournal)?state.plantJournal:[];
 for(const species of (state.species||[]).filter(s=>s.kind==='plant')){
  const cap=Math.min(28,Math.max(0,Math.round(Math.sqrt(Math.max(0,Number(species.population||0)))/6)));
  const existing=previous.filter(p=>p.speciesId===species.id);
  for(const plant of existing.slice(0,cap)){
   const normalized=normalizePlant(plant,{id:plant.id,speciesId:species.id,year,slot:plant.slot,maxResources:1,legacyMature:true});const before=normalized.stage;
   const moisture=clamp(state.climate?.rainfall,.2,1),stress=clamp(species.lifeCycle?.waterStress||0),grazing=clamp(species.lifeCycle?.grazingPressure||0);
   const p=advancePlant(normalized,{year,moisture,stress,grazing});
   if(p.stage==='dead'&&before!=='dead')events.push({year,type:'plant_died',plantId:p.id,speciesId:p.speciesId});
   if(before!==p.stage&&p.stage!=='dead')events.push({year,type:'plant_matured',plantId:p.id,speciesId:p.speciesId,stage:p.stage});
   next.push(p);
  }
  for(let slot=next.filter(p=>p.speciesId===species.id).length;slot<cap;slot++){
   const id=`plant-${species.id}-${slot}-g1`;
   next.push(normalizePlant(null,{id,speciesId:species.id,year,slot,maxResources:1,legacyMature:false}));
   events.push({year,type:'plant_germinated',plantId:id,speciesId:species.id});
  }
  for(const p of existing.slice(cap))events.push({year,type:'plant_lost',plantId:p.id,speciesId:p.speciesId});
 }
 state.plantIndividuals=next;state.plantJournal=events.slice(-80);return state;
}
export function harvestIndividualPlant(state,id,year=Number(state?.simulatedYear||0)){
 const index=(state.plantIndividuals||[]).findIndex(p=>p.id===id),p=index>=0?state.plantIndividuals[index]:null;
 if(!p)return {ok:false,error:'plant_not_found'};
 const result=harvestPlant(normalizePlant(p,{id:p.id,speciesId:p.speciesId,year,slot:p.slot,maxResources:p.maxResources||1}),{amount:1,year});
 if(!result.ok)return{ok:false,error:result.error};Object.assign(p,result.plant);state.plantIndividuals[index]=p;
 (state.plantJournal||=[]).push({year,type:'plant_harvested',plantId:p.id,speciesId:p.speciesId,amount:result.amount});state.plantJournal=state.plantJournal.slice(-80);
 return {ok:true,plant:p,amount:result.amount};
}
export function visiblePlantIndividuals(state,speciesId){return(state?.plantIndividuals||[]).filter(p=>p.speciesId===speciesId);}
export {growthStageForAge,plantScale};
