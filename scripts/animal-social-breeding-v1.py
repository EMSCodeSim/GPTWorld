from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text();anchor='function applyMigrationAndTerritories(state) {'
helper=r'''function applyAnimalSocialAndBreeding(state, year=Number(state.simulatedYear||0)) {
  const animals=(state.species||[]).filter(s=>s.kind==='herbivore'||s.kind==='predator');
  state.animalGroups ||= [];
  for(const sp of animals){
    const groupType=sp.kind==='predator'?'pack':'herd', shelterType=sp.kind==='predator'?'den':'nesting ground';
    let g=state.animalGroups.find(x=>x.speciesId===sp.id);
    if(!g){g={id:`${sp.id}-${groupType}`,speciesId:sp.id,type:groupType,shelterType,habitat:sp.habitat,foundedYear:year};state.animalGroups.push(g);}
    g.population=Number(sp.population||0);g.size=sp.kind==='predator'?Math.max(2,Math.min(9,Math.round(g.population/8))):Math.max(4,Math.min(28,Math.round(g.population/20)));g.groups=Math.max(1,Math.ceil(g.population/g.size));g.habitat=sp.migration?.driver==='water'?'river corridor':sp.habitat;g.lastYear=year;
    const seasonIndex=((year%4)+4)%4, season=['Spring','Summer','Autumn','Winter'][seasonIndex];g.breedingSeason=sp.kind==='herbivore'?'Spring':'Winter';g.breedingActive=season===g.breedingSeason;
    const fit=Number(sp.demography?.reproductionFit||.5), stress=Number(sp.needs?.hunger||0)*.5+Number(sp.needs?.thirst||0)*.5;
    if(g.breedingActive&&fit>.55&&stress<.65&&g.lastBreedingYear!==year){const bonus=Math.max(1,Math.round(g.population*(sp.kind==='predator'?.012:.025)*fit));sp.population+=bonus;g.young=bonus;g.lastBreedingYear=year;(state.recentEvents||=[]).push({year,type:'breeding',text:`${sp.name} ${groupType}s produced ${bonus} young near their ${shelterType}.`});}else g.young=0;
  }
  state.animalGroups=state.animalGroups.filter(g=>animals.some(s=>s.id===g.speciesId)).slice(-30);
  state.socialEcology={version:1,year,herds:state.animalGroups.filter(g=>g.type==='herd').length,packs:state.animalGroups.filter(g=>g.type==='pack').length,activeBreeders:state.animalGroups.filter(g=>g.breedingActive).map(g=>g.speciesId)};return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
s=s.replace('  applyMigrationAndTerritories(next);\n  return next;','  applyMigrationAndTerritories(next);\n  applyAnimalSocialAndBreeding(next, year);\n  return next;',1)
s=s.replace('  applyMigrationAndTerritories(state);\n  const today','  applyMigrationAndTerritories(state);\n  applyAnimalSocialAndBreeding(state);\n  const today',1);p.write_text(s)
p=Path('netlify/functions/_sim-core.mjs');s=p.read_text();needle=" const season=String(weather?.season||'Spring');";assert needle in s
add=" const groups=Array.isArray(ecosystem?.animalGroups)?ecosystem.animalGroups:[];for(const g of groups){const seed=hash01(g.id),a=habitat(g.habitat,seed),pred=g.type==='pack';part(out,`eco-home-${g.id}`,a.x+2.2,a.z+1.6,pred?1.1:1.35,pred?.35:.12,pred?1.1:1.35,pred?'#51443a':'#7b6849',{part:g.shelterType,species:g.speciesId,group:g.type,groups:g.groups,young:g.young||0});}\n"+needle
s=s.replace(needle,add,1);p.write_text(s)
