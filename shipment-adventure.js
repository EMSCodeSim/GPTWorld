// Single-player adventure UI for the existing Three.js public forest.
import {
  SHIPMENT_POINTS,shipmentNarrative,shipmentObjective,shipmentWaypoint,shipmentFeedback
} from './lib/shipment-quest-core.mjs';

const ENDPOINT='/.netlify/functions/shipment-quest';

export function createShipmentAdventure({THREE,scene,interactables,player,syncPresence,openTrade,onReward}){
 let quest={stage:'not_started',meta:{},objective:'',description:''},busy=false;
 const wrap=document.createElement('section');wrap.id='shipmentPanel';wrap.hidden=true;
 wrap.setAttribute('aria-label','The Missing Blacksmith Shipment');
 wrap.innerHTML=`<div class="shipment-card" role="dialog" aria-modal="true" aria-labelledby="shipmentTitle">
 <header><div><small>GPTWORLD · ADVENTURE 01</small><h2 id="shipmentTitle">The Missing Blacksmith Shipment</h2></div><button id="shipmentClose" type="button" aria-label="Close quest">✕</button></header>
 <p id="shipmentObjectiveLine" class="shipment-objective-line"></p>
 <p id="shipmentMessage" aria-live="polite"></p>
 <div id="shipmentChoices"></div>
 <div id="shipmentNotice" role="status" aria-live="polite"></div>
 </div>`;
 document.body.append(wrap);

 const message=wrap.querySelector('#shipmentMessage');
 const objectiveLine=wrap.querySelector('#shipmentObjectiveLine');
 const buttons=wrap.querySelector('#shipmentChoices');
 const notice=wrap.querySelector('#shipmentNotice');

 const questHud=document.createElement('button');
 questHud.id='shipmentHud';questHud.type='button';questHud.textContent='📜 Quest';
 document.body.append(questHud);

 // Compact always-on objective dock — readable on phone without opening the modal.
 const dock=document.createElement('aside');
 dock.id='shipmentDock';
 dock.setAttribute('role','status');
 dock.innerHTML=`<div class="shipment-dock-label">OBJECTIVE</div>
  <div id="shipmentDockText" class="shipment-dock-text"></div>
  <div id="shipmentDockActions" class="shipment-dock-actions"></div>`;
 document.body.append(dock);
 const dockText=dock.querySelector('#shipmentDockText');
 const dockActions=dock.querySelector('#shipmentDockActions');

 const guide=document.createElement('div');
 guide.id='shipmentWaypoint';guide.setAttribute('role','status');guide.hidden=true;
 document.body.append(guide);

 const errorText=error=>({
  equip_bow_first:'Equip a bow in your main hand first (Avatar → Pack).',
  approach_quest_location:'Move closer to the marked spot, then try again.',
  quest_action_unavailable:'That step is not available yet.',
  return_to_public_world:'Return to the public town first.',
  quest_state_changed:'Quest already updated — reopening your journal.',
  reward_unavailable_retry:'Reward already claimed or quest moved on.'
 })[error]||error||'Quest could not advance';

 const currentWaypoint=()=>shipmentWaypoint(quest.stage);
 const updateGuide=()=>{
  const next=currentWaypoint();
  if(!next||quest.stage==='completed'||quest.stage==='not_started'){guide.hidden=true;return;}
  const [name,p]=next,dx=p.x-player.position.x,dz=p.z-player.position.z,distance=Math.round(Math.hypot(dx,dz));
  const direction=Math.abs(dx)>Math.abs(dz)?(dx>0?'East →':'← West'):(dz>0?'South ↓':'↑ North');
  guide.textContent=`📍 ${name} · ${distance}m · ${direction}`;
  guide.hidden=false;
 };
 const guideTimer=setInterval(()=>{updateGuide();paintDock();},700);
 window.addEventListener('pagehide',()=>clearInterval(guideTimer),{once:true});

 const markerPositions={
  tracks:SHIPMENT_POINTS.tracks,
  wagon:SHIPMENT_POINTS.wagon,
  wolf:SHIPMENT_POINTS.wolf,
  cache:SHIPMENT_POINTS.cache,
  axle:SHIPMENT_POINTS.axle,
  scrap:SHIPMENT_POINTS.scrap
 };
 const markerNames={
  tracks:'Wagon tracks',wagon:'Damaged wagon',wolf:'Forest wolf',cache:'Supply crate',
  axle:'Broken axle',scrap:'Torn crate lid'
 };
 const visuals={};
 for(const [key,pos] of Object.entries(markerPositions)){
  const group=new THREE.Group();group.position.set(pos.x,0,pos.z);
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(.55,.6,.1,12),new THREE.MeshStandardMaterial({
   color:key==='wolf'?0x815a43:(key==='axle'||key==='scrap'?0x5a4e3a:0x675a41),roughness:.91
  }));
  ground.position.y=.08;ground.castShadow=true;group.add(ground);
  if(key!=='axle'&&key!=='scrap'){
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,1.45,8),new THREE.MeshStandardMaterial({color:0x826143}));
   pole.position.set(0,.75,0);pole.castShadow=true;group.add(pole);
   const flag=new THREE.Mesh(new THREE.BoxGeometry(.75,.36,.055),new THREE.MeshStandardMaterial({color:key==='wolf'?0x9f5944:0xd9b16b}));
   flag.position.set(.34,1.32,0);group.add(flag);
   const sprite=document.createElement('canvas');sprite.width=256;sprite.height=70;const ctx=sprite.getContext('2d');
   ctx.fillStyle='rgba(18,28,22,.88)';ctx.fillRect(0,0,256,70);ctx.fillStyle='#f7e2b7';ctx.font='bold 24px system-ui';ctx.textAlign='center';ctx.fillText(markerNames[key],128,45);
   const texture=new THREE.CanvasTexture(sprite);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true}));
   label.position.set(0,2.05,0);label.scale.set(3,.82,1);group.add(label);
  }else{
   const sprite=document.createElement('canvas');sprite.width=220;sprite.height=56;const ctx=sprite.getContext('2d');
   ctx.fillStyle='rgba(18,28,22,.75)';ctx.fillRect(0,0,220,56);ctx.fillStyle='#d8c49a';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(markerNames[key],110,34);
   const texture=new THREE.CanvasTexture(sprite);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true}));
   label.position.set(0,1.35,0);label.scale.set(2.4,.62,1);group.add(label);
  }
  if(key==='wagon'){
    const wagon=new THREE.Group();wagon.position.set(.7,0,-.4);wagon.rotation.y=.4;
    const timber=new THREE.MeshStandardMaterial({color:0x855936,roughness:.88});
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2,.25,1.25),timber);frame.position.y=.54;wagon.add(frame);
    for(const x of [-.85,.85])for(const z of [-.7,.7]){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.38,.09,7,14),new THREE.MeshStandardMaterial({color:0x49392c}));
      wheel.rotation.y=Math.PI/2;wheel.position.set(x,.35,z);wagon.add(wheel);
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
    for(let i=0;i<4;i++){
      const footprint=new THREE.Mesh(new THREE.BoxGeometry(.26,.035,.42),new THREE.MeshStandardMaterial({color:0x48372b}));
      footprint.position.set((i%2)*.48-.4,.05,-.5+Math.floor(i/2)*.47);footprint.rotation.y=.24;group.add(footprint);
    }
  }
  if(key==='cache'){
    const crate=new THREE.Mesh(new THREE.BoxGeometry(.85,.62,.72),new THREE.MeshStandardMaterial({color:0x795337,roughness:.9}));
    crate.position.set(.5,.31,-.35);crate.rotation.y=.25;group.add(crate);
  }
  if(key==='axle'){
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,1.1,8),new THREE.MeshStandardMaterial({color:0x6d6a66,metalness:.35,roughness:.55}));
    bar.rotation.z=Math.PI/2;bar.position.set(0,.18,0);group.add(bar);
  }
  if(key==='scrap'){
    const lid=new THREE.Mesh(new THREE.BoxGeometry(.7,.08,.55),new THREE.MeshStandardMaterial({color:0x8a6842,roughness:.92}));
    lid.position.set(0,.12,0);lid.rotation.y=.35;group.add(lid);
  }
  scene.add(group);visuals[key]=group;
  interactables.push({type:'shipment',shipmentKey:key,label:markerNames[key],object:group,radius:key==='axle'||key==='scrap'?2.6:3.0});
 }

 function cluesFound(){return quest.meta?.clues||[];}
 function visibleMarker(key,stage){
  const clues=cluesFound();
  if(key==='axle')return (stage==='tracking'||stage==='wagon_found')&&!clues.includes('axle');
  if(key==='scrap')return (stage==='tracking'||stage==='wagon_found')&&!clues.includes('scrap');
  return({tracks:stage==='tracking',wagon:stage==='wagon_found'||stage==='wolf_resolved',wolf:stage==='wagon_found',cache:stage==='wolf_resolved'})[key]||false;
 }

 function near(point,radius=6.2){return Math.hypot(player.position.x-point.x,player.position.z-point.z)<=radius;}

 function primaryActions(){
  const stage=quest.stage,actions=[];
  if(stage==='not_started')actions.push(['Accept Tovan’s quest','accept']);
  if(stage==='tracking'){
   if(near(SHIPMENT_POINTS.tracks))actions.push(['Inspect wagon tracks','inspect_tracks']);
   if(near(SHIPMENT_POINTS.axle)&&!cluesFound().includes('axle'))actions.push(['Examine broken axle','find_clue_axle']);
   if(near(SHIPMENT_POINTS.scrap)&&!cluesFound().includes('scrap'))actions.push(['Inspect torn crate lid','find_clue_scrap']);
   if(near(SHIPMENT_POINTS.mara)&&!cluesFound().includes('rumor'))actions.push(['Ask Mara about the wagon','hear_rumor']);
  }
  if(stage==='wagon_found'){
   if(near(SHIPMENT_POINTS.wolf)){
    actions.push(['Shoot wolf (bow equipped)','fight_wolf']);
    actions.push(['Sneak past the wolf','avoid_wolf']);
   }
   if(near(SHIPMENT_POINTS.axle)&&!cluesFound().includes('axle'))actions.push(['Examine broken axle','find_clue_axle']);
   if(near(SHIPMENT_POINTS.scrap)&&!cluesFound().includes('scrap'))actions.push(['Inspect torn crate lid','find_clue_scrap']);
   if(near(SHIPMENT_POINTS.mara)&&!cluesFound().includes('rumor'))actions.push(['Ask Mara about the wagon','hear_rumor']);
  }
  if(stage==='wolf_resolved'&&near(SHIPMENT_POINTS.cache))actions.push(['Recover scattered shipment','recover']);
  if(stage==='shipment_recovered'&&near(SHIPMENT_POINTS.tovan))actions.push(['Deliver supplies to Tovan','turn_in']);
  if(stage==='completed')actions.push(['Replay the trail (new clues & bonuses)','replay']);
  return actions;
 }

 function paintDock(){
  const objective=quest.objective||shipmentObjective(quest.stage,quest.meta);
  dockText.textContent=objective;
  dock.hidden=false;
  dock.dataset.stage=quest.stage;
  dockActions.replaceChildren();
  const nearby=primaryActions().slice(0,2);
  for(const [label,action] of nearby){
   const button=document.createElement('button');
   button.type='button';button.textContent=label;button.disabled=busy;
   button.addEventListener('click',()=>act(action));
   dockActions.append(button);
  }
  if(!nearby.length){
   const tip=document.createElement('button');
   tip.type='button';tip.textContent='Open journal';
   tip.addEventListener('click',open);
   dockActions.append(tip);
  }
 }

 function paint(){
  for(const [key,group] of Object.entries(visuals))group.visible=visibleMarker(key,quest.stage);
  const active=quest.stage!=='not_started'&&quest.stage!=='completed';
  questHud.textContent=quest.stage==='completed'?'✓ Shipment done':quest.stage==='not_started'?'📜 New adventure':'📜 Shipment quest';
  questHud.title=shipmentObjective(quest.stage,quest.meta);
  questHud.dataset.active=active?'1':'0';
  updateGuide();
  paintDock();

  const waypoint=currentWaypoint();
  const dx=waypoint?waypoint[1].x-player.position.x:0,dz=waypoint?waypoint[1].z-player.position.z:0;
  const direction=waypoint?(Math.abs(dx)>Math.abs(dz)?(dx>0?'east':'west'):(dz>0?'south':'north')):'';
  const dist=waypoint?Math.round(Math.hypot(dx,dz)):0;
  objectiveLine.textContent=quest.objective||shipmentObjective(quest.stage,quest.meta);
  message.style.whiteSpace='pre-line';
  let body=quest.description||shipmentNarrative(quest.stage,quest.meta);
  if(waypoint&&quest.stage!=='completed'){
   body+='\n\nNext stop: '+dist+'m '+direction+(quest.stage==='not_started'?' (Tovan at the smithy).':' (follow the waypoint).');
  }
  if(cluesFound().length)body+='\nClues: '+cluesFound().join(', ')+'.';
  message.textContent=body;

  buttons.replaceChildren();
  const actions=[...primaryActions()];
  if(quest.stage==='tracking'||quest.stage==='wagon_found'){
   if(!actions.some(([,a])=>a==='find_clue_axle')&&!cluesFound().includes('axle'))actions.push(['Seek broken axle (explore east trail)','close']);
   if(!actions.some(([,a])=>a==='hear_rumor')&&!cluesFound().includes('rumor'))actions.push(['Visit Mara at the inn yard','close']);
  }
  if(quest.stage!=='not_started')actions.push(['Trade with Tovan','trade']);
  if(quest.stage==='completed')actions.push(['Close journal','close']);
  for(const [label,action] of actions){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=busy;
   button.addEventListener('click',()=>action==='trade'?(close(),openTrade()):action==='close'?close():act(action));
   buttons.append(button);
  }
 }

 function close(){wrap.hidden=true;}
 function open(){wrap.hidden=false;notice.textContent='';paint();}
 wrap.querySelector('#shipmentClose').addEventListener('click',close);
 wrap.addEventListener('click',event=>{if(event.target===wrap)close();});
 questHud.addEventListener('click',open);
 window.addEventListener('gptworld:open-adventure',open);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!wrap.hidden){close();event.stopImmediatePropagation();}});

 async function reload(){
  const clientId=localStorage.getItem('gptworld-client-id');if(!clientId)return;
  try{
   const response=await fetch(ENDPOINT+'?clientId='+encodeURIComponent(clientId),{cache:'no-store'});
   const data=await response.json();
   if(data.ok){quest=data.quest;paint();window.dispatchEvent(new CustomEvent('gptworld:shipment-quest',{detail:quest}));}
   else notice.textContent='Quest unavailable: '+String(data.error||'server did not return quest progress');
  }catch(error){
   console.warn('Shipment quest not available',error);
   notice.textContent='Unable to load Adventure 01. Check your connection and try reopening.';
  }
 }

 async function act(action){
  if(busy||action==='none')return;
  const target=action==='accept'||action==='replay'?null
   :action==='turn_in'?SHIPMENT_POINTS.tovan
   :action==='inspect_tracks'?SHIPMENT_POINTS.tracks
   :action==='recover'?SHIPMENT_POINTS.cache
   :action==='find_clue_axle'?SHIPMENT_POINTS.axle
   :action==='find_clue_scrap'?SHIPMENT_POINTS.scrap
   :action==='hear_rumor'?SHIPMENT_POINTS.mara
   :SHIPMENT_POINTS.wolf;
  if(target&&!near(target)){
   notice.textContent=`Move ${Math.round(Math.hypot(player.position.x-target.x,player.position.z-target.z))}m closer, then try again.`;
   paintDock();
   return;
  }
  busy=true;notice.textContent='Saving quest progress…';paint();
  try{
   await syncPresence();
   const clientId=localStorage.getItem('gptworld-client-id');
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({clientId,action,idempotencyKey:crypto.randomUUID()})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(errorText(data.error));
   quest=data.quest;
   const feedback=data.message||shipmentFeedback(action,quest);
   notice.textContent=feedback;
   if(data.reward){
    onReward?.(data);
    guide.hidden=true;
   }else if(data.combat&&!data.combat.success){
    notice.textContent=data.message||'The wolf remains. Try again or sneak around.';
   }
   window.dispatchEvent(new CustomEvent('gptworld:shipment-quest',{detail:quest}));
   if(action==='accept'||action==='replay')window.dispatchEvent(new CustomEvent('gptworld:toast',{detail:feedback}));
  }catch(error){notice.textContent=error.message;}
  finally{busy=false;paint();}
 }

 function interact(key){
  if(key==='tovan'){
   open();
   if(quest.stage==='shipment_recovered'){notice.textContent='Delivering recovered shipment to Tovan…';act('turn_in');}
   else if(quest.stage==='not_started')notice.textContent='Tovan needs that east-trail shipment. Accept the quest when ready.';
   else if(quest.stage==='completed')notice.textContent='Tovan nods at the forge. Replay the trail anytime for new clues.';
   return;
  }
  if(key==='mara'||key==='rumor'){
   if((quest.stage==='tracking'||quest.stage==='wagon_found')&&!cluesFound().includes('rumor')){open();act('hear_rumor');}
   else open();
   return;
  }
  const stage=quest.stage;
  if(key==='tracks'&&stage==='tracking'){open();act('inspect_tracks');}
  else if(key==='wolf'&&stage==='wagon_found')open();
  else if(key==='cache'&&stage==='wolf_resolved'){open();act('recover');}
  else if(key==='axle'&&(stage==='tracking'||stage==='wagon_found')){open();act('find_clue_axle');}
  else if(key==='scrap'&&(stage==='tracking'||stage==='wagon_found')){open();act('find_clue_scrap');}
  else open();
 }

 paint();reload();window.addEventListener('focus',reload);
 return{open,close,reload,interact,get stage(){return quest.stage;},get quest(){return quest;}};
}
