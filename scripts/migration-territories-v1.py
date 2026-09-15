from pathlib import Path
p=Path('netlify/functions/_sim-core.mjs');s=p.read_text()
old="function animalPosition(s,i,frame,weather){const need=s.needs||{},goal=String(s.goal||'');const phase="
new="function animalPosition(s,i,frame,weather){const need=s.needs||{},goal=String(s.goal||'');const season=String(weather?.season||'Spring');const phase="
assert old in s;s=s.replace(old,new,1)
old="const step=mt*speed;let x=clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32),z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32);if(goal.includes('water'))x=x+( -18-x)*.18;return{phase,area,feeding:feeding&&Number(need.hunger||0)<.7,x,z};}"
new="const step=mt*speed;const migrate=s.kind==='herbivore'?(season==='Winter'?{x:-8,z:-4}:season==='Summer'?{x:-15,z:2}:season==='Autumn'?{x:1,z:1}:{x:4,z:5}):(season==='Winter'?{x:12,z:-3}:{x:18,z:-5});let x=clamp(area.x+Math.sin(step+phase)*area.rx*.62,-32,32),z=clamp(area.z+Math.cos(step*.77+phase*1.4)*area.rz*.62,-32,32);const migrationStrength=s.kind==='herbivore'?.22:.10;x=x+(migrate.x-x)*migrationStrength;z=z+(migrate.z-z)*migrationStrength;if(goal.includes('water'))x=x+(-18-x)*.18;return{phase,area,feeding:feeding&&Number(need.hunger||0)<.7,x,z,season};}"
assert old in s;s=s.replace(old,new,1)
# Add visual trail markers after animal rendering, one subtle marker per species path.
old=" return out;\n}\n\nexport function simulationSummary"
new=""" // Persistent-looking seasonal game trails derived deterministically from current ecology and season.
 const season=String(weather?.season||'Spring');
 for(const s of species.filter(x=>x.kind!=='plant'&&Number(x.population||0)>0)){
  const seed=hash01(s.id||s.name),a=habitat(s.habitat,seed),target=s.kind==='herbivore'?(season==='Winter'?{x:-8,z:-4}:season==='Summer'?{x:-15,z:2}:season==='Autumn'?{x:1,z:1}:{x:4,z:5}):(season==='Winter'?{x:12,z:-3}:{x:18,z:-5});
  for(let n=1;n<=3;n++){const q=n/4,x=a.x+(target.x-a.x)*q,z=a.z+(target.z-a.z)*q;part(out,`eco-trail-${s.id}-${n}`,x,z,1.4,.025,.5,'#776b52',{species:s.id,part:'trail',season});}
 }
 return out;
}

export function simulationSummary"""
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

p=Path('netlify/functions/world.mjs');s=p.read_text()
anchor='function evolveOneYear(state) {'
helper=r'''function applyMigrationAndTerritories(state) {
  const year=Number(state.simulatedYear||0), species=Array.isArray(state.species)?state.species:[];
  for(const s of species.filter(x=>x.kind!=='plant')){
    const predator=s.kind==='predator';
    s.territory={type:predator?'territory':'seasonal range',homeHabitat:s.habitat,radius:predator?round(6+Number(s.traits?.size||.4)*7,1):round(8+Number(s.traits?.speed||.4)*6,1),year};
    s.migration={enabled:!predator,driver:Number(s.needs?.thirst||0)>.55?'water':Number(s.needs?.hunger||0)>.5?'food':'season',route:predator?'follow prey':'seasonal habitat route',year};
  }
  state.migration={version:1,year,activeSpecies:species.filter(x=>x.kind==='herbivore'&&x.migration?.enabled).map(x=>x.id),predatorsFollowingPrey:species.filter(x=>x.kind==='predator').map(x=>x.id)};
  return state;
}

'''
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old='  applyFoodChainNeeds(next);\n  return next;'
new='  applyFoodChainNeeds(next);\n  applyMigrationAndTerritories(next);\n  return next;'
assert old in s;s=s.replace(old,new,1)
old='  applyFoodChainNeeds(state);\n  const today'
new='  applyFoodChainNeeds(state);\n  applyMigrationAndTerritories(state);\n  const today'
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
