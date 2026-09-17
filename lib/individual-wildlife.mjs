// Bounded, serializable identities for the visible wildlife population.
// Call once per simulated year after species demography has advanced.
const unit=(value,fallback=0)=>Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):fallback));
const hash=(text)=>{let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0)/4294967296;};
export function advanceIndividuals(state,year){
 const existing=Array.isArray(state.wildlifeIndividuals)?state.wildlifeIndividuals:[];
 const journal=Array.isArray(state.wildlifeJournal)?state.wildlifeJournal:[];
 const next=[];
 for(const species of (state.species||[]).filter(s=>s.kind==='herbivore'||s.kind==='predator')){
  const cap=Math.min(species.kind==='predator'?5:9,Math.max(0,Math.round(Number(species.population||0)/(species.kind==='predator'?14:65))));
  const old=existing.filter(a=>a.speciesId===species.id&&a.alive!==false);
  const deaths=Math.min(old.length,Math.max(0,Number(species.demography?.naturalDeaths||0)+Number(species.demography?.predationDeaths||0)));
  const survivors=old.filter(a=>hash(`${a.id}:${year}:survive`)>=Math.min(.95,deaths/Math.max(1,Number(species.population||0)+deaths))).slice(0,cap);
  for(const animal of survivors){
   const before=animal.stage;animal.age=Math.max(0,Number(animal.age||0)+1);animal.stage=animal.age>=3?'adult':animal.age>=1?'juvenile':'young';
   const fit=(1-unit(species.needs?.hunger))*.35+(1-unit(species.needs?.thirst))*.25+unit(species.needs?.energy,.7)*.4;
   if(animal.injury>0)animal.injury=Math.max(0,animal.injury-(fit>.65?.4:.12));
   if(hash(`${animal.id}:${year}:injury`)<unit(species.needs?.fear)*.09)animal.injury=Math.max(animal.injury,.55);
   animal.health=unit(Number(animal.health??1)+(fit-.5)*.12-animal.injury*.06,1);
   if(before!==animal.stage)journal.push({year,speciesId:species.id,type:'matured',animalId:animal.id,text:`${animal.id} matured to ${animal.stage}.`});
   next.push(animal);
  }
  for(let slot=next.filter(a=>a.speciesId===species.id).length;slot<cap;slot++){
   const id=`${species.id}-born-${year}-${slot}`;
   next.push({id,speciesId:species.id,birthYear:year,age:0,stage:'young',injury:0,health:1,alive:true,herdId:`${species.id}-${Math.floor(slot/3)*3}`,memory:{safeZone:Math.floor(hash(`${id}:safe`)*4),foodZone:Math.floor(hash(`${id}:food`)*4)}});
   journal.push({year,speciesId:species.id,type:'birth',animalId:id,text:`${id} joined the wildlife population.`});
  }
  for(const animal of old.filter(a=>!next.some(n=>n.id===a.id)))journal.push({year,speciesId:species.id,type:'lost',animalId:animal.id,text:`${animal.id} was lost from the visible population.`});
 }
 state.wildlifeIndividuals=next;
 state.wildlifeJournal=journal.slice(-60);
 return state;
}
export function visibleIndividuals(state,speciesId){return(state?.wildlifeIndividuals||[]).filter(a=>a.speciesId===speciesId&&a.alive!==false);}
