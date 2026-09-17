import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import {cachePrivateWorld,clearQueuedPrivatePosition,getCachedPrivateWorld,getQueuedPrivatePosition,queuePrivatePosition} from './private-world-cache.mjs?v=living-worlds-5';

const API='/.netlify/functions/private-world';
const CRAFTING_API='/.netlify/functions/crafting';
const CLIENT_KEY='gptworld-client-id';
const $=id=>document.getElementById(id);
const worldEl=$('world'),loading=$('loading'),loadingTitle=$('loadingTitle'),loadingMessage=$('loadingMessage');
const retry=$('retry'),returnTown=$('returnTown'),promptEl=$('prompt'),toastEl=$('toast'),actionButton=$('actionButton');
const statusEls={clock:$('privateClock'),season:$('season'),weather:$('weather'),temperature:$('temperature')};
const inventoryEls={wood:$('woodCount'),stone:$('stoneCount'),herbs:$('herbCount')};
const syncStateEl=$('syncState');
const craftingPanel=$('craftingPanel'),craftingResult=$('craftingResult'),craftingSkills=$('craftingSkills'),craftingRecipes=$('craftingRecipes'),craftedItems=$('craftedItems'),craftButton=$('craftButton'),closeCrafting=$('closeCrafting');
const craftedUsePanel=$('craftedUsePanel'),craftedUseTitle=$('craftedUseTitle'),craftedUseIcon=$('craftedUseIcon'),craftedUseStatus=$('craftedUseStatus'),craftedUseControls=$('craftedUseControls'),closeCraftedUse=$('closeCraftedUse');

let renderer,scene,camera,player,clock,sun,skyLight,ground,water,precipitation;
let terrain,currentEcology,worldSeed=1,running=false,joystickX=0,joystickY=0,joystickPointer=null;
let toastTimer,nearest=null,lastSave=0,lastLivingRefresh=0,saveBusy=false,livingRefreshBusy=false,gatherBusy=false,craftBusy=false,itemBusy=false,activeClientId='',cacheAvailable=true,loadedPayload=null,craftingData=null;
const keys=new Set(),velocity=new THREE.Vector3(),desired=new THREE.Vector3(),cameraTarget=new THREE.Vector3();
const interactables=[],animals=[],plants=[],clouds=[],blockers=[];
const resourceStates=new Map(),resourceVisuals=new Map();
const placedCrafts=new Map();
const livingEntityObjects=new Map();
const craftRaycaster=new THREE.Raycaster(),craftPointer=new THREE.Vector2();
let craftTapStart=null;

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const color=value=>new THREE.Color(value);
function hash01(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967295;}
function material(value,extra={}){return new THREE.MeshStandardMaterial({color:value,roughness:.94,...extra});}
function box(parent,value,size,pos){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material(value));mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function setSyncState(state,label){syncStateEl.dataset.state=state;syncStateEl.textContent=label||({connecting:'Connecting',synced:'Synced',offline:'Offline',failed:'Sync failed'}[state]||state);}

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

function applyResourceVisual(nodeId){
  const state=resourceStates.get(nodeId),visual=resourceVisuals.get(nodeId);if(!state||!visual)return;
  const ratio=clamp(Number(state.remaining||0)/Math.max(1,Number(state.maxAmount||1)),0,1),kind=visual.userData.resourceKind;
  const scale=ratio>0?.58+ratio*.42:kind==='rock'?.28:.2,base=visual.userData.resourceBaseScale;visual.scale.copy(base).multiplyScalar(scale);
  visual.traverse(child=>{if(!child.isMesh)return;child.material.transparent=ratio<=0;child.material.opacity=ratio<=0?.34:1;});
}

function registerResource(object,visual,label){
  const state=resourceStates.get(object.id);visual.userData.resourceKind=object.kind;visual.userData.resourceBaseScale=visual.scale.clone();resourceVisuals.set(object.id,visual);applyResourceVisual(object.id);
  interactables.push({label,nodeId:object.id,resource:state?.resource||({tree:'wood',rock:'stone',herbs:'herbs'}[object.kind]),object:visual,radius:object.kind==='tree'?2.2:1.9});
}

function addTree(object){
  const group=new THREE.Group(),growth=growthFor(object),scale=(object.scale||1)*(.62+growth*.42),palette=plantPalette();
  group.position.set(object.x,0,object.z);
  box(group,0x705039,[.48*scale,2.3*scale,.48*scale],[0,1.15*scale,0]);
  const lower=new THREE.Mesh(new THREE.ConeGeometry(1.45*scale,2.45*scale,8),material(palette.leaf));lower.position.y=2.75*scale;lower.castShadow=true;group.add(lower);
  const upper=new THREE.Mesh(new THREE.ConeGeometry(1.05*scale,2.2*scale,8),material(palette.leaf));upper.position.y=4.05*scale;upper.castShadow=true;group.add(upper);
  group.userData={growth,phase:hash01(object.id)*Math.PI*2};scene.add(group);plants.push(group);
  const stage=growth>.78?'mature':growth>.5?'growing':'young';
  registerResource(object,group,`${stage} tree`);
}

function addRock(object){
  const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.85*(object.scale||1),1),material(0x74786f));
  mesh.position.set(object.x,.55,object.z);mesh.scale.y=.7;mesh.rotation.y=hash01(object.id)*Math.PI;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  registerResource(object,mesh,'stone deposit');
}

function addHerbs(object){
  const group=new THREE.Group(),growth=growthFor(object),palette=plantPalette();group.position.set(object.x,0,object.z);
  for(let i=0;i<9;i++){const height=.68+growth*.48,blade=new THREE.Mesh(new THREE.ConeGeometry(.16,height,6),material(i%3?palette.herb:0x4d7b3b));blade.position.set((i%3-1)*.3,height/2,(Math.floor(i/3)-1)*.3);blade.rotation.z=(hash01(`${object.id}:${i}`)-.5)*.34;group.add(blade);}
  for(const [x,z,c] of[[-.28,.1,0xe5c85f],[.2,-.18,0xd7e39a],[.34,.25,0xc98668]]){const bloom=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),material(c));bloom.position.set(x,1.02+growth*.22,z);group.add(bloom);}
  group.userData={growth,phase:hash01(object.id)*Math.PI*2};scene.add(group);plants.push(group);
  registerResource(object,group,'wild herbs');
}

function addWildlife(object){
  const predator=object.kind==='predator',species=String(object.species||'reed-runner'),baseColor=object.color?color(object.color):color(predator?0x6b4d38:species==='reed-runner'?0xb39a67:0x96784e),bodySize=clamp(Number(object.bodyScale||.8),.5,1.5);
  const group=new THREE.Group(),fur=material(baseColor),dark=material(predator?0x3f3027:0x4a3828);group.position.set(object.x,0,object.z);group.rotation.y=-Number(object.heading||0);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.58,12,9),fur);body.scale.set(.72,.78,1.45);body.position.y=.92;body.castShadow=true;group.scale.setScalar(.78+bodySize*.28);group.add(body);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.7,8),fur);neck.position.set(0,1.3,.58);neck.rotation.x=-.35;group.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),fur);head.scale.set(.8,.8,1.15);head.position.set(0,1.62,.88);group.add(head);
  const legs=[];for(const x of[-.22,.22])for(const z of[-.4,.4])legs.push(box(group,0x59422d,[.1,.72,.1],[x,.4,z]));
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.13,.5,7),dark);tail.position.set(0,1.05,-.9);tail.rotation.x=-1;group.add(tail);
  for(const x of[-.11,.11]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.09,.32,6),fur);ear.position.set(x,1.91,.82);ear.rotation.z=x<0?.35:-.35;group.add(ear);}
  group.userData={home:new THREE.Vector3(object.x,0,object.z),target:new THREE.Vector3(object.x,0,object.z),speed:object.serverDriven?1.35+hash01(object.id)*.45:.45+hash01(object.id)*.35,phase:hash01(`${object.id}:phase`)*Math.PI*2,nextTurn:0,behavior:object.behavior||'grazing',legs,head,tail,serverDriven:Boolean(object.serverDriven),entityId:object.entityId||null,species,kind:object.kind||'herbivore'};
  scene.add(group);animals.push(group);
  interactables.push({label:species.replaceAll('-',' '),livingEntityId:object.entityId||null,message:()=>{const b=group.userData.behavior;return `This ${species.replaceAll('-',' ')} is ${b}. Wildlife follows the same weather, migration, feeding, and predator rules as the public valley.`;},object:group,radius:2.5});
  return group;
}

function addLivingPlant(entity){
  const group=new THREE.Group(),width=Math.max(.08,Number(entity.width||.4)),height=Math.max(.08,Number(entity.height||.4)),depth=Math.max(.08,Number(entity.depth||.4));
  group.position.set(Number(entity.x||0),0,Number(entity.z||0));const part=String(entity.part||'');
  if(part==='blade'){const mesh=new THREE.Mesh(new THREE.ConeGeometry(Math.max(.06,width*.48),height,6),material(entity.color||0x6f9b55));mesh.position.y=height/2;mesh.rotation.z=.08;group.add(mesh);}
  else if(part==='stem'){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(width*.3,width*.46,height,7),material(entity.color||0x684b32));mesh.position.y=height/2;group.add(mesh);}
  else if(part==='crown'){const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.5,1),material(entity.color||0x4f793e));mesh.position.y=Math.max(.38,height*.72);mesh.scale.set(width,height,depth);group.add(mesh);}
  else if(part==='flower'){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.5,9,7),material(entity.color||0xd8bd62));mesh.position.y=Math.max(.18,height*.8);mesh.scale.set(width,height,depth);group.add(mesh);}
  else box(group,entity.color||0x5f7f48,[width,height,depth],[0,height/2,0]);
  group.userData={phase:hash01(entity.id)*Math.PI*2,entityId:String(entity.id),livingPlant:true};scene.add(group);plants.push(group);
  if(part==='crown'||part==='plant-patch'||String(entity.id).endsWith('-center')){const label=String(entity.speciesName||entity.species||'wild plant').replaceAll('-',' ');interactables.push({type:'plant',label,livingEntityId:String(entity.id),object:group,radius:2.5,message:`${label}${entity.stage?` · ${String(entity.stage).replaceAll('-',' ')}`:''}. A living part of this world’s ecology.`});}
  return group;
}

function removeLivingEntity(id){
  const object=livingEntityObjects.get(id);if(!object)return;scene.remove(object);livingEntityObjects.delete(id);
  const animalIndex=animals.indexOf(object);if(animalIndex>=0)animals.splice(animalIndex,1);const plantIndex=plants.indexOf(object);if(plantIndex>=0)plants.splice(plantIndex,1);
  for(let index=interactables.length-1;index>=0;index--)if(interactables[index].livingEntityId===id)interactables.splice(index,1);
  object.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
}

function syncLivingEntities(entities=[]){
  const visible=entities.filter(entity=>entity?.id&&(entity.part==='creature'||entity.species||entity.part==='plant-patch'));
  const nextIds=new Set(visible.map(entity=>String(entity.id)));
  for(const id of livingEntityObjects.keys())if(!nextIds.has(id))removeLivingEntity(id);
  for(const entity of visible){
    const id=String(entity.id),creature=entity.part==='creature',existing=livingEntityObjects.get(id);
    if(existing){
      if(creature){existing.userData.target.set(Number(entity.x||0),0,Number(entity.z||0));existing.userData.behavior=entity.behavior||existing.userData.behavior;existing.userData.serverDriven=true;}
      else existing.position.set(Number(entity.x||0),0,Number(entity.z||0));
      continue;
    }
    const object=creature?addWildlife({...entity,id,entityId:id,serverDriven:true}):addLivingPlant(entity);livingEntityObjects.set(id,object);
  }
}

function addCloud(index){
  const group=new THREE.Group();for(let i=0;i<5;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2.2+i*.12,10,7),new THREE.MeshStandardMaterial({color:0xd9e1df,transparent:true,opacity:.72,depthWrite:false}));puff.scale.y=.55;puff.position.set((i-2)*1.65,(i%2)*.45,0);group.add(puff);}group.position.set(-28+index*18,18+index%2*2,-20+(index%3)*18);scene.add(group);clouds.push(group);
}

function makeCampfireFlame(item){
  // Crafted sprites are bottom-anchored. Lift the flame to the center of the
  // illustrated stone ring instead of leaving it at the sprite's ground point.
  const group=new THREE.Group();group.position.set(item.x,1,item.z);group.visible=false;
  const flameMaterial=(value,opacity)=>new THREE.MeshBasicMaterial({color:value,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  const flame=(radius,height,value,opacity,x,y,z,phase)=>{const mesh=new THREE.Mesh(new THREE.ConeGeometry(radius,height,7),flameMaterial(value,opacity));mesh.position.set(x,y,z);mesh.userData={baseX:x,baseY:y,phase};group.add(mesh);return mesh;};
  const flames=[
    flame(.34,1.05,0xff5a16,.72,0,.82,0,0),
    flame(.24,.82,0xffa21c,.88,-.08,.72,.04,1.7),
    flame(.15,.58,0xffed82,.95,.09,.58,-.02,3.1),
    flame(.12,.48,0xff7a18,.78,.26,.48,.02,4.4),
    flame(.1,.4,0xffc13b,.84,-.25,.44,-.03,5.6)
  ];
  const emberCount=10,positions=new Float32Array(emberCount*3),emberSeeds=[];
  for(let i=0;i<emberCount;i++){const angle=hash01(`${item.id}:ember-angle:${i}`)*Math.PI*2,radius=.08+hash01(`${item.id}:ember-radius:${i}`)*.3;positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=.42+hash01(`${item.id}:ember-height:${i}`)*1.2;positions[i*3+2]=Math.sin(angle)*radius;emberSeeds.push(hash01(`${item.id}:ember-rise:${i}`));}
  const emberGeometry=new THREE.BufferGeometry();emberGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const embers=new THREE.Points(emberGeometry,new THREE.PointsMaterial({color:0xffb13b,size:.075,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(embers);
  const light=new THREE.PointLight(0xff9a32,0,10,2);light.position.set(0,1.05,0);group.add(light);
  group.userData={flames,embers,emberSeeds,emberBase:positions.slice(),light,phase:hash01(`${item.id}:fire-phase`)*Math.PI*2};scene.add(group);return group;
}

function makeCrateStorageLabel(item){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=82;
  const texture=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  label.scale.set(2.9,.74,1);label.position.set(item.x,3.05,item.z);label.userData={canvas,texture};scene.add(label);return label;
}

function refreshCrateStorageLabel(sprite,item){
  if(item.key!=='wooden-crate')return;const storage=item.storage||{wood:0,stone:0,herbs:0,capacity:60},used=Number(storage.wood||0)+Number(storage.stone||0)+Number(storage.herbs||0);
  const label=sprite.userData.storageLabel||(sprite.userData.storageLabel=makeCrateStorageLabel(item)),canvas=label.userData.canvas,context=canvas.getContext('2d');
  context.clearRect(0,0,canvas.width,canvas.height);label.visible=used>0;if(!used)return;
  context.fillStyle='rgba(17,31,21,.9)';context.fillRect(4,4,312,74);context.strokeStyle='#d2b36a';context.lineWidth=5;context.strokeRect(4,4,312,74);
  context.fillStyle='#f4e3b9';context.font='700 30px system-ui,sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(`Stored ${used} / ${Number(storage.capacity||60)}`,160,42);label.userData.texture.needsUpdate=true;
}

function addPlacedCraft(item){
  if(placedCrafts.has(String(item.id)))return;
  const texture=new THREE.TextureLoader().load(craftingIcon(item.key));texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.08,depthWrite:false}));
  sprite.center.set(.5,0);sprite.scale.set(2.8,2.8,1);sprite.position.set(item.x,.04,item.z);sprite.userData.item=item;
  if(item.key==='campfire-kit'){const fireGroup=makeCampfireFlame(item);sprite.userData.fireGroup=fireGroup;sprite.userData.fireLight=fireGroup.userData.light;}
  scene.add(sprite);placedCrafts.set(String(item.id),sprite);refreshPlacedCraft(item);refreshCrateStorageLabel(sprite,item);
  interactables.push({label:item.name,placedItemId:String(item.id),object:sprite,radius:2.6});
}
function removePlacedCraft(itemId){
  const id=String(itemId),sprite=placedCrafts.get(id);if(!sprite)return;scene.remove(sprite);sprite.material.map?.dispose();sprite.material.dispose();if(sprite.userData.fireGroup){scene.remove(sprite.userData.fireGroup);sprite.userData.fireGroup.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});}if(sprite.userData.storageLabel){scene.remove(sprite.userData.storageLabel);sprite.userData.storageLabel.material.map?.dispose();sprite.userData.storageLabel.material.dispose();}placedCrafts.delete(id);
  const index=interactables.findIndex(item=>item.placedItemId===id);if(index>=0)interactables.splice(index,1);
}

function makePrecipitation(){
  const count=420,positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){positions[i*3]=(hash01(`rain-x-${i}`)-.5)*42;positions[i*3+1]=2+hash01(`rain-y-${i}`)*22;positions[i*3+2]=(hash01(`rain-z-${i}`)-.5)*42;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  precipitation=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xb9d8e7,size:.07,transparent:true,opacity:.7,depthWrite:false}));precipitation.visible=false;scene.add(precipitation);
}

function build(data){
  loadedPayload=data;terrain=data.world.terrain;currentEcology=data.world.ecology;worldSeed=data.world.seed;
  resourceStates.clear();for(const node of data.world.resources||[])resourceStates.set(node.nodeId,node);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,210);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;worldEl.replaceChildren(renderer.domElement);
  skyLight=new THREE.HemisphereLight(0xc7e7ff,0x38442d,2.1);scene.add(skyLight);
  sun=new THREE.DirectionalLight(0xffedc6,2.45);sun.position.set(15,24,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  ground=new THREE.Mesh(new THREE.BoxGeometry(terrain.size,1,terrain.size),material(plantPalette().ground));ground.position.y=-.5;ground.receiveShadow=true;scene.add(ground);
  water=new THREE.Mesh(new THREE.CylinderGeometry(terrain.water.radius,terrain.water.radius,.16,36),material(0x4c8190,{roughness:.28,transparent:true,opacity:.88}));water.position.set(terrain.water.x,.02,terrain.water.z);scene.add(water);
  // Personal worlds begin undeveloped. The homestead and fertile site are
  // persisted as future build locations, but nothing is constructed or tilled.
  const hasLivingAnimals=(data.world.livingEntities||[]).some(entity=>entity.part==='creature');
  for(const object of terrain.objects){if(object.kind==='tree')addTree(object);else if(object.kind==='rock')addRock(object);else if(object.kind==='herbs')addHerbs(object);else if(object.kind==='wildlife'&&!hasLivingAnimals)addWildlife(object);}
  syncLivingEntities(data.world.livingEntities||[]);
  for(let i=0;i<4;i++)addCloud(i);makePrecipitation();
  player=makeHumanoid();player.position.set(Number(data.session.position.x)||0,0,Number(data.session.position.z)||8);scene.add(player);
  for(const item of data.world.placedItems||[])addPlacedCraft(item);
  camera.position.set(player.position.x+12,14,player.position.z+12);clock=new THREE.Clock();
  $('worldName').textContent=data.world.name;for(const [key,element] of Object.entries(inventoryEls))element.textContent=data.fromCache?'—':Number(data.inventory?.[key]||0);
  applyLivingVisuals();updateStatus();loading.hidden=true;running=true;resize();animate();
  if(data.fromCache)showToast('Offline world loaded. Inventory is hidden until the server reconnects.');
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
function resourceText(inputs){return Object.entries(inputs).filter(([,amount])=>amount>0).map(([resource,amount])=>`${amount} ${resource}`).join(' · ');}
function craftingIcon(key){return `./assets/crafting/${encodeURIComponent(key)}.webp`;}
function campfireBurning(item){return item?.key==='campfire-kit'&&Date.parse(item.metadata?.campfire?.litUntil||0)>Date.now()&&currentEcology?.weather!=='heavy rain';}
function refreshPlacedCraft(item){const sprite=placedCrafts.get(String(item.id));if(!sprite)return;sprite.userData.item=item;if(sprite.userData.fireLight){const burning=campfireBurning(item);sprite.userData.fireGroup.visible=burning;sprite.userData.fireLight.intensity=burning?4.2:0;sprite.material.color.set(burning?0xffd59a:0xffffff);}refreshCrateStorageLabel(sprite,item);}
function updatePlacedItemState(itemId,changes){
  const sprite=placedCrafts.get(String(itemId));if(!sprite)return null;const item=Object.assign(sprite.userData.item,changes);refreshPlacedCraft(item);
  if(loadedPayload?.world){const saved=(loadedPayload.world.placedItems||[]).find(entry=>String(entry.id)===String(itemId));if(saved)Object.assign(saved,changes);cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}return item;
}
function canAfford(recipe){return Object.entries(recipe.inputs).every(([resource,amount])=>Number(craftingData?.inventory?.[resource]||0)>=amount);}
function showCraftingResult(data,recipe){
  const title=document.createElement('strong'),detail=document.createElement('span'),before=Number(data.skill.before),after=Number(data.skill.value),gain=Math.max(0,after-before);
  craftingResult.dataset.outcome=data.success?'success':'failure';
  title.textContent=data.success?`Success — ${data.quality} ${recipe.name}`:`Attempt failed — ${recipe.name}`;
  detail.textContent=`${data.skill.key[0].toUpperCase()+data.skill.key.slice(1)} ${before.toFixed(2)} → ${after.toFixed(2)} (+${gain.toFixed(2)}). ${data.success?'Item added to your possessions.':'Some materials were lost.'}`;
  craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;craftingResult.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function showCraftingError(message){
  const title=document.createElement('strong'),detail=document.createElement('span');title.textContent='Crafting could not complete';detail.textContent=message;
  craftingResult.dataset.outcome='failure';craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;craftingResult.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderCrafting(){
  if(!craftingData)return;
  craftingSkills.replaceChildren(...craftingData.skills.map(skill=>{const card=document.createElement('div');card.className='crafting-skill';const name=document.createElement('strong'),progress=document.createElement('span');name.textContent=skill.key[0].toUpperCase()+skill.key.slice(1);progress.textContent=`${skill.value.toFixed(2)} skill · ${skill.attempts} attempts`;card.append(name,progress);return card;}));
  craftingRecipes.replaceChildren(...craftingData.recipes.map(recipe=>{const card=document.createElement('article');card.className='recipe-card';const image=document.createElement('img'),content=document.createElement('div'),title=document.createElement('h3'),description=document.createElement('p'),meta=document.createElement('div'),cost=document.createElement('span'),chance=document.createElement('span'),button=document.createElement('button');image.className='recipe-icon';image.src=craftingIcon(recipe.key);image.alt='';image.loading='lazy';title.textContent=recipe.name;description.textContent=recipe.description;meta.className='recipe-meta';cost.textContent=resourceText(recipe.inputs);chance.textContent=`${Math.round(recipe.chance*100)}% success`;button.type='button';button.textContent=canAfford(recipe)?'Craft item':'Need materials';button.disabled=craftBusy||!canAfford(recipe);button.addEventListener('click',()=>craftRecipe(recipe));meta.append(cost,chance);content.append(title,description,meta,button);card.append(image,content);return card;}));
  craftedItems.replaceChildren(...(craftingData.items.length?craftingData.items.map(item=>{const row=document.createElement('div');row.className='crafted-item';const image=document.createElement('img'),content=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small'),button=document.createElement('button');image.src=craftingIcon(item.key);image.alt='';image.loading='lazy';title.textContent=`${item.quality} ${item.name}`;detail.textContent=item.placed?'Placed in your world · approach it to pick it up':`${item.profession} · ${item.durability}/${item.maxDurability} durability`;button.type='button';button.textContent=item.placed?'Placed':'Place';button.disabled=itemBusy||Boolean(item.placed);button.addEventListener('click',()=>placeCraftedItem(item));content.append(title,detail);row.append(image,content,button);return row;}):[Object.assign(document.createElement('div'),{className:'crafted-empty',textContent:'Your bag is empty. Crafted items will appear here.'})]));
}
async function loadCrafting(){
  if(!navigator.onLine){showToast('Reconnect to open your authoritative crafting ledger.');return false;}
  try{const response=await fetch(`${CRAFTING_API}?clientId=${encodeURIComponent(activeClientId)}`,{cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'crafting_load_failed');craftingData=data;renderCrafting();craftingResult.hidden=true;return true;}catch(error){showCraftingError(error.message==='crafting_migration_required'?'The crafting database is still updating. Close the bag and try again shortly.':'The bag could not sync. Check your connection, then close and reopen it.');return false;}
}
async function openCrafting(){
  craftingPanel.hidden=false;velocity.set(0,0,0);keys.clear();resetJoystick();craftingResult.dataset.outcome='loading';craftingResult.hidden=false;craftingResult.innerHTML='<strong>Opening your bag…</strong><span>Syncing skills, recipes, and crafted possessions.</span>';
  await loadCrafting();
}
function hideCrafting(){craftingPanel.hidden=true;}
function itemButton(label,handler,className='',unavailable=false){const button=document.createElement('button');button.type='button';button.textContent=label;button.className=className;button.disabled=itemBusy||unavailable;button.addEventListener('click',handler);return button;}
function renderCraftedUse(item){
  craftedUseTitle.textContent=item.name;craftedUseIcon.src=craftingIcon(item.key);craftedUseControls.replaceChildren();
  if(item.key==='campfire-kit'){
    const remaining=Math.max(0,Date.parse(item.metadata?.campfire?.litUntil||0)-Date.now()),burning=campfireBurning(item),rain=currentEcology?.weather==='heavy rain';
    craftedUseStatus.textContent=rain&&remaining>0?'Heavy rain suppresses the flame. Its warmth and wildlife protection will return if fuel remains.':burning?`Burning for about ${Math.max(1,Math.ceil(remaining/60000))} more minutes. Warmth, light, and wildlife protection are active nearby.`:'The campfire is cold. Add one wood to create two hours of light, warmth, and wildlife protection.';
    craftedUseControls.append(itemButton(burning?'Add 1 wood · extend fire':'Add 1 wood · light fire',()=>useCraftedItem(item,'light_campfire'),'primary'));
    if(remaining>0)craftedUseControls.append(itemButton('Extinguish fire',()=>useCraftedItem(item,'extinguish_campfire')));
  }else if(item.key==='wooden-crate'){
    const storage=item.storage||{wood:0,stone:0,herbs:0,capacity:60},used=storage.wood+storage.stone+storage.herbs;
    craftedUseStatus.textContent=`Crate storage: ${used}/${storage.capacity}. Store materials from your pack or take them back whenever you are standing nearby.`;
    for(const [resource,icon] of Object.entries({wood:'🪵',stone:'🪨',herbs:'🌿'})){
      const stored=Number(storage[resource]||0),pack=Math.max(0,Number(inventoryEls[resource]?.textContent)||0),space=Math.max(0,Number(storage.capacity||60)-used),storeAll=Math.min(pack,space),row=document.createElement('section'),heading=document.createElement('div'),actions=document.createElement('div');
      row.className='crate-resource';heading.className='crate-resource-heading';actions.className='crate-actions';heading.innerHTML=`<strong>${icon} ${resource[0].toUpperCase()+resource.slice(1)}</strong><span>Pack ${pack} · Crate ${stored}</span>`;
      actions.append(itemButton('Store 1',()=>useCraftedItem(item,'crate_transfer',{resource,direction:'deposit',amount:1}),'primary',pack<1||space<1),itemButton(`Store all (${storeAll})`,()=>useCraftedItem(item,'crate_transfer',{resource,direction:'deposit',amount:storeAll}),'primary',storeAll<1),itemButton('Take 1',()=>useCraftedItem(item,'crate_transfer',{resource,direction:'withdraw',amount:1}),'',stored<1),itemButton(`Take all (${stored})`,()=>useCraftedItem(item,'crate_transfer',{resource,direction:'withdraw',amount:stored}),'',stored<1));row.append(heading,actions);craftedUseControls.append(row);
    }
  }else craftedUseStatus.textContent='This crafted item is placed in your world.';
  craftedUseControls.append(itemButton('Return item to bag',()=>pickupCraftedItem(item),'danger'));
}
function openCraftedUse(item){craftedUsePanel.hidden=false;velocity.set(0,0,0);keys.clear();resetJoystick();renderCraftedUse(item);}
function hideCraftedUse(){craftedUsePanel.hidden=true;}
async function useCraftedItem(item,action,extra={}){
  if(itemBusy||!navigator.onLine)return;itemBusy=true;renderCraftedUse(item);await savePosition();
  try{const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action,itemId:item.id,idempotencyKey:requestKey(`${action}-${item.id}`),...extra})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'item_use_failed');
    if(data.inventory){for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(data.inventory[key]||0);if(loadedPayload)loadedPayload.inventory={...data.inventory};}
    const updated=updatePlacedItemState(item.id,{metadata:data.metadata||item.metadata,storage:data.storage||item.storage});renderCraftedUse(updated||item);
    showToast(action==='crate_transfer'?`${data.direction==='deposit'?'Stored':'Withdrew'} ${data.amount} ${data.resource}.`:action==='light_campfire'?'Campfire lit. The nearby area is now warm and protected.':'Campfire extinguished.');
  }catch(error){showToast(error.message==='campfire_cannot_be_lit'?(currentEcology?.weather==='heavy rain'?'Heavy rain prevents this campfire from lighting.':'You need one wood and must stand near the campfire.'):error.message==='crate_transfer_failed'?'Not enough material, crate space, or distance is too great.':'The item could not be used. Try again.');}
  finally{itemBusy=false;renderCraftedUse(item);}
}
async function craftRecipe(recipe){
  if(craftBusy||!canAfford(recipe))return;craftBusy=true;renderCrafting();
  try{
    const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,recipeKey:recipe.key,idempotencyKey:requestKey(`craft-${recipe.key}`)})}),data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'craft_failed');
    showCraftingResult(data,recipe);
    await loadCrafting();for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(craftingData.inventory?.[key]||0);
  }catch(error){showCraftingError(error.message==='insufficient_materials'?'You no longer have enough materials.':error.message==='private_world_required'?'Craft inside your personal world.':'Please try again. No success was recorded.');}
  finally{craftBusy=false;renderCrafting();}
}
async function placeCraftedItem(item){
  if(itemBusy||item.placed)return;itemBusy=true;renderCrafting();await savePosition();
  const position={x:clamp(player.position.x+Math.sin(player.rotation.y)*2.6,-32,32),z:clamp(player.position.z+Math.cos(player.rotation.y)*2.6,-32,32),rotation:player.rotation.y};
  try{const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'place_item',itemId:item.id,position,idempotencyKey:requestKey(`place-${item.id}`)})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'place_failed');const placed={...data.item,...data.item.placed};addPlacedCraft(placed);if(loadedPayload?.world){loadedPayload.world.placedItems=[...(loadedPayload.world.placedItems||[]).filter(entry=>String(entry.id)!==String(item.id)),placed];cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}await loadCrafting();showCraftingError(`${item.name} was placed nearby. Close your bag to see it.`);craftingResult.dataset.outcome='success';craftingResult.firstElementChild.textContent=`Placed — ${item.name}`;}catch{showCraftingError('Move to a clear nearby spot and try placing the item again.');}finally{itemBusy=false;renderCrafting();}
}
async function pickupCraftedItem(item){
  if(itemBusy)return;itemBusy=true;actionButton.disabled=true;await savePosition();
  try{const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'pickup_item',itemId:item.id,idempotencyKey:requestKey(`pickup-${item.id}`)})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'pickup_failed');removePlacedCraft(item.id);hideCraftedUse();if(loadedPayload?.world){loadedPayload.world.placedItems=(loadedPayload.world.placedItems||[]).filter(entry=>String(entry.id)!==String(item.id));cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}showToast(`${item.name} returned to your bag.`);if(craftingData)await loadCrafting();}catch{showToast(item.key==='wooden-crate'?'Empty the crate and stand nearby before returning it to your bag.':'Move closer to the item and try again.');}finally{itemBusy=false;actionButton.disabled=false;if(!craftedUsePanel.hidden)renderCraftedUse(item);}
}
function collides(x,z){return blockers.some(block=>Math.abs(x-block.x)<block.halfX&&Math.abs(z-block.z)<block.halfZ);}
function updatePlayer(dt,time){
  if(!craftingPanel.hidden||!craftedUsePanel.hidden){animatePerson(player,false,time);return;}
  desired.set(joystickX,0,joystickY);if(keys.has('w')||keys.has('arrowup'))desired.z-=1;if(keys.has('s')||keys.has('arrowdown'))desired.z+=1;if(keys.has('a')||keys.has('arrowleft'))desired.x-=1;if(keys.has('d')||keys.has('arrowright'))desired.x+=1;
  const strength=Math.min(1,desired.length());if(strength){desired.normalize().multiplyScalar(5.2*strength);velocity.lerp(desired,Math.min(1,dt*10));player.rotation.y=Math.atan2(velocity.x,velocity.z);}else velocity.lerp(new THREE.Vector3(),Math.min(1,dt*9));
  const nextX=clamp(player.position.x+velocity.x*dt,-33,33),nextZ=clamp(player.position.z+velocity.z*dt,-33,33);if(!collides(nextX,player.position.z))player.position.x=nextX;if(!collides(player.position.x,nextZ))player.position.z=nextZ;
  animatePerson(player,strength>.05,time);cameraTarget.copy(player.position).add(new THREE.Vector3(12,14,12));camera.position.lerp(cameraTarget,Math.min(1,dt*3.5));camera.lookAt(player.position.x,.65,player.position.z);
}

function updateAnimals(dt,time){
  const drought=Number(currentEcology.drought||0),forage=Number(currentEcology.forage||.6);
  for(const animal of animals){
    const data=animal.userData,distanceToPlayer=animal.position.distanceTo(player.position);
    let nearbyFire=null,fireDistance=Infinity;for(const sprite of placedCrafts.values()){if(!campfireBurning(sprite.userData.item))continue;const distance=animal.position.distanceTo(sprite.position);if(distance<7&&distance<fireDistance){nearbyFire=sprite;fireDistance=distance;}}
    if(nearbyFire){data.behavior='avoiding fire';data.target.copy(animal.position).sub(nearbyFire.position).normalize().multiplyScalar(9).add(animal.position);data.nextTurn=time+3000;}
    else if(distanceToPlayer<3.2){data.behavior='fleeing';data.target.copy(animal.position).sub(player.position).normalize().multiplyScalar(7).add(animal.position);data.nextTurn=time+2500;}
    else if(!data.serverDriven&&time>data.nextTurn){
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

async function refreshLivingWorld(){
  if(livingRefreshBusy||!navigator.onLine||!activeClientId)return;livingRefreshBusy=true;
  try{
    const response=await fetch(`${API}?clientId=${encodeURIComponent(activeClientId)}`,{cache:'no-store'}),data=await response.json();
    if(!response.ok||!data.ok)return;
    currentEcology=data.world.ecology||currentEcology;syncLivingEntities(data.world.livingEntities||[]);
    for(const node of data.world.resources||[]){resourceStates.set(node.nodeId,node);applyResourceVisual(node.nodeId);}
    for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(data.inventory?.[key]||0);
    applyLivingVisuals();updateStatus();loadedPayload={...data,session:{...data.session,position:currentPosition()}};cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});
  }catch{}finally{livingRefreshBusy=false;lastLivingRefresh=performance.now();}
}

function updateEnvironment(dt,time){
  const hour=(Number(currentEcology.worldHour)||8)+time/60000*.18,sunAngle=(hour%24)/24*Math.PI*2-Math.PI/2,daylight=clamp(Math.sin(sunAngle)*1.5+.35,.12,1);
  sun.position.set(Math.cos(sunAngle)*28,6+Math.max(0,Math.sin(sunAngle))*28,12);sun.intensity=daylight*2.5;skyLight.intensity=.45+daylight*1.65;
  for(const cloud of clouds){cloud.position.x+=dt*(.35+Number(currentEcology.wind||.2));if(cloud.position.x>42)cloud.position.x=-42;}
  for(const plant of plants)plant.rotation.z=Math.sin(time*.0018+plant.userData.phase)*.012*Number(currentEcology.wind||.2);
  if(precipitation.visible){const positions=precipitation.geometry.attributes.position.array,snow=currentEcology.weather==='snow';precipitation.position.x=player.position.x;precipitation.position.z=player.position.z;for(let i=0;i<positions.length/3;i++){positions[i*3+1]-=dt*(snow?2.2:13)*(currentEcology.weather==='heavy rain'?1.4:1);positions[i*3]+=snow?Math.sin(time*.001+i)*dt*.3:0;if(positions[i*3+1]<0)positions[i*3+1]=22;}precipitation.geometry.attributes.position.needsUpdate=true;}
  water.position.y=.02+Math.sin(time*.0015)*.025;
  for(const sprite of placedCrafts.values())if(sprite.userData.fireLight){
    refreshPlacedCraft(sprite.userData.item);const fire=sprite.userData.fireGroup;if(!fire.visible)continue;const phase=fire.userData.phase;
    fire.userData.light.intensity=3.65+Math.sin(time*.021+phase)*.55+Math.sin(time*.047+phase)*.22;
    fire.userData.flames.forEach((flame,index)=>{const wave=Math.sin(time*(.008+index*.0017)+flame.userData.phase+phase),flutter=Math.sin(time*(.019+index*.002)+phase);flame.scale.set(1+wave*.13,1+flutter*.16,1-wave*.09);flame.position.x=flame.userData.baseX+wave*.055;flame.position.y=flame.userData.baseY+flutter*.035;flame.rotation.z=wave*.08;});
    const positions=fire.userData.embers.geometry.attributes.position.array,base=fire.userData.emberBase;for(let i=0;i<fire.userData.emberSeeds.length;i++){const rise=(fire.userData.emberSeeds[i]+time*.00042)%1;positions[i*3]=base[i*3]+Math.sin(time*.004+i)*.08*rise;positions[i*3+1]=.42+rise*1.55;positions[i*3+2]=base[i*3+2]+Math.cos(time*.0035+i)*.065*rise;}fire.userData.embers.geometry.attributes.position.needsUpdate=true;
  }
}

function updateNearest(){let best=null,distance=Infinity;for(const item of interactables){const d=player.position.distanceTo(item.object.position);if(d<item.radius&&d<distance){best=item;distance=d;}}nearest=best;promptEl.hidden=!best;if(!best)return;const node=best.nodeId&&resourceStates.get(best.nodeId);promptEl.textContent=best.placedItemId?`Use ${best.label}`:node?(node.remaining>0?`Gather ${node.resource} · ${node.remaining}/${node.maxAmount}`:`${best.label} is recovering`):`Inspect ${best.label}`;}
async function gather(item){
  const node=resourceStates.get(item.nodeId);if(!node){showToast('Reconnect once to gather from this world.');return;}
  if(Number(node.remaining)<=0){showToast(node.regrowAt?`This ${item.label} is recovering.`:'This deposit has been exhausted.');return;}
  if(gatherBusy)return;if(!navigator.onLine){showToast('Gathering needs a connection so your inventory stays safe.');return;}
  gatherBusy=true;actionButton.disabled=true;
  try{
    const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'gather_resource',nodeId:item.nodeId,idempotencyKey:requestKey(`gather-${item.nodeId}`)})}),data=await response.json();
    if(!response.ok||!data.ok){if(data.node){resourceStates.set(data.node.nodeId,data.node);applyResourceVisual(data.node.nodeId);}throw Error(data.error||'gather_failed');}
    resourceStates.set(data.node.nodeId,data.node);applyResourceVisual(data.node.nodeId);
    for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(data.inventory?.[key]||0);
    if(loadedPayload?.world){loadedPayload.world.resources=[...resourceStates.values()];cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}
    showToast(`Gathered 1 ${data.gathered.resource}. ${data.node.remaining} remains here.`);
  }catch(error){showToast(error.message==='resource_depleted'?'This resource has already been gathered.':'Gathering failed. Try again.');}
  finally{gatherBusy=false;actionButton.disabled=false;}
}
function interact(){if(!nearest)return;if(nearest.placedItemId){openCraftedUse(nearest.object.userData.item);return;}if(nearest.nodeId){gather(nearest);return;}showToast(typeof nearest.message==='function'?nearest.message():nearest.message);}
function openPlacedCraftFromTap(event){
  if(!running||!craftTapStart||!craftingPanel.hidden||!craftedUsePanel.hidden)return;const distance=Math.hypot(event.clientX-craftTapStart.x,event.clientY-craftTapStart.y);craftTapStart=null;if(distance>12)return;
  const bounds=renderer.domElement.getBoundingClientRect();craftPointer.set((event.clientX-bounds.left)/bounds.width*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);craftRaycaster.setFromCamera(craftPointer,camera);
  const hit=craftRaycaster.intersectObjects([...placedCrafts.values()],false)[0];if(!hit)return;const sprite=hit.object,item=sprite.userData.item;if(player.position.distanceTo(sprite.position)>5){showToast(`Move closer to use ${item.name}.`);return;}openCraftedUse(item);
}
function currentPosition(){return{x:Number(player.position.x.toFixed(3)),z:Number(player.position.z.toFixed(3))};}
async function sendQueuedPosition(action){
  const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'save_position',position:action.position})}),data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'position_sync_failed');
  if(action.id)await clearQueuedPrivatePosition(activeClientId,action.updatedAt);
  setSyncState(cacheAvailable?'synced':'failed');return true;
}
async function flushQueuedPosition(){
  if(!activeClientId||!navigator.onLine)return false;
  try{const action=await getQueuedPrivatePosition(activeClientId);if(!action){setSyncState(cacheAvailable?'synced':'failed');return true;}return await sendQueuedPosition(action);}catch{setSyncState(navigator.onLine?'failed':'offline');return false;}
}
async function savePosition(){
  if(!running||saveBusy)return false;saveBusy=true;const position=currentPosition();let action={position,updatedAt:Date.now()};
  try{action=await queuePrivatePosition(activeClientId,position);}catch{cacheAvailable=false;setSyncState('failed');}
  if(!navigator.onLine){setSyncState('offline');saveBusy=false;return false;}
  try{return await sendQueuedPosition(action);}catch{setSyncState(navigator.onLine?'failed':'offline');return false;}finally{saveBusy=false;}
}
function requestKey(action){return`${action}-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;}
async function leave(){if(!running)return;returnTown.disabled=true;await savePosition();try{const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:localStorage.getItem(CLIENT_KEY),action:'return_public',idempotencyKey:requestKey('return'),position:{x:player.position.x,z:player.position.z}})}),data=await response.json();if(!data.ok)throw Error(data.error||'return_failed');sessionStorage.setItem('gptworld-public-spawn',JSON.stringify(data.position));location.assign('./index.html?from=private');}catch{showToast('Return failed. Your world remains saved; try again.');returnTown.disabled=false;}}
function resize(){if(!renderer)return;const width=worldEl.clientWidth,height=worldEl.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
function animate(time=0){if(!running)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);updatePlayer(dt,time);updateAnimals(dt,time);updateEnvironment(dt,time);updateNearest();if(time-lastSave>5000){savePosition();lastSave=time;}if(time-lastLivingRefresh>12000)refreshLivingWorld();renderer.render(scene,camera);}
async function load(){
  retry.hidden=true;activeClientId=localStorage.getItem(CLIENT_KEY)||'';
  if(!activeClientId){loadingTitle.textContent='No registered traveler';loadingMessage.textContent='Enter the public town first so the server can identify your world owner.';return;}
  setSyncState(navigator.onLine?'connecting':'offline');
  try{
    const response=await fetch(`${API}?clientId=${encodeURIComponent(activeClientId)}`,{cache:'no-store'}),data=await response.json();
    if(!response.ok||!data.ok){const error=Error(data.error||'load_failed');error.status=response.status;throw error;}
    try{
      const pending=await getQueuedPrivatePosition(activeClientId);if(pending)data.session.position=pending.position;
      await cachePrivateWorld(data,activeClientId);
    }catch{cacheAvailable=false;setSyncState('failed');}
    build(data);await flushQueuedPosition();
  }catch(error){
    const mayUseCache=!error.status||error.status>=500;
    if(mayUseCache){
      try{const cached=await getCachedPrivateWorld(activeClientId),pending=await getQueuedPrivatePosition(activeClientId);if(cached){if(pending)cached.session.position=pending.position;build(cached);setSyncState('offline');return;}}catch{cacheAvailable=false;}
    }
    setSyncState(navigator.onLine?'failed':'offline');loadingTitle.textContent='Your world could not open';loadingMessage.textContent=error.message==='living_worlds_migration_required'?'The Living Worlds database migration has not been applied.':mayUseCache?'No saved copy is available on this device yet. Reconnect once to create it.':'Your public progress is safe. Try loading the private world again.';retry.hidden=false;
  }
}

window.addEventListener('keydown',event=>{const key=event.key.toLowerCase();if(key==='escape'&&!craftedUsePanel.hidden){hideCraftedUse();event.preventDefault();return;}if(key==='escape'&&!craftingPanel.hidden){hideCrafting();event.preventDefault();return;}if(!craftingPanel.hidden||!craftedUsePanel.hidden)return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){keys.add(key);event.preventDefault();}if(key==='e'||key===' '){interact();event.preventDefault();}});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('resize',resize);
window.addEventListener('online',()=>{setSyncState('connecting');flushQueuedPosition();});window.addEventListener('offline',()=>setSyncState('offline'));
for(const gesture of['gesturestart','gesturechange','gestureend'])document.addEventListener(gesture,event=>event.preventDefault(),{passive:false});
window.addEventListener('pagehide',()=>{if(running){const position=currentPosition();queuePrivatePosition(activeClientId,position).catch(()=>{});navigator.sendBeacon?.(API,new Blob([JSON.stringify({clientId:activeClientId,action:'save_position',position})],{type:'application/json'}));}});
worldEl.addEventListener('pointerdown',event=>{if(event.target===renderer?.domElement)craftTapStart={x:event.clientX,y:event.clientY};});worldEl.addEventListener('pointerup',openPlacedCraftFromTap);worldEl.addEventListener('pointercancel',()=>{craftTapStart=null;});
actionButton.addEventListener('click',interact);returnTown.addEventListener('click',leave);retry.addEventListener('click',load);
craftButton.addEventListener('click',openCrafting);closeCrafting.addEventListener('click',hideCrafting);craftingPanel.addEventListener('click',event=>{if(event.target===craftingPanel)hideCrafting();});
closeCraftedUse.addEventListener('click',hideCraftedUse);craftedUsePanel.addEventListener('click',event=>{if(event.target===craftedUsePanel)hideCraftedUse();});

const joystick=$('joystick'),joystickKnob=$('joystickKnob');
function updateJoystick(event){const bounds=joystick.getBoundingClientRect(),centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2,max=bounds.width*.32;let dx=event.clientX-centerX,dy=event.clientY-centerY,distance=Math.hypot(dx,dy);if(distance>max){dx=dx/distance*max;dy=dy/distance*max;}joystickX=dx/max;joystickY=dy/max;if(Math.hypot(joystickX,joystickY)<.12)joystickX=joystickY=0;joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
function resetJoystick(){joystickPointer=null;joystickX=joystickY=0;joystick.classList.remove('active');joystickKnob.style.transform='translate(-50%,-50%)';}
joystick.addEventListener('pointerdown',event=>{event.preventDefault();joystickPointer=event.pointerId;joystick.setPointerCapture?.(event.pointerId);joystick.classList.add('active');updateJoystick(event);});joystick.addEventListener('pointermove',event=>{if(event.pointerId===joystickPointer)updateJoystick(event);});joystick.addEventListener('pointerup',event=>{if(event.pointerId===joystickPointer)resetJoystick();});joystick.addEventListener('pointercancel',resetJoystick);

if('serviceWorker'in navigator)navigator.serviceWorker.register('./private-world-sw.js').catch(()=>{cacheAvailable=false;setSyncState('failed');});
load();
