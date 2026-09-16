from pathlib import Path
p=Path('main.js');s=p.read_text()
old="function updateCreatures(t,dt){for(const record of renderedEntities.values()){const g=record.object,u=g?.userData;if(!u?.creature||!u.target)continue;"
new="""function nearestPlantForCreature(g,maxDistance=11){let best=null,bestD=maxDistance;for(const plant of resourceNodes){if(plant.resource!=='herbs'||plant.depleted||!plant.object?.visible)continue;const d=g.position.distanceTo(plant.object.position);if(d<bestD){best=plant;bestD=d}}return best}
function updateHerbivoreFeeding(g,u,t){if(u.kind!=='herbivore')return;u.hunger=Number.isFinite(u.hunger)?u.hunger:35;u.hunger=Math.min(100,u.hunger+.003);const plant=nearestPlantForCreature(g);if(!plant)return;if(u.hunger>=28||u.feedingPlant){u.feedingPlant=plant;u.target=plant.object.position.clone();const d=g.position.distanceTo(plant.object.position);if(d<1.25){u.behavior='feeding';if(!u.nextBiteAt||t>=u.nextBiteAt){u.nextBiteAt=t+5000;u.hunger=Math.max(0,u.hunger-18);plant.grazedVisual=Math.min(.55,(plant.grazedVisual||0)+.08);plant.object.scale.y=Math.max(.45,1-plant.grazedVisual);showToast(`${u.species||u.kind||'Herbivore'} grazes on ${plant.label}.`)}if(u.hunger<15){u.feedingPlant=null;u.behavior='roaming';u.target.set(g.position.x+(Math.random()-.5)*8,0,g.position.z+(Math.random()-.5)*8)}}else u.behavior='seeking food'}}
function updateCreatures(t,dt){for(const record of renderedEntities.values()){const g=record.object,u=g?.userData;if(!u?.creature||!u.target)continue;updateHerbivoreFeeding(g,u,t);"""
assert old in s,'updateCreatures anchor missing'
s=s.replace(old,new,1)
p.write_text(s)
p=Path('index.html');i=p.read_text();start=i.find('./main.js?v=');
if start>=0:
 end=i.find('"',start)
 if end<0:end=i.find("'",start)
 i=i[:start]+'./main.js?v=herbivore-feeding-1'+i[end:]
p.write_text(i)
