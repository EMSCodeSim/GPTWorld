/**
 * GPTWorld progression UI: milestones, property level, field journal,
 * discoveries, cart controls, and While You Were Away summary.
 * Mobile-first; panels stay clear of joystick/action controls.
 */
(function(){
  const API='/.netlify/functions/progression';
  const CLIENT_KEY='gptworld-client-id';
  const AWAY_KEY='gptworld-away-dismissed';
  let state=null;
  let busy=false;

  function clientId(){return localStorage.getItem(CLIENT_KEY)||'';}
  function requestKey(action){return `${action}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}

  function ensureStyles(){
    if(document.getElementById('progressionStyles'))return;
    const style=document.createElement('style');
    style.id='progressionStyles';
    style.textContent=`
      #progressionDock{position:fixed;left:10px;top:max(118px,calc(env(safe-area-inset-top)+96px));z-index:26;display:flex;flex-direction:column;gap:6px;pointer-events:none}
      #progressionDock button{pointer-events:auto;min-height:40px;border:1px solid rgba(210,179,106,.45);border-radius:12px;background:rgba(14,22,17,.92);color:#f3efe5;font:700 12px/1.2 system-ui,sans-serif;padding:8px 10px;touch-action:manipulation}
      .prog-panel{position:fixed;inset:0;z-index:1002;display:none;background:rgba(6,13,9,.84);padding:max(14px,env(safe-area-inset-top)) 12px max(14px,env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch;touch-action:manipulation}
      .prog-panel.open{display:block}
      .prog-card{width:min(520px,100%);margin:0 auto;background:rgba(19,35,24,.99);border:1px solid rgba(210,179,106,.55);border-radius:18px;padding:14px;color:#f3ead5}
      .prog-card header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .prog-card header button{border:0;background:transparent;color:#f4e3b9;font-size:30px;line-height:1;min-height:44px;min-width:44px;touch-action:manipulation}
      .prog-card h2,.prog-card h3{margin:4px 0 8px}
      .prog-muted{color:#b8c6b8;font-size:13px;line-height:1.35}
      .prog-list{display:grid;gap:8px;margin:10px 0}
      .prog-item{background:#263c2b;border-radius:11px;padding:10px 12px;border:1px solid transparent}
      .prog-item.done{border-color:rgba(210,179,106,.45)}
      .prog-item strong{display:block}
      .prog-item small{display:block;color:#b8c6b8;margin-top:3px}
      .prog-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}
      .prog-tabs button{min-height:36px;border:1px solid #526653;border-radius:999px;background:#28402e;color:#f3ead5;font-weight:700;padding:6px 10px;font-size:12px;touch-action:manipulation}
      .prog-tabs button.active{background:#d2b36a;border-color:#d2b36a;color:#17231a}
      .prog-check{display:grid;gap:4px;margin:8px 0;font-size:13px}
      .prog-away{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top)+58px));transform:translateX(-50%);z-index:1100;width:min(340px,calc(100vw - 24px));background:rgba(14,22,17,.95);border:1px solid rgba(210,179,106,.5);border-radius:14px;padding:12px 14px;color:#f3efe5;box-shadow:0 12px 28px rgba(0,0,0,.35);pointer-events:auto}
      .prog-away ul{margin:8px 0 10px;padding-left:18px}
      .prog-away button{width:100%;min-height:44px;border:0;border-radius:10px;background:#3d4a3a;color:#f3efe5;font-weight:800;touch-action:manipulation;cursor:pointer}
      .prog-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .prog-actions button{min-height:44px;border:0;border-radius:10px;background:#d2b36a;color:#17231a;font-weight:800;touch-action:manipulation}
      .prog-actions button.secondary{background:#28402e;color:#f3ead5;border:1px solid #526653}
      @media(max-width:800px){#progressionDock{left:8px;top:max(108px,calc(env(safe-area-inset-top)+88px))}.prog-card{border-radius:16px;padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function ensureChrome(){
    ensureStyles();
    if(!document.getElementById('progressionDock')){
      const dock=document.createElement('div');
      dock.id='progressionDock';
      dock.innerHTML=`<button type="button" id="openProgression">Homestead</button><button type="button" id="openFieldJournal">Journal</button>`;
      document.body.appendChild(dock);
      dock.querySelector('#openProgression').addEventListener('click',()=>openPanel('milestones'));
      dock.querySelector('#openFieldJournal').addEventListener('click',()=>openPanel('journal'));
    }
    if(!document.getElementById('progressionPanel')){
      const panel=document.createElement('section');
      panel.id='progressionPanel';
      panel.className='prog-panel';
      panel.innerHTML=`<div class="prog-card"><header><div><div class="prog-muted">LONG-TERM PROGRESS</div><h2 id="progTitle">Homestead</h2></div><button type="button" id="closeProgression" aria-label="Close">×</button></header><div class="prog-tabs"><button type="button" data-tab="milestones" class="active">Milestones</button><button type="button" data-tab="property">Property</button><button type="button" data-tab="journal">Journal</button><button type="button" data-tab="cart">Cart</button><button type="button" data-tab="profile">Profile</button></div><div id="progBody"></div></div>`;
      document.body.appendChild(panel);
      panel.querySelector('#closeProgression').addEventListener('click',()=>panel.classList.remove('open'));
      panel.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
        panel.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
        renderTab(btn.dataset.tab);
      }));
    }
  }

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  async function loadProgression(force=false){
    const id=clientId();
    if(!id)return null;
    if(state&&!force)return state;
    try{
      const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:id,action:'status'})});
      const data=await response.json();
      if(!data.ok)return null;
      state=data;
      window.dispatchEvent(new CustomEvent('gptworld:progression',{detail:data}));
      return data;
    }catch{return null;}
  }

  function showAwaySummary(lines){
    if(!lines?.length)return;
    const fingerprint=lines.join('|');
    if(sessionStorage.getItem(AWAY_KEY)===fingerprint)return;
    let box=document.getElementById('whileAwayBox');
    if(!box){
      box=document.createElement('aside');
      box.id='whileAwayBox';
      box.className='prog-away';
      document.body.appendChild(box);
    }
    box.innerHTML=`<strong>While you were away</strong><ul>${lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul><button type="button">Continue</button>`;
    box.querySelector('button').onclick=()=>{
      sessionStorage.setItem(AWAY_KEY,fingerprint);
      box.remove();
    };
  }

  function renderMilestones(body){
    const milestones=state?.milestones||[];
    const property=state?.property;
    body.innerHTML=`
      <div class="prog-muted">Homestead Level: <strong>${esc(property?.name||'Wilderness Camp')}</strong></div>
      <p class="prog-muted">${esc(property?.nextHint||'')}</p>
      <div class="prog-list">${milestones.map(m=>`
        <div class="prog-item${m.complete?' done':''}">
          <strong>${m.complete?'✓ ':''}${esc(m.name)}</strong>
          <small>${esc(m.summary)}</small>
        </div>`).join('')}</div>`;
  }

  function renderProperty(body){
    const property=state?.property||{checklist:[],name:'Wilderness Camp'};
    const upgrades=state?.structureUpgrades||{};
    body.innerHTML=`
      <h3>${esc(property.name)}</h3>
      <p class="prog-muted">${esc(property.summary||'')}</p>
      <div class="prog-check">${(property.checklist||[]).map(item=>`<div>${item.met?'✓':'○'} ${esc(item.label)}</div>`).join('')}</div>
      <p class="prog-muted">${esc(property.nextHint||'')}</p>
      <h3>Structure tiers</h3>
      <div class="prog-list">
        <div class="prog-item"><strong>Shelter</strong><small>${esc(upgrades.shelter?.name||'Lean-to')}</small></div>
        <div class="prog-item"><strong>Storage</strong><small>${esc(upgrades.storage?.name||'Crate')}</small></div>
        <div class="prog-item"><strong>Workshop</strong><small>${esc(upgrades.workshop?.name||'Work Bench')}</small></div>
        <div class="prog-item"><strong>Farm</strong><small>${esc(upgrades.farm?.name||'Basic Plot')}</small></div>
      </div>
      <div class="prog-actions"><button type="button" id="upgradeShelter">Upgrade Shelter</button><button type="button" id="upgradeFarm" class="secondary">Upgrade Farm</button></div>`;
    body.querySelector('#upgradeShelter')?.addEventListener('click',()=>doUpgrade('shelter'));
    body.querySelector('#upgradeFarm')?.addEventListener('click',()=>doUpgrade('farm'));
  }

  function renderJournal(body){
    const journal=state?.journal||{};
    const discoveries=state?.discoveries||[];
    const sections=[
      ['Animals',journal.animals||[]],
      ['Plants',journal.plants||[]],
      ['Locations',journal.locations||[]],
      ['Weather',journal.weatherEvents||[]],
      ['Rare discoveries',journal.rareDiscoveries||[]],
      ['Crafting knowledge',journal.craftingKnowledge||[]]
    ];
    body.innerHTML=`
      <p class="prog-muted">Records appear only after you observe or discover them.</p>
      ${(state?.season?`<div class="prog-item"><strong>${esc(state.season.note?Object.keys({Spring:1,Summer:1,Autumn:1,Winter:1}).find(k=>state.season.note)||'Season':'Season')}</strong><small>${esc(state.season.note||'')}</small></div>`:'')}
      ${state?.timeOfDay?`<div class="prog-item"><strong>${esc(state.timeOfDay.period)}</strong><small>${esc(state.timeOfDay.note||'')}</small></div>`:''}
      ${state?.weather?`<div class="prog-item"><strong>Weather strategy</strong><small>${esc(state.weather.note||state.weather.condition||'')}</small></div>`:''}
      <h3>Nearby discoveries</h3>
      <div class="prog-list">${discoveries.length?discoveries.map(d=>`
        <div class="prog-item${d.found?' done':''}">
          <strong>${d.found?'Found: ':''}${esc(d.name)}</strong>
          <small>${d.found?esc(d.summary||'Recorded in your journal.'):'Explore the land to uncover this.'}</small>
          ${d.found?'':`<button type="button" data-find="${esc(d.id)}" style="margin-top:8px;min-height:40px;width:100%;border:0;border-radius:9px;background:#3d4a3a;color:#f3efe5;font-weight:700">Investigate</button>`}
        </div>`).join(''):'<div class="prog-muted">No rare sites seeded yet.</div>'}</div>
      ${sections.map(([title,rows])=>`
        <h3>${esc(title)}</h3>
        <div class="prog-list">${rows.length?rows.slice(0,12).map(row=>`
          <div class="prog-item">
            <strong>${esc(row.name||row.key||title)}</strong>
            <small>${esc(row.knownBehavior||row.note||row.lore||row.summary||(row.observed?`Observed ${row.observed} times`:'Recorded'))}${row.tracksIdentified?' · Tracks identified':''}${row.successfullyHunted?' · Successfully hunted':''}</small>
          </div>`).join(''):'<div class="prog-muted">Nothing recorded yet.</div>'}</div>`).join('')}`;
    body.querySelectorAll('[data-find]').forEach(btn=>btn.addEventListener('click',()=>findDiscovery(btn.dataset.find)));
  }

  function renderCart(body){
    const transport=state?.transport||{name:'Backpack',capacity:40,load:0,remaining:40,speedMod:1};
    const cart=state?.cart||{wood:0,stone:0,herbs:0};
    const unlocks=(state?.advancedUnlocks||[]).filter(u=>u.kind==='transport'||u.key==='hand-cart');
    body.innerHTML=`
      <h3>${esc(transport.name)}</h3>
      <p class="prog-muted">Capacity ${transport.load}/${transport.capacity}${transport.heavilyLoaded?' · heavily loaded (slower)':''}</p>
      <div class="prog-list">
        <div class="prog-item"><strong>Cart cargo</strong><small>Wood ${cart.wood||0} · Stone ${cart.stone||0} · Herbs ${cart.herbs||0}</small></div>
        ${unlocks.map(u=>`<div class="prog-item${u.unlocked?' done':''}"><strong>${esc(u.name)}</strong><small>${u.unlocked?'Unlocked':'Needs Carpentry '+u.level}</small></div>`).join('')}
      </div>
      <div class="prog-actions">
        <button type="button" data-cart="wood">Wood → Cart</button>
        <button type="button" data-cart="stone">Stone → Cart</button>
        <button type="button" data-cart="herbs" class="secondary">Herbs → Cart</button>
        <button type="button" data-uncart="wood" class="secondary">Unload Wood</button>
      </div>
      <p class="prog-muted">Use the cart to haul bulk materials for Community Projects. Movement slows slightly when heavily loaded.</p>`;
    body.querySelectorAll('[data-cart]').forEach(btn=>btn.addEventListener('click',()=>cartTransfer(btn.dataset.cart,'to_cart')));
    body.querySelectorAll('[data-uncart]').forEach(btn=>btn.addEventListener('click',()=>cartTransfer(btn.dataset.uncart,'from_cart')));
  }

  function renderProfile(body){
    const profile=state?.profile||{};
    const identity=state?.townIdentity;
    const hooks=state?.regionalHooks||[];
    body.innerHTML=`
      <h3>${esc(profile.name||'Traveler')}</h3>
      <div class="prog-muted">${esc(profile.homesteadLevel||'Wilderness Camp')}</div>
      <h3>Strongest skills</h3>
      <div class="prog-list">${(profile.strongestSkills||[]).map(s=>`<div class="prog-item"><strong>${esc(s.name)}</strong><small>${esc(s.value)}</small></div>`).join('')||'<div class="prog-muted">Skills grow through use.</div>'}</div>
      <h3>Known for</h3>
      <p>${esc((profile.knownFor||[]).join(' · ')||profile.primary||'Traveler')}</p>
      ${identity?`<h3>Town identity</h3><div class="prog-item"><strong>${esc(identity.name)}</strong><small>${esc(identity.explanation||'')}</small></div>`:''}
      <h3>Regional hooks</h3>
      <div class="prog-list">${hooks.filter(h=>h.known).map(h=>`<div class="prog-item"><strong>${esc(h.name)}</strong><small>${esc(h.tease||h.summary)}</small></div>`).join('')}</div>`;
  }

  function renderTab(tab){
    const body=document.getElementById('progBody');
    const title=document.getElementById('progTitle');
    if(!body||!state){if(body)body.innerHTML='<div class="prog-muted">Loading progression…</div>';return;}
    const labels={milestones:'Milestones',property:'Property',journal:'Field Journal',cart:'Transport',profile:'Profile'};
    if(title)title.textContent=labels[tab]||'Homestead';
    if(tab==='milestones')renderMilestones(body);
    else if(tab==='property')renderProperty(body);
    else if(tab==='journal')renderJournal(body);
    else if(tab==='cart')renderCart(body);
    else renderProfile(body);
  }

  async function openPanel(tab){
    ensureChrome();
    const panel=document.getElementById('progressionPanel');
    panel.classList.add('open');
    panel.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(!state)await loadProgression(true);
    renderTab(tab);
  }

  async function doUpgrade(family){
    if(busy)return;busy=true;
    try{
      const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:clientId(),action:'upgrade_structure',family,idempotencyKey:requestKey('upgrade')})});
      const data=await response.json();
      if(!data.ok){toast(data.error==='skill_locked'?`Need higher skill (${data.skill} ${data.need}).`:data.error==='missing_materials'?`Need more ${data.resource}.`:data.error||'Upgrade failed');return;}
      toast(`${data.upgrade?.name||'Upgrade'} ready.`);
      await loadProgression(true);
      renderTab('property');
      window.dispatchEvent(new CustomEvent('gptworld:structure-upgraded',{detail:data}));
    }finally{busy=false;}
  }

  async function findDiscovery(discoveryId){
    if(busy)return;busy=true;
    try{
      const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:clientId(),action:'find_discovery',discoveryId,idempotencyKey:requestKey('discover')})});
      const data=await response.json();
      if(!data.ok){toast(data.error==='already_found'?'Already recorded.':data.error||'Could not investigate');return;}
      toast(data.message||'Discovery recorded.');
      await loadProgression(true);
      renderTab('journal');
      window.dispatchEvent(new CustomEvent('gptworld:discovery',{detail:data}));
    }finally{busy=false;}
  }

  async function cartTransfer(resource,direction){
    if(busy)return;busy=true;
    try{
      const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:clientId(),action:'cart_transfer',resource,direction,amount:5,idempotencyKey:requestKey('cart')})});
      const data=await response.json();
      if(!data.ok){toast(data.error==='cart_required'?'Craft a Hand Cart (Carpentry 60) first.':data.error||'Cart transfer failed');return;}
      state={...state,cart:data.cart,transport:data.transport};
      if(data.inventory)window.dispatchEvent(new CustomEvent('gptworld:inventory-state',{detail:data.inventory}));
      renderTab('cart');
      toast(direction==='to_cart'?`Loaded 5 ${resource} into cart.`:`Unloaded 5 ${resource}.`);
    }finally{busy=false;}
  }

  function toast(message){
    const el=document.getElementById('toast');
    if(!el){console.log(message);return;}
    el.textContent=message;el.classList.add('show');
    clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),3200);
  }

  async function boot(){
    ensureChrome();
    const data=await loadProgression(true);
    if(!data)return;
    if(data.whileYouWereAway?.length)showAwaySummary(data.whileYouWereAway);
    if(data.newlyEarned?.length)toast(`Milestone: ${data.newlyEarned[0].name}`);
    if(data.moment)toast(data.moment.summary);
  }

  window.GPTWorldProgression={loadProgression,openPanel,findDiscovery,getState:()=>state};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  window.addEventListener('focus',()=>loadProgression(true));
})();
