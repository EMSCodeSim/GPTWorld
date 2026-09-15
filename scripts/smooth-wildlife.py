from pathlib import Path

p = Path('main.js')
s = p.read_text()

old = "const legH=predator?body*.7:runner?body*.78:body*.86,legW=Math.max(.07,body*.11),front=w*.32,rear=-w*.32,side=d*.34;for(const [x,z] of [[front,side],[front,-side],[rear,side],[rear,-side]])add(new THREE.CylinderGeometry(legW*.72,legW,legH,5),dark,x,legH/2,z);const tail=add(new THREE.ConeGeometry(Math.max(.07,body*.11),predator?body*.75:body*.52,6),dark,-w*.62,body*.75,0);"
new = "const legH=predator?body*.7:runner?body*.78:body*.86,legW=Math.max(.07,body*.11),front=w*.32,rear=-w*.32,side=d*.34,legs=[];for(const [x,z] of [[front,side],[front,-side],[rear,side],[rear,-side]])legs.push(add(new THREE.CylinderGeometry(legW*.72,legW,legH,5),dark,x,legH/2,z));const tail=add(new THREE.ConeGeometry(Math.max(.07,body*.11),predator?body*.75:body*.52,6),dark,-w*.62,body*.75,0);"
assert old in s, 'leg rig anchor not found'
s = s.replace(old, new, 1)

old = "g.rotation.y=-Number(e.heading||0);g.userData.creature=true;g.userData.behavior=String(e.behavior||'roaming');scene.add(g);return g;"
new = "g.rotation.y=-Number(e.heading||0);g.userData.creature=true;g.userData.animalId=String(e.animalId);g.userData.kind=String(e.kind||'herbivore');g.userData.behavior=String(e.behavior||'roaming');g.userData.target=new THREE.Vector3(Number(e.x||0),0,Number(e.z||0));g.userData.headingTarget=-Number(e.heading||0);g.userData.rig={body:bodyMesh,head,legs,tail,headBaseY:head.position.y,bodyBaseY:bodyMesh.position.y};scene.add(g);return g;"
assert old in s, 'creature metadata anchor not found'
s = s.replace(old, new, 1)

old = "function applyRenderEntities(input){const list=Array.isArray(input)?input:Array.isArray(input?.entities)?input.entities:[];const wanted=new Set();for(const e of list){const id=String(e?.id||'');if(!id)continue;wanted.add(id);const sig=JSON.stringify(e);if(renderedEntities.get(id)?.signature===sig)continue;renderPersistentEntity(e)}for(const id of [...renderedEntities.keys()])if(!wanted.has(id))removeRenderedEntity(id)}"
new = "function applyRenderEntities(input){const list=Array.isArray(input)?input:Array.isArray(input?.entities)?input.entities:[];const wanted=new Set();for(const e of list){const id=String(e?.id||'');if(!id)continue;wanted.add(id);const sig=JSON.stringify(e),record=renderedEntities.get(id);if(record?.signature===sig)continue;if(record?.object?.userData?.creature&&e.animalId&&String(e.part||'')==='creature'){const u=record.object.userData;u.target.set(Number(e.x||0),0,Number(e.z||0));u.headingTarget=-Number(e.heading||0);u.behavior=String(e.behavior||'roaming');u.kind=String(e.kind||u.kind||'herbivore');record.signature=sig;continue}renderPersistentEntity(e)}for(const id of [...renderedEntities.keys()])if(!wanted.has(id))removeRenderedEntity(id)}"
assert old in s, 'render entity sync anchor not found'
s = s.replace(old, new, 1)

anchor = "function updateRemotePlayers(dt,t){"
assert anchor in s, 'remote update anchor not found'
smooth = '''function updateCreatures(t,dt){for(const record of renderedEntities.values()){const g=record.object,u=g?.userData;if(!u?.creature||!u.target)continue;let tx=u.target.x,tz=u.target.z,behavior=u.behavior||'roaming';const px=g.position.x-player.position.x,pz=g.position.z-player.position.z,pdist=Math.hypot(px,pz);if(u.kind!=='predator'&&pdist<6.5){const inv=1/Math.max(.001,pdist),push=Math.min(4,1+(6.5-pdist)*.75);tx=g.position.x+px*inv*push;tz=g.position.z+pz*inv*push;behavior='fleeing'}const dx=tx-g.position.x,dz=tz-g.position.z,dist=Math.hypot(dx,dz);let moving=dist>.025;if(behavior==='feeding')moving=false;const pace=behavior==='fleeing'?7:behavior==='stalking'?3.8:behavior==='feeding'?1.2:2.7;if(moving){const a=1-Math.exp(-pace*dt);g.position.x+=dx*a;g.position.z+=dz*a;const desiredHeading=Math.atan2(dx,dz);let turn=((desiredHeading-g.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;g.rotation.y+=turn*Math.min(1,dt*(behavior==='fleeing'?9:5))}else if(u.kind==='predator'&&pdist<8){const desiredHeading=Math.atan2(player.position.x-g.position.x,player.position.z-g.position.z);let turn=((desiredHeading-g.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;g.rotation.y+=turn*Math.min(1,dt*2.5)}const r=u.rig;if(!r)continue;const gait=moving?Math.sin(t*(behavior==='fleeing'?.016:.009))*(behavior==='fleeing'?.55:.32):0;if(r.legs?.length===4){r.legs[0].rotation.z=gait;r.legs[1].rotation.z=-gait;r.legs[2].rotation.z=-gait;r.legs[3].rotation.z=gait}if(r.body)r.body.position.y=r.bodyBaseY+(moving?Math.abs(Math.sin(t*.012))*.035:0);if(r.head){const feeding=behavior==='feeding';r.head.position.y=r.headBaseY+(feeding?-.16+.04*Math.sin(t*.004):moving?.025*Math.sin(t*.007):0);r.head.rotation.z=feeding?-.38+.08*Math.sin(t*.004):0}if(r.tail)r.tail.rotation.x=(behavior==='fleeing'?.18:.06)*Math.sin(t*.011)}}}\n'''
s = s.replace(anchor, smooth + anchor, 1)

old = "updatePlayer(dt,t);updateNPCs(t,dt);updateRemotePlayers(dt,t);updateNearest();"
new = "updatePlayer(dt,t);updateNPCs(t,dt);updateRemotePlayers(dt,t);updateCreatures(t,dt);updateNearest();"
assert old in s, 'animation loop anchor not found'
s = s.replace(old, new, 1)
p.write_text(s)

ip = Path('index.html')
h = ip.read_text().replace('./main.js?v=people-animals-1', './main.js?v=wildlife-motion-1')
ip.write_text(h)
