// Single-player adventure UI for the existing Three.js public forest.
import {SHIPMENT_POINTS,shipmentNarrative} from './lib/shipment-quest-core.mjs';
const ENDPOINT='/.netlify/functions/shipment-quest';
export function createShipmentAdventure({THREE,scene,interactables,player,syncPresence,openTrade,onReward}){
 let quest={stage:'not_started'},busy=false;
 const wrap=document.createElement('section');wrap.id='shipmentPanel';wrap.hidden=true;
 wrap.setAttribute('aria-label','The Missing Blacksmith Shipment');
 wrap.innerHTML=`<div class="shipment-card" role="dialog" aria-modal="true" aria-labelledby="shipmentTitle">
 <header><div><small>GPTWORLD · ADVENTURE 01</small><h2 id="shipmentTitle">The Missing Blacksmith Shipment</h2></div><button id="shipmentClose" type="button" aria-label="Close quest">✕</button></header>
 <p id="shipmentMessage" aria-live="polite"></p><div id="shipmentChoices"></div><div id="shipmentNotice" role="status" aria-live="polite"></div>
 </div>`;
 document.body.append(wrap);
 const message=wrap.querySelector('#shipmentMessage'),buttons=wrap.querySelector('#shipmentChoices'),notice=wrap.querySelector('#shipmentNotice');
 const questHud=document.createElement('button');questHud.id='shipmentHud';questHud.type='button';questHud.textContent='📜 Quest';document.body.append(questHud);
 const markerPositions={tracks:SHIPMENT_POINTS.tracks,wagon:SHIPMENT_POINTS.wagon,wolf:SHIPMENT_POINTS.wolf,cache:SHIPMENT_POINTS.cache};
 const markerNames={tracks:'Wagon tracks',wagon:'Damaged wagon',wolf:'Forest wolf',cache:'Supply crate'};
 const visuals={};
 for(const [key,pos] of Object.entries(markerPositions)){
  const group=new THREE.Group();group.position.set(pos.x,0,pos.z);
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(.6,.65,.12,12),new THREE.MeshStandardMaterial({color:key==='wolf'?0x815a43:0x675a41,roughness:.91}));
  ground.position.y=.09;ground.castShadow=true;group.add(ground);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,1.45,8),new THREE.MeshStandardMaterial({color:0x826143}));pole.position.set(0,.75,0);pole.castShadow=true;group.add(pole);
  const flag=new THREE.Mesh(new THREE.BoxGeometry(.75,.36,.055),new THREE.MeshStandardMaterial({color:key==='wolf'?0x9f5944:0xd9b16b}));flag.position.set(.34,1.32,0);group.add(flag);
  const sprite=document.createElement('canvas');sprite.width=256;sprite.height=70;const ctx=sprite.getContext('2d');
  ctx.fillStyle='rgba(18,28,22,.88)';ctx.fillRect(0,0,256,70);ctx.fillStyle='#f7e2b7';ctx.font='bold 24px system-ui';ctx.textAlign='center';ctx.fillText(markerNames[key],128,45);
  const texture=new THREE.CanvasTexture(sprite);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true}));label.position.set(0,2.05,0);label.scale.set(3, .82,1);group.add(label);
  if(key==='wagon'){
    const wagon=new THREE.Group();wagon.position.set(.7,0,-.4);wagon.rotation.y=.4;
    const timber=new THREE.MeshStandardMaterial({color:0x855936,roughness:.88});
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2,.25,1.25),timber);frame.position.y=.54;wagon.add(frame);
    for(const x of [-.85,.85])for(const z of [-.7,.7]){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.38,.09,7,14),new THREE.MeshStandardMaterial({color:0x49392c}));wheel.rotation.y=Math.PI/2;wheel.position.set(x,.35,z);wagon.add(wheel);
    }
    for(const z of [-.49,.49]){const side=new THREE.Mesh(new THREE.BoxGeometry(2,.39,.12),timber);side.position.set(0,.8,z);wagon.add(side);}
    group.add(wagon);
  }
  if(key==='wolf'){
    const fur=new THREE.MeshStandardMaterial({color:0x7c7062,roughness:.95}),dark=new THREE.MeshStandardMaterial({color:0x504c45});
    const wolf=new THREE.Group();wolf.position.set(0,.12,-.5);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.33,.73,6,10),fur);body.rotation.z=Math.PI/2;body.position.y=.57;wolf.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.29,10,8),fur);head.position.set(.7,.69,0);wolf.add(head);
    for(const z of [-.17,.17]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.13,.26,7),dark);ear.position.set(.75,.99,z);wolf.add(ear);}
    for(const x of [-.4,.45])for(const z of [-.22,.22]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.085,.07,.48,7),fur);leg.position.set(x,.29,z);wolf.add(leg);}
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.5,8),fur);tail.rotation.z=-1.2;tail.position.set(-.78,.72,0);wolf.add(tail);
    group.add(wolf);
  }
  if(key==='tracks'){
    for(let i=0;i<4;i++){const footprint=new THREE.Mesh(new THREE.BoxGeometry(.26,.035,.42),new THREE.MeshStandardMaterial({color:0x48372b}));footprint.position.set((i%2)*.48-.4,.05,-.5+Math.floor(i/2)*.47);footprint.rotation.y=.24;group.add(footprint);}
  }
  if(key==='cache'){
    const crate=new THREE.Mesh(new THREE.BoxGeometry(.85,.62,.72),new THREE.MeshStandardMaterial({color:0x795337,roughness:.9}));crate.position.set(.5,.31,-.35);crate.rotation.y=.25;group.add(crate);
  }
  scene.add(group);visuals[key]=group;
  interactables.push({type:'shipment',shipmentKey:key,label:markerNames[key],object:group,radius:3.0});
 }
 function visibleMarker(key,stage){return ({tracks:stage==='tracking',wagon:stage==='wagon_found',wolf:stage==='wagon_found',cache:stage==='wolf_resolved'})[key]||false;}
 function paint(){
  for(const [key,group] of Object.entries(visuals))group.visible=visibleMarker(key,quest.stage);
  questHud.textContent=quest.stage==='completed'?'✓ Shipment completed':'📜 '+(quest.stage==='not_started'?'New adventure':'Shipment quest');
  questHud.title=shipmentNarrative(quest.stage);
  message.textContent=shipmentNarrative(quest.stage);
  buttons.replaceChildren();
  const actions=[];
  if(quest.stage==='not_started')actions.push(['Accept Tovan’s quest','accept']);
  if(quest.stage==='tracking')actions.push(['Track the wagon (forest)','none']);
  if(quest.stage==='wagon_found')actions.push(['Shoot wolf with equipped bow','fight_wolf'],['Sneak around wolf','avoid_wolf']);
  if(quest.stage==='wolf_resolved')actions.push(['Recover scattered shipment','recover']);
  if(quest.stage==='shipment_recovered')actions.push(['Return supplies to Tovan','turn_in']);
  if(quest.stage==='completed')actions.push(['Quest completed ✓','none']);
  if(quest.stage==='not_started'||quest.stage==='shipment_recovered')actions.push(['Trade with Tovan','trade']);
  for(const [label,action] of actions){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=busy||action==='none';
   button.addEventListener('click',()=>action==='trade'?(close(),openTrade()):act(action));buttons.append(button);
  }
 }
 function close(){wrap.hidden=true;}
 function open(){wrap.hidden=false;notice.textContent='';paint();}
 wrap.querySelector('#shipmentClose').addEventListener('click',close);
 wrap.addEventListener('click',event=>{if(event.target===wrap)close();});
 questHud.addEventListener('click',open);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!wrap.hidden){close();event.stopImmediatePropagation();}});
 async function reload(){
  const clientId=localStorage.getItem('gptworld-client-id');if(!clientId)return;
  try{const response=await fetch(ENDPOINT+'?clientId='+encodeURIComponent(clientId),{cache:'no-store'}),data=await response.json();
    if(data.ok){quest=data.quest;paint();}}
  catch(error){console.warn('Shipment quest not available',error);}
 }
 async function act(action){
  if(busy)return;
  const target=action==='accept'||action==='turn_in'?SHIPMENT_POINTS.tovan:action==='recover'?SHIPMENT_POINTS.cache:SHIPMENT_POINTS.wolf;
  if(target&&Math.hypot(player.position.x-target.x,player.position.z-target.z)>6.2){notice.textContent='Approach the quest location before interacting.';return;}
  busy=true;notice.textContent='Saving quest progress…';paint();
  try{
   await syncPresence();
   const clientId=localStorage.getItem('gptworld-client-id');
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({clientId,action,idempotencyKey:crypto.randomUUID()})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(({equip_bow_first:'Equip a bow in your main hand first.',approach_quest_location:'Move closer to the forest marker or Tovan.',quest_action_unavailable:'That step is not available yet.',return_to_public_world:'Return to public town first.'})[data.error]||data.error||'Quest could not advance');
   quest=data.quest;
   notice.textContent=data.reward?'Quest complete! 35 coins, 8 stone, +2 Blacksmithing and Trail Repair Fittings unlocked.':'Quest progress saved.';
   if(data.reward)onReward?.(data);
  }catch(error){notice.textContent=error.message;}finally{busy=false;paint();}
 }
 function interact(key){
  if(key==='tovan'){open();return;}
  const stage=quest.stage;
  const action=key==='tracks'?'inspect_tracks':key==='wagon'?'inspect_tracks':key==='wolf'?'avoid_wolf':key==='cache'?'recover':null;
  if(key==='tracks'&&stage==='tracking')act('inspect_tracks');
  else if(key==='wolf'&&stage==='wagon_found')open();
  else if(key==='cache'&&stage==='wolf_resolved')act('recover');
  else{open();}
 }
 const originalPaint=paint;
 // Markers only appear during their corresponding quest stage.
 reload();window.addEventListener('focus',reload);
 return{open,close,reload,interact,get stage(){return quest.stage;}};
}
