import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import {cachePrivateWorld,clearQueuedPrivatePosition,getCachedPrivateWorld,getQueuedPrivatePosition,queuePrivatePosition} from './private-world-cache.mjs?v=living-worlds-5';
import {createPineArt,createHerbArt} from './vegetation-art.js';
import {classifyPrecipitation} from './lib/weather-visuals.mjs';
import {PRIVATE_INTERIOR_SPAWN_KEY,interiorEntryUrl,rememberOutdoorPosition} from './lib/interior-core.mjs';

const API='/.netlify/functions/private-world';
const CRAFTING_API='/.netlify/functions/crafting';
const MERCHANT_API='/.netlify/functions/merchant';
const SURVIVAL_API='/.netlify/functions/survival';
const CLIENT_KEY='gptworld-client-id';
const SHARED_CLOCK_KEY='gptworld-shared-clock';
function formatSharedClock(minutes){const m=((Math.floor(minutes)%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function syncClockFromPublic(){
  try{
    const sample=JSON.parse(localStorage.getItem(SHARED_CLOCK_KEY)||'null');
    if(!sample||!Number.isFinite(Number(sample.minutes)))return;
    const rate=Number.isFinite(Number(sample.rate))&&Number(sample.rate)>0?Number(sample.rate):1;
    const minutes=Number(sample.minutes)+Math.max(0,Date.now()-Number(sample.at||Date.now()))/1000*rate;
    if(statusEls.clock)statusEls.clock.textContent=formatSharedClock(minutes);
  }catch{}
}
setInterval(syncClockFromPublic,250);

const $=id=>document.getElementById(id);
const worldEl=$('world'),loading=$('loading'),loadingTitle=$('loadingTitle'),loadingMessage=$('loadingMessage');
const retry=$('retry'),returnTown=$('returnTown'),promptEl=$('prompt'),toastEl=$('toast'),actionButton=$('actionButton');
const statusEls={clock:$('privateClock'),season:$('season'),weather:$('weather'),temperature:$('temperature')};
const inventoryEls={wood:$('woodCount'),stone:$('stoneCount'),herbs:$('herbCount'),coins:$('coinCount')};
const syncStateEl=$('syncState');
const craftingPanel=$('craftingPanel'),craftingResult=$('craftingResult'),craftingSkills=$('craftingSkills'),craftingRecipes=$('craftingRecipes'),craftedItems=$('craftedItems'),craftButton=$('craftButton'),closeCrafting=$('closeCrafting');
const constructionPanel=$('constructionPanel'),houseBlueprint=$('houseBlueprint');
const craftedUsePanel=$('craftedUsePanel'),craftedUseTitle=$('craftedUseTitle'),craftedUseIcon=$('craftedUseIcon'),craftedUseStatus=$('craftedUseStatus'),craftedUseControls=$('craftedUseControls'),closeCraftedUse=$('closeCraftedUse');
const survivalPanel=$('survivalPanel'),skillsButton=$('skillsButton'),huntButton=$('huntButton'),closeSurvival=$('closeSurvival'),survivalResult=$('survivalResult'),survivalSkills=$('survivalSkills'),survivalActions=$('survivalActions'),cropCatalog=$('cropCatalog'),huntCatalog=$('huntCatalog');

let renderer,scene,camera,player,clock,sun,skyLight,ground,water,precipitation;
let terrain,currentEcology,worldSeed=1,running=false,joystickX=0,joystickY=0,joystickPointer=null;
let toastTimer,nearest=null,lastSave=0,lastLivingRefresh=0,saveBusy=false,livingRefreshBusy=false,gatherBusy=false,craftBusy=false,itemBusy=false,houseBusy=false,survivalBusy=false,activeClientId='',cacheAvailable=true,loadedPayload=null,craftingData=null,survivalData=null,survivalTarget=null;
let previousSkills=[];
let survivalMode='farm',huntMarker=null;
const keys=new Set(),velocity=new THREE.Vector3(),desired=new THREE.Vector3(),cameraTarget=new THREE.Vector3();
const interactables=[],animals=[],plants=[],clouds=[],blockers=[];
const resourceStates=new Map(),resourceVisuals=new Map();
const placedCrafts=new Map();
const livingEntityObjects=new Map();
const farmPlotObjects=new Map();
const homesteadBuildings=new Map();
const homesteadDoors=[];
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
  const ratio=clamp(Number(state.remaining||0)/Math.max(1,Number(state.maxAmount||1)),0,1),kind=visual.userData.resourceKind,stage=String(state.plant?.stage||'mature');
  const stageScale={seed:.12,sprout:.28,young:.57,mature:1,old:1.12,dead:.25}[stage]||1,scale=kind==='rock'?(ratio>0?.58+ratio*.42:.28):stageScale,base=visual.userData.resourceBaseScale;visual.scale.copy(base).multiplyScalar(scale);
  visual.traverse(child=>{if(!child.isMesh)return;child.material.transparent=ratio<=0;child.material.opacity=ratio<=0?.34:1;});
}

function registerResource(object,visual,label){
  const state=resourceStates.get(object.id);visual.userData.resourceKind=object.kind;visual.userData.resourceBaseScale=visual.scale.clone();resourceVisuals.set(object.id,visual);applyResourceVisual(object.id);
  interactables.push({label,nodeId:object.id,resource:state?.resource||({tree:'wood',rock:'stone',herbs:'herbs'}[object.kind]),object:visual,radius:object.kind==='tree'?2.2:1.9});
}

function addTree(object){
  const growth=growthFor(object),scale=(object.scale||1)*(.62+growth*.42);
  const art=createPineArt(THREE,scale),group=art.group;
  group.position.set(object.x,0,object.z);
  group.userData={growth,phase:hash01(object.id)*Math.PI*2,trunk:art.trunk,crown:art.crown};scene.add(group);plants.push(group);
  const stage=growth>.78?'mature':growth>.5?'growing':'young';
  registerResource(object,group,`${stage} tree`);
}

function addRock(object){
  const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.85*(object.scale||1),1),material(0x74786f));
  mesh.position.set(object.x,.55,object.z);mesh.scale.y=.7;mesh.rotation.y=hash01(object.id)*Math.PI;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  registerResource(object,mesh,'stone deposit');
}

function addHerbs(object){
  const growth=growthFor(object),group=createHerbArt(THREE,Math.max(.7,growth),String(object.id||'').length%2);
  group.position.set(object.x,0,object.z);group.userData={growth,phase:hash01(object.id)*Math.PI*2};scene.add(group);plants.push(group);
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
  interactables.push({type:'animal',label:species.replaceAll('-',' '),livingEntityId:object.entityId||null,message:()=>{const b=group.userData.behavior;return `This ${species.replaceAll('-',' ')} is ${b}. Track it or hunt with a bow.`;},object:group,radius:3.8});
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
  if(part==='crown'||part==='plant-patch'||String(entity.id).endsWith('-center')){const label=String(entity.speciesName||entity.species||'wild plant').replaceAll('-',' '),stage=String(entity.plantStage||entity.stage||'mature').replaceAll('-',' '),health=Math.round(Number(entity.plantHealth??100)*(Number(entity.plantHealth??100)<=1?100:1)),available=Number(entity.harvestAvailable);interactables.push({type:'plant',label,livingEntityId:String(entity.id),object:group,radius:2.5,message:`${label} · ${stage} · health ${health}%${Number.isFinite(available)?` · ${Math.max(0,Math.floor(available))} naturally available`:''}. Wildlife can feed here; gatherable plants are marked separately.`});}
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

function removeFarmPlots(){for(const object of farmPlotObjects.values()){scene.remove(object);object.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});}farmPlotObjects.clear();for(let i=interactables.length-1;i>=0;i--)if(interactables[i].type==='farm')interactables.splice(i,1);}
function addFarmPlot(plot){
  const group=new THREE.Group(),soil=new THREE.Mesh(new THREE.BoxGeometry(1.8,.12,1.8),material(0x5b4129));soil.position.y=.07;group.add(soil);group.position.set(plot.x,0,plot.z);
  const stage=String(plot.stage||'prepared'),height={seed:.08,sprout:.25,young:.55,mature:.85,ready:1.05,dead:.2}[stage]||0;
  if(plot.cropKey&&height>0)for(const x of[-.5,0,.5])for(const z of[-.5,0,.5]){const stem=new THREE.Mesh(new THREE.ConeGeometry(.09,height,6),material(stage==='dead'?0x73583d:plot.cropKey==='carrot'?0x4f8c42:plot.cropKey==='pumpkin'?0xd87827:0xb5a64d));stem.position.set(x,height/2+.12,z);group.add(stem);}
  scene.add(group);farmPlotObjects.set(String(plot.id),group);interactables.push({type:'farm',label:plot.cropKey?`${plot.cropKey.replaceAll('-',' ')} plot`:'prepared plot',plotId:String(plot.id),object:group,radius:3});
}
function syncFarmPlots(plots=[]){removeFarmPlots();for(const plot of plots)addFarmPlot(plot);}
function animalDistance(animal){return Math.hypot(Number(player?.position?.x||0)-Number(animal?.x||0),Number(player?.position?.z||0)-Number(animal?.z||0));}
function bestBow(){const gear=new Set(survivalData?.equipment||[]);return gear.has('reinforced-bow')?'reinforced-bow':gear.has('basic-bow')?'basic-bow':null;}
function clearHuntMarker(){if(huntMarker?.parent)huntMarker.parent.remove(huntMarker);huntMarker?.geometry?.dispose?.();huntMarker?.material?.dispose?.();huntMarker=null;}
function markHuntTarget(target){
  clearHuntMarker();if(!target?.object)return;
  huntMarker=new THREE.Mesh(new THREE.TorusGeometry(.72,.08,8,24),new THREE.MeshBasicMaterial({color:0xf0cf7b,transparent:true,opacity:.95,depthWrite:false}));
  huntMarker.rotation.x=Math.PI/2;huntMarker.position.y=2.45;target.object.add(huntMarker);
}
function nearestHuntTarget(){
  if(!survivalData?.animals?.length)return null;
  let best=null,bestDistance=Infinity;
  for(const animal of survivalData.animals){
    const target=interactables.find(item=>item.type==='animal'&&String(item.livingEntityId)===String(animal.id));
    if(!target)continue;const distance=animalDistance(animal);if(distance<bestDistance){best={animal,target,distance};bestDistance=distance;}
  }
  return best;
}
function chooseNearestAnimal(){
  const match=nearestHuntTarget();if(!match){survivalTarget=null;clearHuntMarker();return null;}
  survivalTarget=match.target;markHuntTarget(match.target);return match;
}
function survivalMessage(message,success=false){survivalResult.hidden=false;survivalResult.dataset.outcome=success?'success':'failure';survivalResult.replaceChildren(Object.assign(document.createElement('strong'),{textContent:success?'Action complete':'Action unavailable'}),Object.assign(document.createElement('span'),{textContent:message}));}
function survivalButton(label,handler,disabled=false){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled||survivalBusy;button.addEventListener('click',handler);return button;}
function renderSurvival(){
  if(!survivalData)return;const skillMap=Object.fromEntries(survivalData.skills.map(skill=>[skill.key,skill]));
  survivalSkills.replaceChildren(...['farming','hunting'].map(key=>{const skill=skillMap[key]||{value:0,attempts:0},card=document.createElement('div');card.className='crafting-skill';card.innerHTML=`<strong>${skillLabel(key)}</strong><span>${Number(skill.value).toFixed(2)} skill · ${skill.attempts} actions</span>`;return card;}));
  cropCatalog.replaceChildren(...survivalData.crops.map(crop=>{const row=document.createElement('div');row.className=`crop-entry${crop.unlocked?'':' locked'}`;row.innerHTML=`<div><strong>${crop.name}</strong><small>${crop.growHours}h growth · skill ${crop.unlock}</small></div><span>${crop.unlocked?'Unlocked':'Locked'}</span>`;return row;}));
  huntCatalog.replaceChildren(...survivalData.huntUnlocks.map(unlock=>{const row=document.createElement('div');row.className=`crop-entry${unlock.unlocked?'':' locked'}`;row.innerHTML=`<div><strong>${unlock.name}</strong><small>Hunting ${unlock.level}</small></div><span>${unlock.unlocked?'Unlocked':'Locked'}</span>`;return row;}));
  const actions=[];
  if(survivalMode==='hunt'){
    let animal=survivalTarget?.type==='animal'?survivalData.animals.find(item=>String(item.id)===String(survivalTarget.livingEntityId)):null;
    if(!animal){const nearest=chooseNearestAnimal();animal=nearest?.animal||null;}
    if(animal){
      const distance=animalDistance(animal),inRange=distance<=5,bow=bestBow(),label=String(animal.species||'wildlife').replaceAll('-',' ');
      const card=document.createElement('div');card.className='hunt-target-card';
      card.innerHTML=`<strong>🎯 ${label}</strong><span>${distance.toFixed(1)} m away · ${animal.behavior||'roaming'}</span><small>${inRange?'In range — take your shot.':'Move within 5 m to hunt.'}</small>`;actions.push(card);
      const hunt=survivalButton(bow?`🏹 Hunt with ${bow==='reinforced-bow'?'Reinforced Bow':'Basic Bow'}`:'🏹 Craft a bow to hunt',()=>survivalAction('hunt',{animalId:animal.id,equipment:bow}),!bow||!inRange);
      hunt.classList.add('hunt-primary');actions.push(hunt);
      actions.push(survivalButton('👣 Read tracks',()=>survivalAction('track',{animalId:animal.id})));
      const next=survivalButton('Find nearest animal',()=>{chooseNearestAnimal();renderSurvival();});next.classList.add('hunt-secondary');actions.push(next);
      const trap=(survivalData.equipment||[]).includes('hunting-trap');if(trap)actions.push(survivalButton('🪤 Use hunting trap',()=>survivalAction('hunt',{animalId:animal.id,equipment:'hunting-trap'}),!inRange));
    }else{
      const empty=document.createElement('div');empty.className='hunt-target-card';empty.innerHTML='<strong>👣 No huntable animal nearby</strong><span>Move through the world and check again. Wildlife changes with the living ecosystem.</span>';actions.push(empty);
      actions.push(survivalButton('Refresh wildlife',async()=>{await loadSurvival();chooseNearestAnimal();renderSurvival();}));
    }
  }else if(survivalTarget?.type==='farm'){
    const plot=survivalData.plots.find(item=>String(item.id)===String(survivalTarget.plotId));
    if(plot){actions.push(Object.assign(document.createElement('div'),{className:'farm-plot-label',textContent:`${plot.cropKey||'Prepared soil'} · ${plot.stage} · moisture ${Math.round(plot.moisture)}% · health ${Math.round(plot.health)}%`}));if(!plot.cropKey)for(const crop of survivalData.crops.filter(item=>item.unlocked))actions.push(survivalButton(`Plant ${crop.name}`,()=>survivalAction('plant',{plotId:plot.id,cropKey:crop.key})));else{actions.push(survivalButton('Water crop',()=>survivalAction('water',{plotId:plot.id})));actions.push(survivalButton('Harvest crop',()=>survivalAction('harvest_crop',{plotId:plot.id}),plot.stage!=='ready'));}}
  }else{
    actions.push(survivalButton('Prepare plot at my feet',()=>survivalAction('prepare_plot',{position:currentPosition()})));
    const canCook=Number(survivalData.bag?.['raw-meat']||0)>0&&Number(survivalData.bag?.carrot||0)>0;actions.push(survivalButton(canCook?'Cook camp stew · 1 meat + 1 carrot':'Camp stew needs meat + carrot',()=>survivalAction('cook_stew'),!canCook));
  }
  survivalActions.replaceChildren(...actions);
  const farmingSections=survivalMode==='hunt'?['none','none']:['',''];cropCatalog.previousElementSibling.style.display=farmingSections[0];cropCatalog.style.display=farmingSections[1];
  huntCatalog.previousElementSibling.style.display=survivalMode==='hunt'?'':'none';huntCatalog.style.display=survivalMode==='hunt'?'':'none';
}
async function loadSurvival(){const response=await fetch(`${SURVIVAL_API}?clientId=${encodeURIComponent(activeClientId)}`,{cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'survival_load_failed');survivalData=data;syncFarmPlots(data.plots);renderSurvival();return data;}
async function openSurvival(target=null,mode='farm'){survivalMode=mode;survivalTarget=target;survivalPanel.hidden=false;velocity.set(0,0,0);keys.clear();resetJoystick();survivalResult.hidden=true;$('survivalTitle').textContent=mode==='hunt'?'Hunting':'Farming';try{await savePosition();await loadSurvival();if(mode==='hunt'&&!survivalTarget)chooseNearestAnimal();renderSurvival();}catch(error){survivalMessage(error.message==='survival_migration_required'?'The farming and hunting database update is not installed yet.':'Could not sync the living-land ledger.');}}
function hideSurvival(){survivalPanel.hidden=true;survivalTarget=null;clearHuntMarker();}
async function survivalAction(action,extra={}){if(survivalBusy)return;survivalBusy=true;renderSurvival();try{await savePosition();const response=await fetch(SURVIVAL_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action,...extra,idempotencyKey:requestKey(action)})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'action_failed');survivalMessage(action==='cook_stew'?`Cooked ${data.reward.quantity} Trail Rations and gained Cooking XP.`:action==='track'?`${data.animal.species} tracks are ${data.animal.distance}m away; it is ${data.animal.behavior}.`:action==='hunt'?(data.success?`Clean hit — ${data.rewards.map(item=>`${item.quantity} ${item.name}`).join(', ')}. Hunting skill ${Number(data.skillValue||0).toFixed(1)}.`:`Missed shot — the animal escaped. Hunting skill ${Number(data.skillValue||0).toFixed(1)}; wait briefly before trying again.`):action==='harvest_crop'?`Harvested ${data.reward.quantity} ${data.reward.name}. Farming XP gained.`:`${action.replaceAll('_',' ')} complete.`,true);if(action==='hunt'&&data.success){const object=livingEntityObjects.get(String(data.animalId));if(object)removeLivingEntity(String(data.animalId));}await loadSurvival();if(survivalMode==='hunt'&&!survivalData.animals.some(item=>String(item.id)===String(survivalTarget?.livingEntityId)))chooseNearestAnimal();if(craftingData)await loadCrafting();}catch(error){const messages={plant_failed:'You need a Seed Pouch, an empty nearby plot, and a private-world session.',crop_not_ready:'This crop is still growing.',animal_out_of_range:'Move closer to the animal.',equipment_required:'Craft and carry an appropriate bow first.',animal_already_harvested:'This animal has already been harvested; ecology recovery takes time.',hunt_cooldown:'The animal is alert. Wait a moment before tracking it again.',cooking_ingredients_required:'Camp stew needs one Raw Meat and one Carrot.',plot_too_close:'Choose a clearer spot away from another plot.',invalid_plot_site:'Prepare soil on dry, clear land.'};survivalMessage(messages[error.message]||'That action could not be completed safely.');}finally{survivalBusy=false;renderSurvival();}}

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
  if(item?.metadata?.interior===true)return;
  if(placedCrafts.has(String(item.id)))return;
  const texture=new THREE.TextureLoader().load(craftingIcon(item.key));texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.08,depthWrite:false}));
  sprite.center.set(.5,0);sprite.scale.set(2.8,2.8,1);sprite.position.set(item.x,.04,item.z);sprite.userData.item=item;
  if(item.key==='campfire-kit'){const fireGroup=makeCampfireFlame(item);sprite.userData.fireGroup=fireGroup;sprite.userData.fireLight=fireGroup.userData.light;}
  scene.add(sprite);placedCrafts.set(String(item.id),sprite);refreshPlacedCraft(item);refreshCrateStorageLabel(sprite,item);
  interactables.push({label:item.name,placedItemId:String(item.id),object:sprite,radius:2.6});
}

function addHomesteadBuilding(building){
  if(!building?.id||homesteadBuildings.has(String(building.id)))return;
  const width=Number(building.width||7),depth=Number(building.depth||6),x=Number(building.x||0),z=Number(building.z||0);
  const group=new THREE.Group();group.position.set(x,0,z);
  box(group,0x8f7354,[width,3.1,depth],[0,1.55,0]);
  box(group,0x5a3d2c,[width+.35,.28,depth+.35],[0,3.2,0]);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(width,depth)*.78,2.05,4),material(0x6b4a33));
  roof.position.y=4.15;roof.rotation.y=Math.PI/4;roof.castShadow=true;roof.receiveShadow=true;group.add(roof);
  box(group,0x3f2c22,[.18,1.35,width*.72],[-width/2+.12,2.55,0]);
  box(group,0x3f2c22,[.18,1.35,width*.72],[width/2-.12,2.55,0]);
  const door=box(group,0x4b3422,[1.2,2.1,.2],[0,1.05,depth/2+.12]);
  door.castShadow=false;door.userData.buildingId=building.key||'homestead';door.userData.buildingKey=building.key||'homestead';door.userData.buildingRecordId=String(building.id);door.userData.buildingLabel='your homestead';
  homesteadDoors.push(door);scene.add(group);
  blockers.push({x,z,halfX:width/2*.9,halfZ:depth/2*.9});
  const interactable={type:'building',label:'your homestead',building,object:group,radius:3.5};
  interactables.push(interactable);
  homesteadBuildings.set(String(building.id),{building,group,door,interactable});
  return group;
}

function enterHomestead(building){
  if(!building?.id||!running)return;
  const position=rememberOutdoorPosition(currentPosition(),building.key||'homestead');
  try{sessionStorage.setItem(PRIVATE_INTERIOR_SPAWN_KEY,JSON.stringify(position));}catch{}
  const url=interiorEntryUrl('homestead','./interior.html',{from:'private',buildingId:String(building.id)});
  if(!url){showToast('Your homestead interior could not open.');return;}
  running=false;window.location.assign(url);
}

function restorePrivateInteriorSpawn(data){
  const params=new URLSearchParams(location.search);
  if(params.get('from')!=='private-interior')return data;
  try{
    const saved=JSON.parse(sessionStorage.getItem(PRIVATE_INTERIOR_SPAWN_KEY)||'null');
    if(saved&&Number.isFinite(Number(saved.x))&&Number.isFinite(Number(saved.z))){
      data.session={...data.session,position:{x:Number(saved.x),z:Number(saved.z)}};
    }
  }catch{}
  return data;
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
  data=restorePrivateInteriorSpawn(data);
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
  for(const item of data.world.placedItems||[]){if(item?.metadata?.interior===true)continue;addPlacedCraft(item);}
  homesteadBuildings.clear();homesteadDoors.length=0;
  for(const building of data.world.buildings||[])addHomesteadBuilding(building);
  camera.position.set(player.position.x+12,14,player.position.z+12);clock=new THREE.Clock();
  $('worldName').textContent=data.world.name;for(const [key,element] of Object.entries(inventoryEls))element.textContent=data.fromCache?'—':Number(data.inventory?.[key]||0);
  applyLivingVisuals();updateStatus();loading.hidden=true;running=true;resize();animate();
  loadSurvival().catch(()=>{});
  if(data.fromCache)showToast('Offline world loaded. Inventory is hidden until the server reconnects.');
  if(data.catchUp.steps)showToast(`Your world lived through ${data.catchUp.steps} ecology step${data.catchUp.steps===1?'':'s'} while you were away.`);
}

function statusForWeather(){const weather=String(currentEcology.weather||'clear');return weather==='clear'?'clear':weather.replace('heavy rain','raining heavily').replace('rain','raining');}
function applyLivingVisuals(){
  const weatherClass=classifyPrecipitation(currentEcology.weather||'clear'),snow=weatherClass.snow,wet=weatherClass.wet;
  const sky=snow?0xaebbc1:wet?0x71858d:currentEcology.season==='Winter'?0x9eb5bb:0x8fb5be;
  scene.background=color(sky);scene.fog=new THREE.Fog(sky,weatherClass.foggy?28:40,weatherClass.foggy?76:104);
  ground.material.color.copy(color(plantPalette().ground)).lerp(color(0xdde5df),Number(currentEcology.snowCover||0)*.78);
  water.material.color.set(wet?0x385f71:0x4c8190);
  precipitation.visible=wet||snow;precipitation.material.color.set(snow?0xf4f7f6:0xaecfe0);precipitation.material.size=snow?.13:.07;
  for(const cloud of clouds)cloud.visible=!weatherClass.clear;
}

function updateStatus(){
  const hour=((Number(currentEcology.worldHour)||0)+new Date().getMinutes()/60)%24;
  const hours=Math.floor(hour),minutes=Math.floor((hour-hours)*60);
  statusEls.clock.textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  statusEls.season.textContent=currentEcology.season||'Spring';statusEls.weather.textContent=String(currentEcology.weather||'clear').replace(/^./,letter=>letter.toUpperCase());statusEls.temperature.textContent=`${Math.round(Number(currentEcology.temperatureC)||0)}°C`;
}

function showToast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3400);}
function resourceText(inputs){return Object.entries(inputs).filter(([,amount])=>amount>0).map(([resource,amount])=>`${amount} ${resource}`).join(' · ');}
const CRAFTING_ART=new Set(['campfire-kit','healing-poultice','stone-hammer','stone-hearth','weather-tonic','wooden-crate']);
const ITEM_SYMBOLS={'seed-pouch':'🌱','basic-bow':'🏹','reinforced-bow':'🏹','hunting-trap':'🪤',wheat:'🌾',carrot:'🥕',potato:'🥔',pumpkin:'🎃','farm-herbs':'🌿','raw-meat':'🥩',hide:'🟫','trail-rations':'🥣','wooden-beam':'🪵','wooden-door':'🚪','stone-foundation':'🧱','iron-fittings':'⚙️','reed-mat':'🧺'};
function craftingIcon(key){if(CRAFTING_ART.has(key))return `./assets/crafting/${encodeURIComponent(key)}.webp`;const symbol=ITEM_SYMBOLS[key]||'🛠️',svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><radialGradient id="g"><stop stop-color="#49634b"/><stop offset="1" stop-color="#1a2d20"/></radialGradient></defs><rect width="160" height="160" rx="24" fill="url(#g)"/><text x="80" y="103" text-anchor="middle" font-size="72">${symbol}</text></svg>`;return`data:image/svg+xml,${encodeURIComponent(svg)}`;}
function campfireBurning(item){return item?.key==='campfire-kit'&&Date.parse(item.metadata?.campfire?.litUntil||0)>Date.now()&&!classifyPrecipitation(currentEcology?.weather).wet;}
function refreshPlacedCraft(item){const sprite=placedCrafts.get(String(item.id));if(!sprite)return;sprite.userData.item=item;if(sprite.userData.fireLight){const burning=campfireBurning(item);sprite.userData.fireGroup.visible=burning;sprite.userData.fireLight.intensity=burning?4.2:0;sprite.material.color.set(burning?0xffd59a:0xffffff);}refreshCrateStorageLabel(sprite,item);}
function updatePlacedItemState(itemId,changes){
  const sprite=placedCrafts.get(String(itemId));if(!sprite)return null;const item=Object.assign(sprite.userData.item,changes);refreshPlacedCraft(item);
  if(loadedPayload?.world){const saved=(loadedPayload.world.placedItems||[]).find(entry=>String(entry.id)===String(itemId));if(saved)Object.assign(saved,changes);cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}return item;
}
function canAfford(recipe){
  if(recipe.locked||recipe.unlocked===false)return false;
  return Object.entries(recipe.inputs||{}).every(([resource,amount])=>Number(craftingData?.inventory?.[resource]||0)>=amount);
}
function skillLabel(key){return String(key||'').replace(/^./,letter=>letter.toUpperCase());}
function recipeForItem(item){return (craftingData?.recipes||[]).find(recipe=>recipe.key===item.key)||null;}
function isComponentItem(item){
  const recipe=recipeForItem(item);
  return Boolean(item?.metadata?.component||recipe?.component||recipe?.category==='components');
}
function isPlaceableItem(item){
  if(item?.placed||isComponentItem(item))return false;
  const recipe=recipeForItem(item);
  if(recipe)return recipe.placeable!==false;
  return !['healing-poultice','weather-tonic','trail-rations','seed-pouch','basic-bow','reinforced-bow','hunting-trap','wheat','carrot','potato','pumpkin','farm-herbs','raw-meat','hide','wooden-beam','wooden-door','stone-foundation','iron-fittings'].includes(item.key);
}
function showUnlockToasts(unlocks=[]){
  for(const unlock of unlocks){
    const message=unlock.message||`${skillLabel(unlock.skill)} unlock: ${unlock.name}`;
    showToast(message);
    const title=document.createElement('strong'),detail=document.createElement('span');
    title.textContent='Recipe unlocked';detail.textContent=message;
    craftingResult.dataset.outcome='success';craftingResult.classList.add('unlock-toast');
    craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;
  }
}
function showCraftingResult(data,recipe){
  const title=document.createElement('strong'),detail=document.createElement('span'),before=Number(data.skill.before),after=Number(data.skill.value),gain=Math.max(0,after-before);
  craftingResult.classList.remove('unlock-toast');
  craftingResult.dataset.outcome=data.success?'success':'failure';
  title.textContent=data.success?`Success — ${data.quality} ${recipe.name}`:`Attempt failed — ${recipe.name}`;
  detail.textContent=`${skillLabel(data.skill.key)} ${before.toFixed(2)} → ${after.toFixed(2)} (+${gain.toFixed(2)}). ${data.success?'Item added to your possessions.':'Some materials were lost.'}`;
  craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;craftingResult.scrollIntoView({behavior:'smooth',block:'nearest'});
  if(data.unlocks?.length)showUnlockToasts(data.unlocks);
}
function showCraftingError(message){
  const title=document.createElement('strong'),detail=document.createElement('span');title.textContent='Crafting could not complete';detail.textContent=message;
  craftingResult.classList.remove('unlock-toast');
  craftingResult.dataset.outcome='failure';craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;craftingResult.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderConstruction(){
  if(!houseBlueprint)return;
  const house=craftingData?.house;
  if(!house){houseBlueprint.replaceChildren(Object.assign(document.createElement('div'),{className:'house-empty',textContent:'Homestead blueprints unlock with Construction skill.'}));return;}
  const card=document.createElement('article');card.className=`house-blueprint-card${house.locked?' locked':''}`;
  const heading=document.createElement('div');heading.className='house-heading';
  const title=document.createElement('strong');title.textContent=house.name||'Basic Homestead';
  const skill=document.createElement('span');skill.textContent=house.locked?`Locked · need Construction ${house.requiredSkill}`:`Construction ${Number(house.currentSkill||0).toFixed(1)} / ${house.requiredSkill}`;
  heading.append(title,skill);
  const description=document.createElement('p');description.textContent=house.description||'A private walkable cabin.';
  const materials=document.createElement('ul');materials.className='house-checklist';
  for(const [resource,amount] of Object.entries(house.materials||{})){
    const have=Number(house.inventory?.[resource]??craftingData?.inventory?.[resource]??0);
    const row=document.createElement('li');row.className=have>=amount?'ready':'missing';
    row.innerHTML=`<span>${amount} ${resource}</span><span>${have}/${amount}</span>`;
    materials.append(row);
  }
  const components=document.createElement('ul');components.className='house-checklist';
  for(const need of house.components||[]){
    const owned=Number(need.owned||0),amount=Number(need.amount||1);
    const name=need.recipe?.name||need.key;
    const row=document.createElement('li');row.className=owned>=amount?'ready':'missing';
    row.innerHTML=`<span>${name}</span><span>${owned}/${amount}</span>`;
    components.append(row);
  }
  const meta=document.createElement('div');meta.className='house-meta';
  const chance=document.createElement('span');chance.textContent=`${Math.round(Number(house.chance||0)*100)}% estimated success`;
  const result=document.createElement('span');result.textContent='Result: walkable homestead cabin';
  meta.append(chance,result);
  const button=document.createElement('button');button.type='button';
  button.textContent=house.locked?`Requires Construction ${house.requiredSkill}`:house.canAttempt?'Build homestead':'Need materials or components';
  button.disabled=houseBusy||craftBusy||!house.canAttempt;
  button.addEventListener('click',()=>buildHouse());
  card.append(heading,description,materials,components,meta,button);
  houseBlueprint.replaceChildren(card);
}
function renderCrafting(){
  if(!craftingData)return;
  craftingSkills.replaceChildren(...craftingData.skills.map(skill=>{const card=document.createElement('div');card.className='crafting-skill';const name=document.createElement('strong'),progress=document.createElement('span');name.textContent=skillLabel(skill.key);progress.textContent=`${Number(skill.value).toFixed(2)} skill · ${skill.attempts} attempts`;card.append(name,progress);return card;}));
  craftingRecipes.replaceChildren(...craftingData.recipes.map(recipe=>{
    const locked=Boolean(recipe.locked||recipe.unlocked===false);
    const card=document.createElement('article');card.className=`recipe-card${locked?' locked':''}`;
    const image=document.createElement('img'),content=document.createElement('div'),profession=document.createElement('div'),title=document.createElement('h3'),description=document.createElement('p'),meta=document.createElement('div'),cost=document.createElement('span'),chance=document.createElement('span'),button=document.createElement('button');
    image.className='recipe-icon';image.src=craftingIcon(recipe.key);image.alt='';image.loading='lazy';
    profession.className='recipe-profession';profession.textContent=`${skillLabel(recipe.skill)}${recipe.requiredSkill?` · skill ${recipe.requiredSkill}+`:''}`;
    title.textContent=recipe.name;
    description.textContent=locked?`Locked · need ${skillLabel(recipe.skill)} ${recipe.requiredSkill||0}`:recipe.description;
    meta.className='recipe-meta';
    cost.textContent=locked?`Requires ${skillLabel(recipe.skill)} ${recipe.requiredSkill||0}`:resourceText(recipe.inputs);
    chance.textContent=locked?'Locked':`${Math.round(Number(recipe.chance||0)*100)}% success`;
    button.type='button';
    if(locked){button.textContent=`Requires ${skillLabel(recipe.skill)} ${recipe.requiredSkill||0}`;button.disabled=true;}
    else{button.textContent=canAfford(recipe)?'Craft item':'Need materials';button.disabled=craftBusy||!canAfford(recipe);button.addEventListener('click',()=>craftRecipe(recipe));}
    meta.append(cost,chance);content.append(profession,title,description,meta,button);card.append(image,content);return card;
  }));
  renderConstruction();
  craftedItems.replaceChildren(...(craftingData.items.length?craftingData.items.map(item=>{
    const row=document.createElement('div');row.className='crafted-item';
    const image=document.createElement('img'),content=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small'),actions=document.createElement('div'),button=document.createElement('button');
    image.src=craftingIcon(item.key);image.alt='';image.loading='lazy';
    const qty=Math.max(1,Number(item.quantity||1));
    title.textContent=`${item.quality} ${item.name}`;
    if(qty>1){const badge=document.createElement('span');badge.className='crafted-qty';badge.textContent=`× ${qty}`;title.append(' ',badge);}
    const component=isComponentItem(item),placeable=isPlaceableItem(item);
    detail.textContent=item.placed?'Placed in your world · approach it to pick it up':component?`${item.profession} · construction component · held in bag`:`${item.profession} · ${item.durability}/${item.maxDurability} durability`;
    button.type='button';actions.className='crafted-item-actions';
    if(item.placed){button.textContent='Placed';button.disabled=true;}
    else if(component){button.textContent='Held';button.disabled=true;}
    else if(!placeable){button.textContent='Held';button.disabled=true;}
    else{
      const house=currentHomestead();
      if(house&&['wooden-crate','stone-hearth','reed-mat','campfire-kit'].includes(item.key)){
        button.textContent='Install in house';button.disabled=itemBusy;button.addEventListener('click',()=>installInteriorFurniture(item,house));
      }else{button.textContent='Place';button.disabled=itemBusy;button.addEventListener('click',()=>placeCraftedItem(item));}
    }
    actions.append(button);
    if(!item.placed&&qty>1){
      const split=document.createElement('button');split.type='button';split.className='split';split.textContent='Split';split.disabled=itemBusy;
      split.addEventListener('click',()=>splitCraftedStack(item));
      actions.append(split);
    }
    content.append(title,detail);row.append(image,content,actions);return row;
  }):[Object.assign(document.createElement('div'),{className:'crafted-empty',textContent:'Your bag is empty. Crafted items will appear here.'})]));
}
async function loadCrafting(){
  if(!navigator.onLine){showToast('Reconnect to open your authoritative crafting ledger.');return false;}
  try{
    const response=await fetch(`${CRAFTING_API}?clientId=${encodeURIComponent(activeClientId)}`,{cache:'no-store'}),data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'crafting_load_failed');
    previousSkills=(craftingData?.skills||data.skills||[]).map(skill=>({key:skill.key,value:Number(skill.value)}));
    craftingData=data;if(data.inventory){for(const [key,element] of Object.entries(inventoryEls)){if(!element)continue;if(key==='coins'&&data.inventory.coins==null)continue;element.textContent=String(Number(data.inventory?.[key]||0));}}renderCrafting();craftingResult.hidden=true;craftingResult.classList.remove('unlock-toast');return true;
  }catch(error){showCraftingError(error.message==='crafting_migration_required'?'The crafting database is still updating. Close the bag and try again shortly.':'The bag could not sync. Check your connection, then close and reopen it.');return false;}
}
async function openCrafting(){
  craftingPanel.hidden=false;velocity.set(0,0,0);keys.clear();resetJoystick();craftingResult.dataset.outcome='loading';craftingResult.hidden=false;craftingResult.innerHTML='<strong>Opening your bag…</strong><span>Syncing skills, recipes, and crafted possessions.</span>';
  await loadCrafting();
}
function hideCrafting(){craftingPanel.hidden=true;}
async function splitCraftedStack(item){
  if(itemBusy||!item?.id)return;
  const have=Math.max(1,Number(item.quantity||1));
  if(have<=1){showToast('That stack cannot be split further.');return;}
  const raw=window.prompt(`Split how many from ${have}? (1–${have-1})`,String(Math.min(1,have-1)));
  if(raw==null)return;
  const quantity=Math.floor(Number(raw));
  if(!Number.isFinite(quantity)||quantity<1||quantity>=have){showToast('Enter a split amount smaller than the stack.');return;}
  itemBusy=true;
  try{
    const response=await fetch(MERCHANT_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'split_stack',itemId:item.id,quantity,idempotencyKey:requestKey(`split-${item.id}`)})});
    const data=await response.json();
    if(data?.error==='economy_migration_required')throw Error('economy_migration_required');
    if(!response.ok||!data.ok)throw Error(data.error||'split_failed');
    await loadCrafting();
    showToast(`Split ${quantity} from ${item.name}.`);
  }catch(error){
    showToast(error.message==='economy_migration_required'?'The town economy is still updating. Try again shortly.':error.message==='item_not_stackable'?'That item cannot be stacked or split.':'Split failed. Try again.');
  }finally{itemBusy=false;renderCrafting();}
}

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
  if(craftBusy||!canAfford(recipe)||recipe.locked||recipe.unlocked===false)return;craftBusy=true;renderCrafting();
  try{
    const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,recipeKey:recipe.key,idempotencyKey:requestKey(`craft-${recipe.key}`)})}),data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'craft_failed');
    showCraftingResult(data,recipe);
    await loadCrafting();for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(craftingData.inventory?.[key]||0);
  }catch(error){showCraftingError(error.message==='insufficient_materials'?'You no longer have enough materials.':error.message==='recipe_locked'?`Requires ${skillLabel(recipe.skill)} ${recipe.requiredSkill||0}.`:error.message==='private_world_required'?'Craft inside your personal world.':'Please try again. No success was recorded.');}
  finally{craftBusy=false;renderCrafting();}
}
async function placeCraftedItem(item){
  if(itemBusy||item.placed||!isPlaceableItem(item))return;itemBusy=true;renderCrafting();await savePosition();
  const position={x:clamp(player.position.x+Math.sin(player.rotation.y)*2.6,-32,32),z:clamp(player.position.z+Math.cos(player.rotation.y)*2.6,-32,32),rotation:player.rotation.y};
  try{const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'place_item',itemId:item.id,position,idempotencyKey:requestKey(`place-${item.id}`)})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'place_failed');const placed={...data.item,...data.item.placed};addPlacedCraft(placed);if(loadedPayload?.world){loadedPayload.world.placedItems=[...(loadedPayload.world.placedItems||[]).filter(entry=>String(entry.id)!==String(item.id)),placed];cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}await loadCrafting();showCraftingError(`${item.name} was placed nearby. Close your bag to see it.`);craftingResult.dataset.outcome='success';craftingResult.firstElementChild.textContent=`Placed — ${item.name}`;}catch{showCraftingError('Move to a clear nearby spot and try placing the item again.');}finally{itemBusy=false;renderCrafting();}
}
function currentHomestead(){
  const fromPayload=(loadedPayload?.world?.buildings||[]).find(building=>building.key==='homestead'||building.type==='house');
  if(fromPayload)return fromPayload;
  for(const record of homesteadBuildings.values())return record.building;
  return (craftingData?.buildings||[]).find(building=>building.key==='homestead')||null;
}
async function installInteriorFurniture(item,house){
  if(itemBusy||item.placed||!house?.id)return;itemBusy=true;renderCrafting();
  const slots=[[-3.2,2.1],[3.1,-2.4],[-1.5,2.6],[2.8,2.5],[0,-2.8]];
  const index=Math.abs(Number(item.id)||0)%slots.length,position={x:slots[index][0],z:slots[index][1],rotation:0};
  try{
    const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'place_interior_furniture',itemId:item.id,buildingId:house.id,position,idempotencyKey:requestKey(`interior-${item.id}`)})}),data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'furniture_failed');
    await loadCrafting();
    showCraftingError(`${item.name} was installed inside your homestead. Enter the cabin to see it.`);
    craftingResult.dataset.outcome='success';craftingResult.firstElementChild.textContent=`Installed — ${item.name}`;
  }catch{showCraftingError('Could not install that item in your house. Try again after the cabin is built.');}
  finally{itemBusy=false;renderCrafting();}
}
async function buildHouse(){
  const house=craftingData?.house;if(houseBusy||craftBusy||!house?.canAttempt)return;houseBusy=true;renderCrafting();await savePosition();
  const position={x:clamp(player.position.x+Math.sin(player.rotation.y)*4.2,-28,28),z:clamp(player.position.z+Math.cos(player.rotation.y)*4.2,-28,28)};
  try{
    const response=await fetch(CRAFTING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:activeClientId,action:'build_house',position,idempotencyKey:requestKey('build-house')})}),data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'build_failed');
    if(data.inventory){for(const [key,element] of Object.entries(inventoryEls))element.textContent=Number(data.inventory[key]||0);if(loadedPayload)loadedPayload.inventory={...data.inventory};}
    const title=document.createElement('strong'),detail=document.createElement('span');
    craftingResult.classList.remove('unlock-toast');
    if(data.success&&data.building){
      addHomesteadBuilding(data.building);
      if(loadedPayload?.world){loadedPayload.world.buildings=[...(loadedPayload.world.buildings||[]).filter(entry=>String(entry.id)!==String(data.building.id)),data.building];cachePrivateWorld(loadedPayload,activeClientId).catch(()=>{});}
      craftingResult.dataset.outcome='success';title.textContent='Homestead raised';detail.textContent=`Success (${Math.round(Number(data.chance||0)*100)}% roll). Approach the door to enter your cabin.`;
    }else{
      craftingResult.dataset.outcome='failure';title.textContent='Construction faltered';
      const spent=data.materialsSpent||{};detail.textContent=`The frame failed (${Math.round(Number(data.chance||0)*100)}% chance). Lost ${spent.wood||0} wood, ${spent.stone||0} stone, ${spent.herbs||0} herbs.${data.componentsConsumed?' Components were also spent.':' Components were spared.'}`;
    }
    craftingResult.replaceChildren(title,detail);craftingResult.hidden=false;
    if(data.unlocks?.length)showUnlockToasts(data.unlocks);
    await loadCrafting();
  }catch(error){
    showCraftingError(error.message==='insufficient_materials'?'You no longer have enough materials.':error.message==='missing_components'?'Craft the required components first.':error.message==='house_already_built'?'You already have a homestead here.':error.message==='invalid_build_site'?'Move to a clearer build site away from water and other buildings.':error.message==='construction_skill_locked'?'Construction skill is still too low.':error.message==='private_world_required'?'Build inside your personal world.':'The homestead could not be built. Try again.');
  }finally{houseBusy=false;renderCrafting();}
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

function animalLandPosition(current,candidate){
  const half=Math.max(4,Number(terrain?.size||68)/2-1.2),x=clamp(candidate.x,-half,half),z=clamp(candidate.z,-half,half);
  const lake=terrain?.water;if(!lake)return{x,z};
  const dx=x-Number(lake.x||0),dz=z-Number(lake.z||0),distance=Math.hypot(dx,dz),shore=Number(lake.radius||0)+.65;
  if(distance>=shore)return{x,z};
  const oldDx=current.x-Number(lake.x||0),oldDz=current.z-Number(lake.z||0),oldDistance=Math.hypot(oldDx,oldDz);
  const directionX=oldDistance>.01?oldDx/oldDistance:(distance>.01?dx/distance:1),directionZ=oldDistance>.01?oldDz/oldDistance:(distance>.01?dz/distance:0);
  return{x:clamp(Number(lake.x||0)+directionX*shore,-half,half),z:clamp(Number(lake.z||0)+directionZ*shore,-half,half)};
}

function updateAnimals(dt,time){
  const drought=Number(currentEcology.drought||0),forage=Number(currentEcology.forage||.6);
  for(const animal of animals){
    const data=animal.userData,distanceToPlayer=animal.position.distanceTo(player.position);
    let nearbyFire=null,fireDistance=Infinity;for(const sprite of placedCrafts.values()){if(!campfireBurning(sprite.userData.item))continue;const distance=animal.position.distanceTo(sprite.position);if(distance<7&&distance<fireDistance){nearbyFire=sprite;fireDistance=distance;}}
    if(nearbyFire){data.behavior='avoiding fire';data.target.copy(animal.position).sub(nearbyFire.position).normalize().multiplyScalar(9).add(animal.position);data.nextTurn=time+3000;}
    else if(distanceToPlayer<7){data.behavior='fleeing';data.target.copy(animal.position).sub(player.position).normalize().multiplyScalar(7).add(animal.position);data.nextTurn=time+2500;}
    else if(!data.serverDriven&&time>data.nextTurn){
      const seekWater=drought>.58&&hash01(`${worldSeed}:${Math.floor(time/7000)}:${data.phase}`)>.45;
      if(seekWater){const angle=hash01(`${data.phase}:water-shore`)*Math.PI*2,radius=Number(terrain.water.radius||0)+.9;data.behavior='seeking water';data.target.set(terrain.water.x+Math.cos(angle)*radius,0,terrain.water.z+Math.sin(angle)*radius);}
      else if(forage>.42){data.behavior='grazing';const angle=hash01(`${Math.floor(time/5000)}:${data.phase}`)*Math.PI*2;data.target.copy(data.home).add(new THREE.Vector3(Math.cos(angle)*7,0,Math.sin(angle)*7));}
      else{data.behavior='foraging';const angle=hash01(`${Math.floor(time/6500)}:${data.phase}:f`)*Math.PI*2;data.target.set(Math.cos(angle)*24,0,Math.sin(angle)*24);}
      data.nextTurn=time+4200+hash01(`${time}:${data.phase}`)*4200;
    }
    const offset=data.target.clone().sub(animal.position),moving=offset.length()>.6;if(moving){offset.normalize();const distance=dt*data.speed*(data.behavior==='fleeing'?2.3:1),candidate={x:animal.position.x+offset.x*distance,z:animal.position.z+offset.z*distance},land=animalLandPosition(animal.position,candidate);animal.position.x=land.x;animal.position.z=land.z;animal.rotation.y=Math.atan2(offset.x,offset.z);}
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

function plantDescription(item,node){const plant=node?.plant;if(!plant)return node?.remaining>0?`${item.label} · ${node.remaining}/${node.maxAmount} available`:`${item.label} is depleted`;const stage=String(plant.stage||'mature'),health=Math.round(Number(plant.health??100)),available=Math.floor(Number(plant.resources??node.remaining??0)),reason=stage==='dead'?'Dead. A new plant may establish here later.':available<=0?'Depleted and recovering.':'Ready to harvest.';return `${item.label} · ${stage} · health ${health}% · ${available}/${node.maxAmount} available. ${reason}`;}
function updateNearest(){let best=null,distance=Infinity;for(const item of interactables){const d=player.position.distanceTo(item.object.position);if(d<item.radius&&d<distance){best=item;distance=d;}}nearest=best;promptEl.hidden=!best;if(!best)return;const node=best.nodeId&&resourceStates.get(best.nodeId);promptEl.textContent=best.type==='building'?`Enter ${best.label}`:best.type==='farm'?`Tend ${best.label}`:best.type==='animal'?`Track ${best.label}`:best.placedItemId?`Use ${best.label}`:node?`Inspect ${best.label} · ${node.remaining}/${node.maxAmount}`:`Inspect ${best.label}`;}
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
function interact(){if(!nearest)return;if(nearest.type==='building'){enterHomestead(nearest.building);return;}if(nearest.type==='farm'||nearest.type==='animal'){openSurvival(nearest,nearest?.type==='animal'?'hunt':'farm');return;}if(nearest.placedItemId){openCraftedUse(nearest.object.userData.item);return;}if(nearest.nodeId){const node=resourceStates.get(nearest.nodeId),now=performance.now();if(!nearest.inspectedAt||now-nearest.inspectedAt>5000){nearest.inspectedAt=now;showToast(plantDescription(nearest,node));promptEl.textContent=`Gather ${nearest.label} · interact again`;return;}nearest.inspectedAt=0;gather(nearest);return;}showToast(typeof nearest.message==='function'?nearest.message():nearest.message);}
function openPlacedCraftFromTap(event){
  if(!running||!craftTapStart||!craftingPanel.hidden||!craftedUsePanel.hidden)return;const distance=Math.hypot(event.clientX-craftTapStart.x,event.clientY-craftTapStart.y);craftTapStart=null;if(distance>12)return;
  const bounds=renderer.domElement.getBoundingClientRect();craftPointer.set((event.clientX-bounds.left)/bounds.width*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);craftRaycaster.setFromCamera(craftPointer,camera);
  const doorHit=craftRaycaster.intersectObjects(homesteadDoors,false)[0];
  if(doorHit?.object?.userData?.buildingRecordId){
    const record=homesteadBuildings.get(String(doorHit.object.userData.buildingRecordId));
    if(record){if(player.position.distanceTo(record.group.position)>5){showToast('Move closer to enter your homestead.');return;}enterHomestead(record.building);return;}
  }
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

window.addEventListener('keydown',event=>{const key=event.key.toLowerCase();if(key==='escape'&&!survivalPanel.hidden){hideSurvival();event.preventDefault();return;}if(key==='escape'&&!craftedUsePanel.hidden){hideCraftedUse();event.preventDefault();return;}if(key==='escape'&&!craftingPanel.hidden){hideCrafting();event.preventDefault();return;}if(!survivalPanel.hidden||!craftingPanel.hidden||!craftedUsePanel.hidden)return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){keys.add(key);event.preventDefault();}if(key==='e'||key===' '){interact();event.preventDefault();}});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('resize',resize);
window.addEventListener('online',()=>{setSyncState('connecting');flushQueuedPosition();});window.addEventListener('offline',()=>setSyncState('offline'));
for(const gesture of['gesturestart','gesturechange','gestureend'])document.addEventListener(gesture,event=>event.preventDefault(),{passive:false});
window.addEventListener('pagehide',()=>{if(running){const position=currentPosition();queuePrivatePosition(activeClientId,position).catch(()=>{});navigator.sendBeacon?.(API,new Blob([JSON.stringify({clientId:activeClientId,action:'save_position',position})],{type:'application/json'}));}});
worldEl.addEventListener('pointerdown',event=>{if(event.target===renderer?.domElement)craftTapStart={x:event.clientX,y:event.clientY};});worldEl.addEventListener('pointerup',openPlacedCraftFromTap);worldEl.addEventListener('pointercancel',()=>{craftTapStart=null;});
actionButton.addEventListener('click',interact);returnTown.addEventListener('click',leave);retry.addEventListener('click',load);
craftButton.addEventListener('click',openCrafting);closeCrafting.addEventListener('click',hideCrafting);craftingPanel.addEventListener('click',event=>{if(event.target===craftingPanel)hideCrafting();});
skillsButton.addEventListener('click',()=>openSurvival(null,'farm'));huntButton.addEventListener('click',()=>openSurvival(null,'hunt'));closeSurvival.addEventListener('click',hideSurvival);survivalPanel.addEventListener('click',event=>{if(event.target===survivalPanel)hideSurvival();});
closeCraftedUse.addEventListener('click',hideCraftedUse);craftedUsePanel.addEventListener('click',event=>{if(event.target===craftedUsePanel)hideCraftedUse();});

const joystick=$('joystick'),joystickKnob=$('joystickKnob');
function updateJoystick(event){const bounds=joystick.getBoundingClientRect(),centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2,max=bounds.width*.32;let dx=event.clientX-centerX,dy=event.clientY-centerY,distance=Math.hypot(dx,dy);if(distance>max){dx=dx/distance*max;dy=dy/distance*max;}joystickX=dx/max;joystickY=dy/max;if(Math.hypot(joystickX,joystickY)<.12)joystickX=joystickY=0;joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
function resetJoystick(){joystickPointer=null;joystickX=joystickY=0;joystick.classList.remove('active');joystickKnob.style.transform='translate(-50%,-50%)';}
joystick.addEventListener('pointerdown',event=>{event.preventDefault();joystickPointer=event.pointerId;joystick.setPointerCapture?.(event.pointerId);joystick.classList.add('active');updateJoystick(event);});joystick.addEventListener('pointermove',event=>{if(event.pointerId===joystickPointer)updateJoystick(event);});joystick.addEventListener('pointerup',event=>{if(event.pointerId===joystickPointer)resetJoystick();});joystick.addEventListener('pointercancel',resetJoystick);

if('serviceWorker'in navigator)navigator.serviceWorker.register('./private-world-sw.js').catch(()=>{cacheAvailable=false;setSyncState('failed');});
load();
