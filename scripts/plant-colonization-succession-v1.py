from pathlib import Path
p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor='function applyPlantHabitats(state) {'
helper=r'''function applyPlantColonizationAndSuccession(state, year=Number(state.simulatedYear||0)) {
  const plants=(state.species||[]).filter(s=>s.kind==='plant'), habitats=state.habitats||{}, bank=state.seedBank?.seeds||{};
  state.plantPatches ||= [];
  for(const plant of plants){
    const seed=bank[plant.id]||{}, available=Number(seed.germinated||0)+Math.round(Number(seed.dormant||0)*.04);if(available<=0)continue;
    for(const [hid,h] of Object.entries(habitats)){
      if(hid===plant.habitat||state.plantPatches.some(p=>p.speciesId===plant.id&&p.habitat===hid))continue;
      const fit=clamp(Number(h.moisture||.4)*.42+Number(h.fertility||.4)*.38+(1-Number(h.grazingPressure||0))*.2,0,1),d=seed.dispersal||{},reach=clamp(Number(d.wind||0)*.45+Number(d.water||0)*.25+Number(d.animals||0)*.3,0,1),chance=fit*reach,roll=(seededNoise(year*17.3+plant.id.length*7.1+hid.length*3.7)+1)/2;
      if(chance>.38&&roll<chance*.48){state.plantPatches.push({id:`${plant.id}-${hid}-${year}`,speciesId:plant.id,habitat:hid,population:Math.max(12,Math.round(available*.12)),stage:'pioneer',foundedYear:year,lastYear:year});state.recentEvents.push({year,type:'colonization',text:`${plant.name} established a new patch in the ${hid}.`});}
    }
  }
  for(const patch of state.plantPatches){const h=habitats[patch.habitat]||{},age=Math.max(0,year-Number(patch.foundedYear||year)),stress=clamp((1-Number(h.moisture||.5))*.45+Number(h.grazingPressure||0)*.4+(String(h.status||'').includes('burn')?.35:0),0,1),growth=clamp(.88+Number(h.fertility||.4)*.2+Number(h.moisture||.4)*.18-stress*.22,.55,1.22);patch.population=Math.max(0,Math.round(Number(patch.population||0)*growth));patch.lastYear=year;patch.stage=patch.population<=0?'lost':String(h.status||'').includes('burn')?'disturbed':age<2?'pioneer':age<5?'establishing':patch.population>900?'mature':'developing';}
  for(const patch of state.plantPatches.filter(p=>p.population<=0))state.recentEvents.push({year,type:'local_extinction',text:`A ${patch.speciesId} patch disappeared from the ${patch.habitat}.`});
  state.plantPatches=state.plantPatches.filter(p=>p.population>0).slice(-80);state.succession={version:1,year,patches:state.plantPatches.length,stages:state.plantPatches.reduce((a,p)=>(a[p.stage]=(a[p.stage]||0)+1,a),{})};return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
s=s.replace('  applyPlantSeeds(next, year);\n  applyLifeCycleEvents(next, year);','  applyPlantSeeds(next, year);\n  applyPlantColonizationAndSuccession(next, year);\n  applyLifeCycleEvents(next, year);',1)
s=s.replace('  applyPlantSeeds(state);\n  applyMigrationAndTerritories(state);','  applyPlantSeeds(state);\n  applyPlantColonizationAndSuccession(state);\n  applyMigrationAndTerritories(state);',1)
p.write_text(s)
p=Path('netlify/functions/_sim-core.mjs');s=p.read_text();needle=" const season=String(weather?.season||'Spring');";assert needle in s
addition=" const patches=Array.isArray(ecosystem?.plantPatches)?ecosystem.plantPatches:[];for(const p of patches.slice(-24)){const seed=hash01(p.id),a=habitat(p.habitat,seed),count=Math.max(1,Math.min(4,Math.ceil(Number(p.population||0)/250)));for(let n=0;n<count;n++)part(out,`eco-patch-${p.id}-${n}`,a.x+(n-1.5)*.7,a.z+((n%2)-.5)*.8,.45,.16,.45,p.stage==='pioneer'?'#7d8a4d':'#5f773f',{part:'plant-patch',species:p.speciesId,stage:p.stage,habitat:p.habitat});}\n"+needle
s=s.replace(needle,addition,1);p.write_text(s)
