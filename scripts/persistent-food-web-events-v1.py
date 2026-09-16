from pathlib import Path
p=Path('main.js');s=p.read_text()
anchor="function updatePredatorFeeding(g,u,t){"
helper="""async function recordEcologyEvent(type,payload={}){const clientId=localStorage.getItem(CLIENT_KEY);if(!clientId)return;try{await fetch(WORLD_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,name:playerName,x:Number(player.position.x.toFixed(3)),z:Number(player.position.z.toFixed(3)),event:{type,payload}})})}catch{}}
"""
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
s=s.replace("showToast(`${u.species||u.kind||'Herbivore'} grazes on ${plant.label}.`)","showToast(`${u.species||u.kind||'Herbivore'} grazes on ${plant.label}.`);recordEcologyEvent('ecology_grazing',{species:u.species||'herbivore',plant:plant.label,nodeId:plant.nodeId,amount:1,x:Number(g.position.x.toFixed(2)),z:Number(g.position.z.toFixed(2))})",1)
s=s.replace("showToast(`${u.species||'Predator'} caught ${prey.u.species||'prey'}.`);u.preyTarget=null", "showToast(`${u.species||'Predator'} caught ${prey.u.species||'prey'}.`);recordEcologyEvent('ecology_predation',{predator:u.species||'predator',prey:prey.u.species||'herbivore',x:Number(g.position.x.toFixed(2)),z:Number(g.position.z.toFixed(2))});u.preyTarget=null",1)
p.write_text(s)
p=Path('index.html');i=p.read_text();start=i.find('./main.js?v=');
if start>=0:
 end=i.find('"',start)
 if end<0:end=i.find("'",start)
 i=i[:start]+'./main.js?v=persistent-food-web-1'+i[end:]
p.write_text(i)
