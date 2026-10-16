// Living World Encounters — exploration events while traveling the public map.
import {ENCOUNTER_APPROACH_RADIUS,ENCOUNTER_CLUE_RADIUS,ENCOUNTER_SCAN_MS} from './lib/world-encounters-core.mjs';

const ENDPOINT='/.netlify/functions/world-encounters';

export function createWorldEncounters({THREE,scene,interactables,player,syncPresence,onReward,onFavor}){
  let state={encounter:null,traces:[],favors:{},busy:false};
  const visuals={marker:null,clue:null,routes:[]};
  const interactRefs=[];

  const prompt=document.createElement('section');
  prompt.id='encounterPrompt';prompt.hidden=true;
  prompt.setAttribute('aria-label','Living world encounter');
  prompt.innerHTML=`<div class="enc-kicker">LIVING WORLD</div>
    <h2 id="encounterTitle"></h2>
    <p id="encounterBody"></p>
    <div id="encounterActions"></div>
    <div id="encounterNotice" role="status" aria-live="polite"></div>`;
  document.body.append(prompt);
  const titleEl=prompt.querySelector('#encounterTitle');
  const bodyEl=prompt.querySelector('#encounterBody');
  const actionsEl=prompt.querySelector('#encounterActions');
  const noticeEl=prompt.querySelector('#encounterNotice');

  const beacon=document.createElement('div');
  beacon.id='encounterBeacon';beacon.hidden=true;beacon.setAttribute('role','status');
  document.body.append(beacon);

  function clientId(){return localStorage.getItem('gptworld-client-id')||'';}
  function gameReady(){const welcome=document.getElementById('welcome');return Boolean(welcome?.hidden);}
  function distTo(point){if(!point)return Infinity;return Math.hypot(player.position.x-point.x,player.position.z-point.z);}
  function errorText(code,data){
    return({
      approach_encounter:'Move closer to the encounter.',
      approach_clue:'Search nearer the clue marks.',
      clue_required:'Find the nearby clue first.',
      equip_bow_first:'Equip a bow in your main hand first.',
      insufficient_resources:'You need more supplies for that choice.',
      no_active_encounter:'Nothing active here right now.',
      return_to_public_world:'Return to the public world first.'
    })[code]||data?.message||code||'That action failed.';
  }

  function clearVisual(group){
    if(!group)return;
    scene.remove(group);
    group.traverse(obj=>{
      if(obj.geometry)obj.geometry.dispose?.();
      if(obj.material){
        if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  }

  function makeLabel(text,color='#f7e2b7'){
    const canvas=document.createElement('canvas');canvas.width=280;canvas.height=64;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(18,28,22,.88)';ctx.fillRect(0,0,280,64);
    ctx.fillStyle=color;ctx.font='bold 22px system-ui';ctx.textAlign='center';ctx.fillText(text,140,40);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true}));
    sprite.scale.set(3.1,.72,1);return sprite;
  }

  function buildMarker(encounter){
    clearVisual(visuals.marker);visuals.marker=null;
    if(!encounter||encounter.status==='resolved')return;
    const pos=encounter.spawn;if(!pos)return;
    const group=new THREE.Group();group.position.set(pos.x,0,pos.z);
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(.7,.78,.1,14),new THREE.MeshStandardMaterial({
      color:encounter.mood==='challenge'?0x8a4f3a:0x5f7a4e,roughness:.9
    }));
    ring.position.y=.08;group.add(ring);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,1.2,8),new THREE.MeshStandardMaterial({color:0x7a6244}));
    pole.position.y=.7;group.add(pole);
    const flag=new THREE.Mesh(new THREE.BoxGeometry(.55,.28,.04),new THREE.MeshStandardMaterial({
      color:encounter.mood==='challenge'?0xc47a4b:0xc9b16a
    }));
    flag.position.set(.28,1.15,0);group.add(flag);
    const label=makeLabel(encounter.name||'Encounter');label.position.set(0,1.85,0);group.add(label);
    if(encounter.mood==='challenge'){
      const creature=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshStandardMaterial({color:0x6a5a48,roughness:.95}));
      creature.position.set(-.55,.35,-.2);group.add(creature);
    }else{
      const crate=new THREE.Mesh(new THREE.BoxGeometry(.45,.35,.4),new THREE.MeshStandardMaterial({color:0x8a6842,roughness:.9}));
      crate.position.set(-.5,.22,-.15);group.add(crate);
    }
    scene.add(group);visuals.marker=group;
    const ref={type:'encounter',encounterId:encounter.id,label:encounter.name,object:group,radius:3.2};
    interactables.push(ref);interactRefs.push(ref);
  }

  function buildClue(encounter){
    clearVisual(visuals.clue);visuals.clue=null;
    if(!encounter?.clue||encounter.clue.found||encounter.status==='resolved')return;
    const pos=encounter.clue;const group=new THREE.Group();group.position.set(pos.x,0,pos.z);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,.06,10),new THREE.MeshStandardMaterial({color:0x5a4e3a,roughness:.92}));
    pad.position.y=.05;group.add(pad);
    const chip=new THREE.Mesh(new THREE.BoxGeometry(.35,.05,.22),new THREE.MeshStandardMaterial({color:0x9a8260}));
    chip.position.set(0,.1,0);chip.rotation.y=.4;group.add(chip);
    const label=makeLabel(pos.label||'Clue','#d8c49a');label.position.set(0,1.2,0);label.scale.set(2.4,.55,1);group.add(label);
    scene.add(group);visuals.clue=group;
    const ref={type:'encounter-clue',encounterId:encounter.id,label:pos.label||'Clue',object:group,radius:2.4};
    interactables.push(ref);interactRefs.push(ref);
  }

  function purgeInteractRefs(){
    for(const ref of interactRefs){
      const idx=interactables.indexOf(ref);
      if(idx>=0)interactables.splice(idx,1);
    }
    interactRefs.length=0;
  }

  function buildRoutes(traces){
    for(const route of visuals.routes)clearVisual(route);
    visuals.routes=[];
    for(const trace of traces||[]){
      if(trace.kind!=='route'||!Array.isArray(trace.points)||trace.points.length<2)continue;
      const group=new THREE.Group();
      for(let i=0;i<trace.points.length-1;i++){
        const a=trace.points[i],b=trace.points[i+1];
        const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||0.1;
        const plank=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.42),new THREE.MeshStandardMaterial({color:0x7d6848,roughness:.9}));
        plank.position.set((a[0]+b[0])/2,.05,(a[1]+b[1])/2);
        plank.rotation.y=Math.atan2(dx,dz);
        group.add(plank);
      }
      scene.add(group);visuals.routes.push(group);
    }
  }

  function paintBeacon(){
    const enc=state.encounter;
    if(!gameReady()||!enc||enc.status==='resolved'){beacon.hidden=true;return;}
    const target=enc.clue&&!enc.clue.found&&distTo(enc.clue)<distTo(enc.spawn)?enc.clue:enc.spawn;
    const d=Math.round(distTo(target));
    const dx=(target?.x||0)-player.position.x,dz=(target?.z||0)-player.position.z;
    const dir=Math.abs(dx)>Math.abs(dz)?(dx>0?'East':'West'):(dz>0?'South':'North');
    const label=enc.clue&&!enc.clue.found&&target===enc.clue?(enc.clue.label||'Clue'):(enc.name||'Encounter');
    beacon.textContent=`✦ ${label} · ${d}m · ${dir}`;
    beacon.hidden=d>48;
  }

  function paintPrompt(){
    const enc=state.encounter;
    if(!gameReady()||!enc||enc.status==='resolved'){
      // Keep resolved summary briefly if prompt already open
      if(enc?.status==='resolved'&&!prompt.hidden){
        titleEl.textContent=enc.name||'Encounter';
        bodyEl.textContent=enc.message||'Resolved.';
        actionsEl.replaceChildren();
        const done=document.createElement('button');done.type='button';done.textContent='Continue exploring';
        done.addEventListener('click',()=>act('clear_resolved'));actionsEl.append(done);
        return;
      }
      prompt.hidden=true;return;
    }
    const nearEnc=distTo(enc.spawn)<=ENCOUNTER_APPROACH_RADIUS+0.6;
    const nearClue=enc.clue&&!enc.clue.found&&distTo(enc.clue)<=ENCOUNTER_CLUE_RADIUS+0.6;
    if(!nearEnc&&!nearClue&&enc.status!=='engaged'){prompt.hidden=true;return;}

    prompt.hidden=false;
    titleEl.textContent=enc.title||enc.name||'Encounter';
    bodyEl.textContent=enc.body||'';
    actionsEl.replaceChildren();

    if(nearClue){
      const btn=document.createElement('button');btn.type='button';btn.textContent=`Inspect ${enc.clue.label}`;
      btn.disabled=state.busy;btn.addEventListener('click',()=>act('find_clue'));actionsEl.append(btn);
    }
    if(nearEnc){
      if(enc.status!=='engaged'){
        const look=document.createElement('button');look.type='button';look.textContent='Look closer';
        look.disabled=state.busy;look.addEventListener('click',()=>act('engage'));actionsEl.append(look);
      }
      for(const choice of enc.choices||[]){
        const btn=document.createElement('button');btn.type='button';
        btn.textContent=choice.locked?`${choice.label} (find clue first)`:choice.label;
        btn.disabled=state.busy||choice.locked;
        btn.addEventListener('click',()=>act('choose',{choiceId:choice.id}));
        actionsEl.append(btn);
      }
      const defer=document.createElement('button');defer.type='button';defer.className='secondary';
      defer.textContent='Step away for now';defer.disabled=state.busy;
      defer.addEventListener('click',()=>act('defer'));actionsEl.append(defer);
    }
  }

  function syncVisuals(){
    purgeInteractRefs();
    buildMarker(state.encounter);
    buildClue(state.encounter);
    buildRoutes(state.traces);
    paintBeacon();
    paintPrompt();
  }

  async function reload({scan=false}={}){
    const id=clientId();if(!id||!gameReady())return;
    try{
      const response=await fetch(`${ENDPOINT}?clientId=${encodeURIComponent(id)}${scan?'&scan=1':''}`,{cache:'no-store'});
      const data=await response.json();
      if(!data.ok)return;
      state.encounter=data.encounter||null;
      state.traces=data.traces||[];
      state.favors=data.favors||{};
      syncVisuals();
      window.dispatchEvent(new CustomEvent('gptworld:world-encounter',{detail:data}));
      if(data.favors)onFavor?.(data.favors);
    }catch(error){console.warn('World encounters unavailable',error);}
  }

  async function act(action,extra={}){
    if(state.busy)return;
    state.busy=true;noticeEl.textContent='Saving…';paintPrompt();
    try{
      await syncPresence?.();
      const id=clientId();
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({clientId:id,action,...extra,idempotencyKey:crypto.randomUUID()})});
      const data=await response.json();
      if(!response.ok||!data.ok)throw Error(errorText(data.error,data));
      state.encounter=data.encounter||null;
      state.traces=data.traces||state.traces;
      state.favors=data.favors||state.favors;
      noticeEl.textContent=data.message||'Done.';
      if(data.player)onReward?.(data);
      if(data.message)window.dispatchEvent(new CustomEvent('gptworld:toast',{detail:data.message}));
      if(data.favors)onFavor?.(data.favors);
      window.dispatchEvent(new CustomEvent('gptworld:world-encounter',{detail:data}));
      syncVisuals();
      if(action==='clear_resolved'){prompt.hidden=true;noticeEl.textContent='';}
    }catch(error){noticeEl.textContent=error.message;}
    finally{state.busy=false;paintPrompt();}
  }

  function interact(kind){
    if(kind==='clue')act('find_clue');
    else if(state.encounter?.status==='engaged'){prompt.hidden=false;paintPrompt();}
    else act('engage');
  }

  // Periodic exploration scan while traveling — never traps the player.
  const tick=async()=>{
    if(!gameReady()||state.busy){paintBeacon();paintPrompt();return;}
    const enc=state.encounter;
    if(!enc||enc.status==='resolved')await reload({scan:true});
    else{paintBeacon();paintPrompt();}
  };
  const timer=setInterval(tick,ENCOUNTER_SCAN_MS);
  const uiTimer=setInterval(()=>{paintBeacon();paintPrompt();},700);
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearInterval(uiTimer);},{once:true});
  window.addEventListener('focus',()=>reload());

  // Initial quiet load without forcing a spawn until the player is in-world briefly.
  setTimeout(()=>reload(),1800);

  const apiSurface={
    reload,interact,act,
    get encounter(){return state.encounter;},
    get favors(){return state.favors;},
    debugMove(x,z){player.position.x=Number(x);player.position.z=Number(z);paintBeacon();paintPrompt();}
  };
  window.__gptworldEncounters=apiSurface;
  return apiSurface;
}
