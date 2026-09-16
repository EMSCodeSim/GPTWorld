from pathlib import Path
p=Path('main.js');s=p.read_text()
anchor="function updateCreatures(t,dt){for(const record of renderedEntities.values()){const g=record.object,u=g?.userData;if(!u?.creature||!u.target)continue;updateHerbivoreFeeding(g,u,t);"
helper="""function livingCreatures(){const out=[];for(const record of renderedEntities.values()){const g=record.object,u=g?.userData;if(g&&u?.creature&&!u.dead)out.push({g,u})}return out}
function nearestPreyForCreature(g,maxDistance=16){let best=null,bestD=maxDistance;for(const c of livingCreatures()){if(c.g===g||c.u.kind==='predator')continue;const d=g.position.distanceTo(c.g.position);if(d<bestD){best=c;bestD=d}}return best}
function updatePredatorFeeding(g,u,t){if(u.kind!=='predator')return;u.hunger=Number.isFinite(u.hunger)?u.hunger:32;u.hunger=Math.min(100,u.hunger+.0025);if(u.hunger<30&&!u.preyTarget)return;const prey=u.preyTarget&&!u.preyTarget.u.dead?u.preyTarget:nearestPreyForCreature(g);if(!prey){u.behavior='roaming';u.preyTarget=null;return}u.preyTarget=prey;u.target=prey.g.position.clone();const d=g.position.distanceTo(prey.g.position);if(d<1.15){u.behavior='feeding';if(!u.nextBiteAt||t>=u.nextBiteAt){u.nextBiteAt=t+6500;prey.u.health=Number.isFinite(prey.u.health)?prey.u.health:100;prey.u.health-=55;if(prey.u.health<=0){prey.u.dead=true;prey.g.visible=false;u.hunger=Math.max(0,u.hunger-55);showToast(`${u.species||'Predator'} caught ${prey.u.species||'prey'}.`);u.preyTarget=null;u.behavior='feeding';u.nextMealEnd=t+3500}else{prey.u.behavior='fleeing';prey.u.target.set(prey.g.position.x+(prey.g.position.x-g.position.x)*5,0,prey.g.position.z+(prey.g.position.z-g.position.z)*5)}}}else u.behavior='stalking'}
function updateFoodWebBehavior(g,u,t){updateHerbivoreFeeding(g,u,t);updatePredatorFeeding(g,u,t);if(u.kind!=='predator'&&u.kind!=='herbivore'){u.hunger=Number.isFinite(u.hunger)?u.hunger:20;u.hunger=Math.min(100,u.hunger+.0015)}}
"""
assert anchor in s
s=s.replace(anchor,helper+anchor.replace('updateHerbivoreFeeding(g,u,t);','updateFoodWebBehavior(g,u,t);'),1)
p.write_text(s)
p=Path('index.html');i=p.read_text();start=i.find('./main.js?v=');
if start>=0:
 end=i.find('"',start)
 if end<0:end=i.find("'",start)
 i=i[:start]+'./main.js?v=visible-food-web-1'+i[end:]
p.write_text(i)
