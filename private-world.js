import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const API='/.netlify/functions/private-world';
const CLIENT_KEY='gptworld-client-id';
const $=id=>document.getElementById(id);
const worldEl=$('world'),loading=$('loading'),loadingTitle=$('loadingTitle'),loadingMessage=$('loadingMessage');
const retry=$('retry'),returnTown=$('returnTown'),promptEl=$('prompt'),toastEl=$('toast'),actionButton=$('actionButton');
const statusEls={clock:$('privateClock'),season:$('season'),weather:$('weather'),temperature:$('temperature')};
const inventoryEls={wood:$('woodCount'),stone:$('stoneCount'),herbs:$('herbCount')};

let renderer,scene,camera,player,clock,sun,skyLight,ground,water,precipitation;
let terrain,currentEcology,worldSeed=1,running=false,joystickX=0,joystickY=0,joystickPointer=null;
let toastTimer,nearest=null,lastSave=0,saveBusy=false;
const keys=new Set(),velocity=new THREE.Vector3(),desired=new THREE.Vector3(),cameraTarget=new THREE.Vector3();
const interactables=[],animals=[],plants=[],clouds=[],blockers=[];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const color=value=>new THREE.Color(value);
function hash01(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967295;}
function material(value,extra={}){return new THREE.MeshStandardMaterial({color:value,roughness:.94,...extra});}
function box(parent,value,size,pos){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material(value));mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}

function makeHumanoid(){
  const group=new THREE.Group(),skin=material(0xdca77d),shirt=material(0x526f62),trousers=material(0x3d4850),leather=material(0x564332),hair=material(0x553824);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.34,.43,.86,10),shirt);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.3,14,10),skin);
  const armGeometry=new THREE.CylinderGeometry(.085,.105,.7,7),legGeometry=new THREE.CylinderGeometry(.105,.13,.7,7);
  const armL=new THREE.Mesh(armGeometry,shirt),armR=armL.clone(),legL=new THREE.Mesh(legGeometry,trousers),legR=legL.clone();
  torso.position.y=1.28;head.position.y=1.96;armL.position.set(-.45,1.25,0);armR.position.set(.45,1.25,0);legL.position.set(-.19,.47,0);legR.position.set(.19,.47,0);
  group.add(torso,head,armL,armR,legL,legR);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.305,14,8,0,Math.PI*2,0,Math.PI*.5),hair);hairCap.position.y=2.05;group.add(hairCap);
  for(const x of[-.105,.105]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,7,5),material(0x202727));eye.position.set(x,2.01,.275);group.add(eye);}
  box(group,0x3a2a21,[.15,.055,.06],[0,1.87,.286]);
  box(group,0x44362d,[.62,.09,.46],[0,1.11,0]);
  box(group,0x5b4430,[.58,.72,.28],[0,1.3,-.34]);
  box(group,0x3b2d24,[.26,.16,.5],[-.19,.08,.08]);box(group,0x3b2d24,[.26,.16,.5],[.19,.08,.08]);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.48,18),new THREE.MeshBasicMaterial({color:0x152018,transparent:true,opacity:.26,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;group.add(shadow);
  group.userData.rig={torso,head,armL,armR,legL,legR};
  group.traverse(object=>{if(object.isMesh)object.castShadow=true;});
  return group;
}

function animatePerson(group,moving,time){
  const rig=group.userData.rig,swing=moving?Math.sin(time*.012)*.55:0;
  rig.legL.rotation.x=swing;rig.legR.rotation.x=-swing;rig.armL.rotation.x=-swing*.75;rig.armR.rotation.x=swing*.75;
  rig.torso.position.y=1.28+(moving?Math.abs(Math.sin(time*.012))*.018:0);
}

function growthFor(object){return clamp((currentEcology.plantGrowth??.58)*(.82+hash01(`${worldSeed}:${object.id}`)*.35),.28,1);}
function plantPalette(){
  const season=currentEcology.season;
  if(season==='Autumn')return{leaf:0xa76b31,herb:0x8b8745,ground:0x687043};
  if(season==='Winter')return{leaf:0x52634d,herb:0x77806d,ground:0x586357};
  if(season==='Summer')return{leaf:0x2f6a37,herb:0x72a84f,ground:0x617d43};
  return{leaf:0x3e7745,herb:0x79a85b,ground:0x69854e};
}

function addTree(object){
  const group=new THREE.Group(),growth=growthFor(object),scale=(object.scale||1)*(.62+growth*.42),palette=plantPalette();
  group.position.set(object.x,0,object.z);
  box(group,0x705039,[.48*scale,2.3*scale,.48*scale],[0,1.15*scale,0]);
  const lower=new THREE.Mesh(new THREE.ConeGeometry(1.45*scale,2.45*scale,8),material(palette.leaf));lower.position.y=2.75*scale;lower.castShadow=true;group.add(lower);
  const upper=new THREE.Mesh(new THREE.ConeGeometry(1.05*scale,2.2*scale,8),material(palette.leaf));upper.position.y=4.05*scale;upper.castShadow=true;group.add(upper);
  group.userData={growth,phase:hash01(object.id)*Math.PI*2};scene.add(group);plants.push(group);
  const stage=growth>.78?'mature':growth>.5?'growing':'young';
  interactables.push({label:`${stage} tree`,message:()=>`A ${stage} tree. Local plant growth is ${Math.round(currentEcology.plantGrowth*100)}% and soil moisture is ${Math.round(currentEcology.soilMoisture*100)}%.`,object:group,radius:2.2});
}

function addRock(object){
  const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.85*(object.scale||1),1),material(0x74786f));
  mesh.position.set(object.x,.55,object.z);mesh.scale.y=.7;mesh.rotation.y=hash01(object.id)*Math.PI;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  interactables.push({label:'stone deposit',message:()=>`A persistent stone deposit, weathered by ${currentEcology.weather}.`,object:mesh,radius:1.9});
}

function addHerbs(object){
  const group=new THREE.Group(),growth=growthFor(object),palette=plantPalette();group.position.set(object.x,0,object.z);
  for(let i=0;i<7;i++){const blade=new THREE.Mesh(new THREE.ConeGeometry(.11,.52+growth*.35,5),material(palette.herb));blade.position.set((i%3-1)*.24,(.52+growth*.35)/2,(Math.floor(i/3)-.7)*.27);blade.rotation.z=(hash01(`${object.id}:${i}`)-.5)*.28;group.add(blade);}
  group.userData={growth,phase:hash01(object.id)*Math.PI*2};scene.add(group);plants.push(group);
  interactables.push({label:'wild herbs',message:()=>`These herbs are ${growth>.7?'flourishing':growth>.45?'growing':'recovering'} in the current ${currentEcology.season.toLowerCase()} conditions.`,object:group,radius:1.7});
}

function addWildlife(object){
  const group=new THREE.Group(),fur=material(0x94734c),dark=material(0x4a3828);group.position.set(object.x,0,object.z);group.rotation.y=object.heading||0;
  const body=new THREE.Mesh(new THREE.SphereGeometry(.58,12,9),fur);body.scale.set(1.45,.78,.72);body.position.y=.92;body.castShadow=true;group.add(body);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.7,8),fur);neck.position.set(0,1.3,.43);neck.rotation.x=-.35;group.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),fur);head.scale.set(.8,.8,1.15);head.position.set(0,1.62,.67);group.add(head);
  const legs=[];for(const x of[-.4,.4])for(const z of[-.22,.22])legs.push(box(group,0x59422d,[.1,.72,.1],[x,.4,z]));
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.13,.5,7),dark);tail.position.set(0,1.05,-.78);tail.rotation.x=-1;group.add(tail);
  for(const x of[-.11,.11]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.09,.32,6),fur);ear.position.set(x,1.91,.61);ear.rotation.z=x<0?.35:-.35;group.add(ear);}
  group.userData={home:new THREE.Vector3(object.x,0,object.z),target:new THREE.Vector3(object.x,0,object.z),speed:.45+hash01(object.id)*.35,phase:hash01(`${object.id}:phase`)*Math.PI*2,nextTurn:0,behavior:'grazing',legs,head,tail};
  scene.add(group);animals.push(group);
  interactables.push({label:'reed-runner',message:()=>{const b=group.userData.behavior;return `This reed-runner is ${b}. The local herd is ${currentEcology.wildlife} strong, with ${Math.round(currentEcology.forage*100)}% forage available.`;},object:group,radius:2.5});
}

function buildHomestead(){
  const home=new THREE.Group();home.position.set(terrain.homestead.x,0,terrain.homestead.z);
  box(home,0x8d7657,[4.5,2.8,4],[0,1.4,0]);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.6,1.8,4),material(0x4c3529));roof.position.y=3.65;roof.rotation.y=Math.PI/4;roof.castShadow=true;home.add(roof);
  box(home,0x51372a,[.9,1.65,.12],[0,.83,2.06]);box(home,0xe5c27f,[.12,.12,.05],[.28,.84,2.14]);
  scene.add(home);blockers.push({x:terrain.homestead.x,z:terrain.homestead.z,halfX:2.65,halfZ:2.4});
  interactables.push({label:'homestead',message:()=>`Your persistent homestead. It is ${statusForWeather()} outside.`,object:home,radius:4.2});
}

function addCloud(index){
  const group=new THREE.Group();for(let i=0;i<5;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2.2+i*.12,10,7),new THREE.MeshStandardMaterial({color:0xd9e1df,transparent:true,opacity:.72,depthWrite:false}));puff.scale.y=.55;puff.position.set((i-2)*1.65,(i%2)*.45,0);group.add(puff);}group.position.set(-28+index*18,18+index%2*2,-20+(index%3)*18);scene.add(group);clouds.push(group);
}

function makePrecipitation(){
  const count=420,positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){positions[i*3]=(hash01(`rain-x-${i}`)-.5)*42;positions[i*3+1]=2+hash01(`rain-y-${i}`)*22;positions[i*3+2]=(hash01(`rain-z-${i}`)-.5)*42;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  precipitation=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xb9d8e7,size:.07,transparent:true,opacity:.7,depthWrite:false}));precipitation.visible=false;scene.add(precipitation);
}

function build(data){
  terrain=data.world.terrain;currentEcology=data.world.ecology;worldSeed=data.world.seed;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,210);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;worldEl.replaceChildren(renderer.domElement);
  skyLight=new THREE.HemisphereLight(0xc7e7ff,0x38442d,2.1);scene.add(skyLight);
  sun=new THREE.DirectionalLight(0xffedc6,2.45);sun.position.set(15,24,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  ground=new THREE.Mesh(new THREE.BoxGeometry(terrain.size,1,terrain.size),material(plantPalette().ground));ground.position.y=-.5;ground.receiveShadow=true;scene.add(ground);
  water=new THREE.Mesh(new THREE.CylinderGeometry(terrain.water.radius,terrain.water.radius,.16,36),material(0x4c8190,{roughness:.28,transparent:true,opacity:.88}));water.position.set(terrain.water.x,.02,terrain.water.z);scene.add(water);
  const farm=new THREE.Mesh(new THREE.BoxGeometry(terrain.farmland.width,.04,terrain.farmland.depth),material(0x806b42));farm.position.set(terrain.farmland.x,.03,terrain.farmland.z);scene.add(farm);
  for(let row=-3;row<=3;row++){const line=box(scene,0x5f4b2e,[terrain.farmland.width-.5,.025,.08],[terrain.farmland.x,.06,terrain.farmland.z+row]);line.receiveShadow=true;}
  buildHomestead();
  for(const object of terrain.objects){if(object.kind==='tree')addTree(object);else if(object.kind==='rock')addRock(object);else if(object.kind==='herbs')addHerbs(object);else if(object.kind==='wildlife')addWildlife(object);}
  for(let i=0;i<4;i++)addCloud(i);makePrecipitation();
  player=makeHumanoid();player.position.set(Number(data.session.position.x)||0,0,Number(data.session.position.z)||8);scene.add(player);
  camera.position.set(player.position.x+12,14,player.position.z+12);clock=new THREE.Clock();
  $('worldName').textContent=data.world.name;for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(data.inventory[key]||0);
  applyLivingVisuals();updateStatus();loading.hidden=true;running=true;resize();animate();
  if(data.catchUp.steps)showToast(`Your world lived through ${data.catchUp.steps} ecology step${data.catchUp.steps===1?'':'s'} while you were away.`);
}

function statusForWeather(){const weather=String(currentEcology.weather||'clear');return weather==='clear'?'clear':weather.replace('heavy rain','raining heavily').replace('rain','raining');}
function applyLivingVisuals(){
  const weather=currentEcology.weather||'clear',snow=weather==='snow',wet=weather==='rain'||weather==='heavy rain';
  const sky=snow?0xaebbc1:wet?0x71858d:currentEcology.season==='Winter'?0x9eb5bb:0x8fb5be;
  scene.background=color(sky);scene.fog=new THREE.Fog(sky,wet?28:40,wet?76:104);
  ground.material.color.copy(color(plantPalette().ground)).lerp(color(0xdde5df),Number(currentEcology.snowCover||0)*.78);
  water.material.color.set(wet?0x385f71:0x4c8190);
  precipitation.visible=wet||snow;precipitation.material.color.set(snow?0xf4f7f6:0xaecfe0);precipitation.material.size=snow?.13:.07;
  for(const cloud of clouds)cloud.visible=weather!=='clear';
}

function updateStatus(){
  const hour=((Number(currentEcology.worldHour)||0)+new Date().getMinutes()/60)%24;
  const hours=Math.floor(hour),minutes=Math.floor((hour-hours)*60);
  statusEls.clock.textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  statusEls.season.textContent=currentEcology.season||'Spring';statusEls.weather.textContent=String(currentEcology.weather||'clear').replace(/^./,letter=>letter.toUpperCase());statusEls.temperature.textContent=`${Math.round(Number(currentEcology.temperatureC)||0)}°C`;
}

function showToast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3400);}
function collides(x,z){return blockers.some(block=>Math.abs(x-block.x)<block.halfX&&Math.abs(z-block.z)<block.halfZ);}
function updatePlayer(dt,time){
  desired.set(joystickX,0,joystickY);if(keys.has('w')||keys.has('arrowup'))desired.z-=1;if(keys.has('s')||keys.has('arrowdown'))desired.z+=1;if(keys.has('a')||keys.has('arrowleft'))desired.x-=1;if(keys.has('d')||keys.has('arrowright'))desired.x+=1;
  const strength=Math.min(1,desired.length());if(strength){desired.normalize().multiplyScalar(5.2*strength);velocity.lerp(desired,Math.min(1,dt*10));player.rotation.y=Math.atan2(velocity.x,velocity.z);}else velocity.lerp(new THREE.Vector3(),Math.min(1,dt*9));
  const nextX=clamp(player.position.x+velocity.x*dt,-33,33),nextZ=clamp(player.position.z+velocity.z*dt,-33,33);if(!collides(nextX,player.position.z))player.position.x=nextX;if(!collides(player.position.x,nextZ))player.position.z=nextZ;
  animatePerson(player,strength>.05,time);cameraTarget.copy(player.position).add(new THREE.Vector3(12,14,12));camera.position.lerp(cameraTarget,Math.min(1,dt*3.5));camera.lookAt(player.position.x,.65,player.position.z);
}

function updateAnimals(dt,time){
  const drought=Number(currentEcology.drought||0),forage=Number(currentEcology.forage||.6);
  for(const animal of animals){
    const data=animal.userData,distanceToPlayer=animal.position.distanceTo(player.position);
    if(distanceToPlayer<3.2){data.behavior='fleeing';data.target.copy(animal.position).sub(player.position).normalize().multiplyScalar(7).add(animal.position);data.nextTurn=time+2500;}
    else if(time>data.nextTurn){
      const seekWater=drought>.58&&hash01(`${worldSeed}:${Math.floor(time/7000)}:${data.phase}`)>.45;
      if(seekWater){data.behavior='seeking water';data.target.set(terrain.water.x+(hash01(`${data.phase}:wx`)-.5)*6,0,terrain.water.z+(hash01(`${data.phase}:wz`)-.5)*6);}
      else if(forage>.42){data.behavior='grazing';const angle=hash01(`${Math.floor(time/5000)}:${data.phase}`)*Math.PI*2;data.target.copy(data.home).add(new THREE.Vector3(Math.cos(angle)*7,0,Math.sin(angle)*7));}
      else{data.behavior='foraging';const angle=hash01(`${Math.floor(time/6500)}:${data.phase}:f`)*Math.PI*2;data.target.set(Math.cos(angle)*24,0,Math.sin(angle)*24);}
      data.nextTurn=time+4200+hash01(`${time}:${data.phase}`)*4200;
    }
    const offset=data.target.clone().sub(animal.position),moving=offset.length()>.6;if(moving){offset.normalize();animal.position.addScaledVector(offset,dt*data.speed*(data.behavior==='fleeing'?2.3:1));animal.rotation.y=Math.atan2(offset.x,offset.z);}
    const gait=moving?Math.sin(time*.009+data.phase)*.4:0;data.legs.forEach((leg,index)=>leg.rotation.x=index%2?gait:-gait);data.head.rotation.x=data.behavior==='grazing'?.5+Math.sin(time*.003+data.phase)*.12:0;data.tail.rotation.z=Math.sin(time*.006+data.phase)*.22;
  }
}

function updateEnvironment(dt,time){
  const hour=(Number(currentEcology.worldHour)||8)+time/60000*.18,sunAngle=(hour%24)/24*Math.PI*2-Math.PI/2,daylight=clamp(Math.sin(sunAngle)*1.5+.35,.12,1);
  sun.position.set(Math.cos(sunAngle)*28,6+Math.max(0,Math.sin(sunAngle))*28,12);sun.intensity=daylight*2.5;skyLight.intensity=.45+daylight*1.65;
  for(const cloud of clouds){cloud.position.x+=dt*(.35+Number(currentEcology.wind||.2));if(cloud.position.x>42)cloud.position.x=-42;}
  for(const plant of plants)plant.rotation.z=Math.sin(time*.0018+plant.userData.phase)*.012*Number(currentEcology.wind||.2);
  if(precipitation.visible){const positions=precipitation.geometry.attributes.position.array,snow=currentEcology.weather==='snow';precipitation.position.x=player.position.x;precipitation.position.z=player.position.z;for(let i=0;i<positions.length/3;i++){positions[i*3+1]-=dt*(snow?2.2:13)*(currentEcology.weather==='heavy rain'?1.4:1);positions[i*3]+=snow?Math.sin(time*.001+i)*dt*.3:0;if(positions[i*3+1]<0)positions[i*3+1]=22;}precipitation.geometry.attributes.position.needsUpdate=true;}
  water.position.y=.02+Math.sin(time*.0015)*.025;
}

function updateNearest(){let best=null,distance=Infinity;for(const item of interactables){const d=player.position.distanceTo(item.object.position);if(d<item.radius&&d<distance){best=item;distance=d;}}nearest=best;promptEl.hidden=!best;if(best)promptEl.textContent=`Inspect ${best.label}`;}
function interact(){if(nearest)showToast(typeof nearest.message==='function'?nearest.message():nearest.message);}
async function savePosition(){if(!running||saveBusy)return;saveBusy=true;try{await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:localStorage.getItem(CLIENT_KEY),action:'save_position',position:{x:Number(player.position.x.toFixed(3)),z:Number(player.position.z.toFixed(3))}})});}catch{}finally{saveBusy=false;}}
function requestKey(action){return`${action}-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;}
async function leave(){if(!running)return;returnTown.disabled=true;await savePosition();try{const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:localStorage.getItem(CLIENT_KEY),action:'return_public',idempotencyKey:requestKey('return'),position:{x:player.position.x,z:player.position.z}})}),data=await response.json();if(!data.ok)throw Error(data.error||'return_failed');sessionStorage.setItem('gptworld-public-spawn',JSON.stringify(data.position));location.assign('./index.html?from=private');}catch{showToast('Return failed. Your world remains saved; try again.');returnTown.disabled=false;}}
function resize(){if(!renderer)return;const width=worldEl.clientWidth,height=worldEl.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
function animate(time=0){if(!running)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);updatePlayer(dt,time);updateAnimals(dt,time);updateEnvironment(dt,time);updateNearest();if(time-lastSave>5000){savePosition();lastSave=time;}renderer.render(scene,camera);}
async function load(){retry.hidden=true;const clientId=localStorage.getItem(CLIENT_KEY);if(!clientId){loadingTitle.textContent='No registered traveler';loadingMessage.textContent='Enter the public town first so the server can identify your world owner.';return;}try{const response=await fetch(`${API}?clientId=${encodeURIComponent(clientId)}`,{cache:'no-store'}),data=await response.json();if(!data.ok)throw Error(data.error||'load_failed');build(data);}catch(error){loadingTitle.textContent='Your world could not open';loadingMessage.textContent=error.message==='living_worlds_migration_required'?'The Living Worlds database migration has not been applied.':'Your public progress is safe. Try loading the private world again.';retry.hidden=false;}}

window.addEventListener('keydown',event=>{const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){keys.add(key);event.preventDefault();}if(key==='e'||key===' '){interact();event.preventDefault();}});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('resize',resize);
window.addEventListener('pagehide',()=>{if(running)navigator.sendBeacon?.(API,new Blob([JSON.stringify({clientId:localStorage.getItem(CLIENT_KEY),action:'save_position',position:{x:player.position.x,z:player.position.z}})],{type:'application/json'}));});
actionButton.addEventListener('click',interact);returnTown.addEventListener('click',leave);retry.addEventListener('click',load);

const joystick=$('joystick'),joystickKnob=$('joystickKnob');
function updateJoystick(event){const bounds=joystick.getBoundingClientRect(),centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2,max=bounds.width*.32;let dx=event.clientX-centerX,dy=event.clientY-centerY,distance=Math.hypot(dx,dy);if(distance>max){dx=dx/distance*max;dy=dy/distance*max;}joystickX=dx/max;joystickY=dy/max;if(Math.hypot(joystickX,joystickY)<.12)joystickX=joystickY=0;joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
function resetJoystick(){joystickPointer=null;joystickX=joystickY=0;joystick.classList.remove('active');joystickKnob.style.transform='translate(-50%,-50%)';}
joystick.addEventListener('pointerdown',event=>{event.preventDefault();joystickPointer=event.pointerId;joystick.setPointerCapture?.(event.pointerId);joystick.classList.add('active');updateJoystick(event);});joystick.addEventListener('pointermove',event=>{if(event.pointerId===joystickPointer)updateJoystick(event);});joystick.addEventListener('pointerup',event=>{if(event.pointerId===joystickPointer)resetJoystick();});joystick.addEventListener('pointercancel',resetJoystick);

load();
