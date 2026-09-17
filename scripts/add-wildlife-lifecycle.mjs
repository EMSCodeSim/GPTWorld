import fs from 'node:fs';
const path='netlify/functions/world.mjs';
let code=fs.readFileSync(path,'utf8');
const replace=(a,b,label)=>{if(!code.includes(a))throw Error(`Missing ${label}; refusing partial integration`);code=code.replace(a,b);};
if(code.includes('function advanceWildlifeAges(')){console.log('Wildlife lifecycle already integrated');process.exit(0);}
const helper=`// Persisted cohorts, injuries and wildlife journal advance once per ecological year.
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
  if(born+breeding||matured||newInjuries||recovered){state.wildlifeJournal.push({year,speciesId:sp.id,type:'life_cycle',births:born+breeding,matured,injured:newInjuries,recovered,deaths:Number(sp.demography?.naturalDeaths||0)+Number(sp.demography?.predationDeaths||0),text:\`\${sp.name}: \${born+breeding} young born, \${matured} matured, \${newInjuries} injured, \${recovered} recovered.\`});}
 }
 state.wildlifeJournal=state.wildlifeJournal.slice(-60);
 state.wildlifeSummary={year,animals:(state.species||[]).filter(s=>s.kind!=='plant').reduce((n,s)=>n+Number(s.population||0),0),young:(state.species||[]).reduce((n,s)=>n+Number(s.ageCohorts?.young||0),0),injured:(state.species||[]).reduce((n,s)=>n+Number(s.injuries?.injured||0),0)};
 return state;
}

`;
replace('function evolveOneYear(state) {',helper+'function evolveOneYear(state) {','lifecycle insertion');
replace('  applyAnimalSocialAndBreeding(next, year);\n  return next;', '  applyAnimalSocialAndBreeding(next, year);\n  advanceWildlifeAges(next, year);\n  return next;', 'yearly persistence');
replace('  applyAnimalSocialAndBreeding(state);\n  const today', '  applyAnimalSocialAndBreeding(state);\n  state.wildlifeJournal ||= [];\n  const today', 'legacy journal initialization');
fs.writeFileSync(path,code);
console.log('Integrated persistent cohorts, injuries, recovery and wildlife journal');