/**
 * Opportunities — optional collapsible “what could I do right now?” panel.
 * Suggestions come only from real world/player state (never invented quests).
 */
(function(){
  const KEY='gptworld-opportunities-v1';
  const CLIENT_KEY='gptworld-client-id';
  const GAME_KEY='gptworld-day1';
  let root=null,collapsed=false,town=null,living=null,lastRender=0;

  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{collapsed:false};}catch{return{collapsed:false};}}
  function save(state){localStorage.setItem(KEY,JSON.stringify(state));}
  function readGame(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{};}catch{return{};}}
  function clientId(){return localStorage.getItem(CLIENT_KEY)||'';}
  function demandTier(level){
    const n=Number(level||0);
    if(n>=85)return 'URGENT';
    if(n>=70)return 'HIGH';
    if(n>=40)return 'NORMAL';
    return 'LOW';
  }
  function ensureStyles(){
    if(document.getElementById('opportunitiesStyles'))return;
    const style=document.createElement('style');
    style.id='opportunitiesStyles';
    style.textContent=`
      #opportunitiesPanel{position:fixed;z-index:27;left:12px;top:max(72px,calc(env(safe-area-inset-top) + 58px));width:min(280px,calc(100vw - 24px));background:rgba(14,22,17,.92);color:#f3efe5;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.28);font:13px/1.35 system-ui,sans-serif;backdrop-filter:blur(10px);overflow:hidden}
      #opportunitiesPanel header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;cursor:pointer;user-select:none}
      #opportunitiesPanel header strong{font-size:12px;letter-spacing:.1em}
      #opportunitiesPanel header button{border:0;background:transparent;color:#e6c68c;font-weight:800;font-size:12px;padding:4px 6px;min-height:32px}
      #opportunitiesBody{padding:0 12px 12px;display:grid;gap:7px}
      #opportunitiesPanel.collapsed #opportunitiesBody{display:none}
      .opp-item{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06)}
      .opp-item small{display:block;opacity:.7;margin-top:3px;font-size:11px}
      @media(max-width:800px),(pointer:coarse){
        #opportunitiesPanel{left:10px;right:auto;top:max(58px,calc(env(safe-area-inset-top) + 48px));width:min(240px,calc(100vw - 120px));font-size:12px}
        #opportunitiesPanel header{padding:8px 10px}
        #opportunitiesBody{padding:0 10px 10px}
        .opp-item{padding:7px 8px;min-height:40px}
      }
    `;
    document.head.appendChild(style);
  }
  function ensureUI(){
    if(root)return root;
    ensureStyles();
    const state=load();
    collapsed=Boolean(state.collapsed);
    root=document.createElement('section');
    root.id='opportunitiesPanel';
    root.setAttribute('aria-label','Nearby opportunities');
    root.classList.toggle('collapsed',collapsed);
    root.innerHTML=`<header><strong>NEARBY</strong><button type="button" id="oppToggle" aria-expanded="${!collapsed}">${collapsed?'Show':'Hide'}</button></header><div id="opportunitiesBody"></div>`;
    document.body.appendChild(root);
    root.querySelector('#oppToggle').addEventListener('click',e=>{
      e.stopPropagation();
      collapsed=!collapsed;
      root.classList.toggle('collapsed',collapsed);
      const btn=root.querySelector('#oppToggle');
      btn.textContent=collapsed?'Show':'Hide';
      btn.setAttribute('aria-expanded',String(!collapsed));
      save({collapsed});
    });
    return root;
  }
  function tip(icon,title,detail,priority){
    return{icon,title,detail,priority};
  }
  function buildSuggestions(){
    const tips=[];
    const game=readGame();
    const inv=town?.inventory||game.inventory||{};
    const x=Number(game.x||0),z=Number(game.z||0);
    const nearCouncil=Math.hypot(x+6,z-5)<8;
    const nearGateway=Math.hypot(x-(-24),z-0)<10;
    const project=town?.activeProject;

    // 1) Immediate nearby interaction
    if(nearCouncil&&project){
      const remaining=project.remaining||{};
      const top=Object.entries(remaining).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
      if(top){
        tips.push(tip('🪵',`${project.name.replace(/^Build the |^Raise the |^Open the |^Expand the /i,'')}`,`${top[1]} ${top[0]} still needed.`,1));
      }else{
        tips.push(tip('🏘',project.name,'Community project is nearly done — contribute nearby.',1));
      }
    }
    if(nearGateway){
      tips.push(tip('🏠','Your land awaits','Cross the Personal World archway to farm, craft, and hunt.',1));
    }

    // Living event opportunity
    const ev=living?.event;
    if(ev?.key){
      const bias=ev.effects?.demandBias||{};
      const hot=Object.entries(bias).filter(([,d])=>Number(d)>0).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
      tips.push(tip('🌦',ev.name||'Living event',hot?`${hot[0]} demand is rising — ${ev.summary||'the valley has changed.'}`:(ev.summary||'Conditions have shifted.'),1));
    }

    // 2) Player pack / property cues from inventory
    if(Number(inv.wood||0)>=5&&!tips.some(t=>/lumber|wood/i.test(t.title+t.detail))){
      const woodDemand=Number(town?.demand?.wood||50);
      if(woodDemand>=70)tips.push(tip('🪙','Town pays well for wood',`Demand ${demandTier(woodDemand)} — sell or contribute lumber.`,2));
      else if(project?.remaining?.wood)tips.push(tip('🪵','Carry wood to the project',`${project.remaining.wood} lumber still needed.`,2));
    }

    // 3) Town demand / project opportunity
    if(project&&!nearCouncil){
      const left=Object.entries(project.remaining||{}).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
      if(left)tips.push(tip('🏗',project.name.replace(/^Build the |^Raise the |^Open the |^Expand the /i,''),`${left[1]} ${left[0]} still needed. Visit the council area.`,3));
    }
    const demand=town?.demand||{};
    const hotCat=Object.entries(demand).filter(([k,v])=>!['version','updatedAt','lastTick','activeEvent','tiers'].includes(k)&&Number(v)>=70)
      .sort((a,b)=>Number(b[1])-Number(a[1]))[0];
    if(hotCat&&!tips.some(t=>/DEMAND|pays well|demand/i.test(t.detail))){
      tips.push(tip('📈',`${hotCat[0].toUpperCase()} — ${demandTier(hotCat[1])} DEMAND`,'Merchants pay more for this right now.',3));
    }

    // First-minutes fallback when nothing else applies
    if(!tips.length){
      if(Number(inv.wood||0)+Number(inv.stone||0)+Number(inv.herbs||0)<1){
        tips.push(tip('🌲','Gather nearby','Look for trees, stone, or herbs — glowing nodes mark harvestables.',1));
      }else{
        tips.push(tip('🗺','Explore the settlement','Talk to townsfolk, check town demand, or visit your private land.',2));
      }
    }

    return tips.sort((a,b)=>a.priority-b.priority).slice(0,3);
  }
  function render(){
    const welcome=document.getElementById('welcome');
    if(welcome&&!welcome.hidden){if(root)root.style.display='none';return;}
    ensureUI();
    root.style.display='block';
    const body=root.querySelector('#opportunitiesBody');
    const tips=buildSuggestions();
    body.replaceChildren(...tips.map(item=>{
      const el=document.createElement('div');
      el.className='opp-item';
      el.innerHTML=`<div>${item.icon} ${item.title}</div>${item.detail?`<small>${item.detail}</small>`:''}`;
      return el;
    }));
    lastRender=Date.now();
  }
  function ingestTown(detail){town=detail||town;render();}
  function ingestLiving(detail){living=detail||living;render();}

  window.addEventListener('gptworld:living-town',e=>ingestTown(e.detail));
  window.addEventListener('gptworld:living-event',e=>ingestLiving({event:e.detail}));
  window.addEventListener('gptworld:inventory-state',()=>render());
  window.addEventListener('gptworld:npc-life',e=>{
    if(e.detail?.event)ingestLiving({event:e.detail.event});
  });

  let lastEventKey=null;
  function showEventBanner(event){
    if(!event?.key)return;
    if(event.key===lastEventKey)return;
    lastEventKey=event.key;
    let banner=document.getElementById('livingEventBanner');
    if(!banner){
      banner=document.createElement('aside');
      banner.id='livingEventBanner';
      Object.assign(banner.style,{
        position:'fixed',left:'50%',top:'max(58px, calc(env(safe-area-inset-top) + 48px))',
        transform:'translateX(-50%)',zIndex:'30',width:'min(92vw,360px)',
        padding:'12px 14px',borderRadius:'14px',background:'rgba(28,22,14,.96)',color:'#f5eddc',
        border:'1px solid rgba(210,179,106,.45)',boxShadow:'0 12px 32px rgba(0,0,0,.35)',
        font:'13px/1.4 system-ui,sans-serif'
      });
      document.body.appendChild(banner);
    }
    const brief=event.brief||null;
    const changed=(brief?.changed||[]).slice(0,2);
    const actions=(brief?.actions||[]).slice(0,1);
    banner.innerHTML=`<div style="font-size:11px;letter-spacing:.12em;opacity:.7">LIVING EVENT</div>
      <strong style="display:block;margin:4px 0 6px;font-size:16px">${event.name||event.key}</strong>
      <div>${event.summary||brief?.happened||''}</div>
      ${changed.map(line=>`<div style="margin-top:6px;opacity:.9">${line}</div>`).join('')}
      ${actions.map(line=>`<div style="margin-top:8px;color:#e6c68c;font-weight:700">${line}</div>`).join('')}
      <button type="button" style="margin-top:10px;border:0;border-radius:9px;padding:8px 12px;background:#3d4a3a;color:#f3efe5;font-weight:700;min-height:40px;cursor:pointer">Dismiss</button>`;
    banner.style.display='block';
    banner.querySelector('button')?.addEventListener('click',()=>{banner.style.display='none';});
    setTimeout(()=>{if(banner)banner.style.display='none';},14000);
  }

  // Prefer shared living-systems events over a second network poll.
  window.addEventListener('gptworld:living-event',e=>{
    if(e.detail){
      living={...(living||{}),event:e.detail,eventBrief:e.detail.brief||living?.eventBrief};
      showEventBanner(e.detail);
      render();
    }
  });
  window.addEventListener('gptworld:npc-life',e=>{
    if(e.detail)living={...(living||{}),npcs:e.detail};
  });
  window.addEventListener('gptworld:town-demand',e=>{
    if(e.detail){living={...(living||{}),demand:e.detail};render();}
  });

  async function refreshLiving(){
    // Fallback only when living-systems.js is not on the page.
    if(window.__gptworldLivingSystemsActive)return;
    try{
      const r=await fetch('/.netlify/functions/living-systems',{cache:'no-store'});
      const d=await r.json();
      if(d.ok){
        living=d;
        window.dispatchEvent(new CustomEvent('gptworld:npc-life',{detail:{...(d.npcs||{}),event:d.event}}));
        const brief=d.eventBrief||null;window.dispatchEvent(new CustomEvent('gptworld:living-event',{detail:d.event?{...d.event,brief}:null}));if(d.event)showEventBanner({...d.event,brief});
        if(d.demand)window.dispatchEvent(new CustomEvent('gptworld:town-demand',{detail:d.demand}));
        render();
      }
    }catch{/* offline */}
  }

  setTimeout(()=>{ensureUI();render();refreshLiving();},1500);
  setInterval(()=>{if(Date.now()-lastRender>8000)render();},8000);
  setInterval(refreshLiving,90000);
  window.addEventListener('focus',()=>{refreshLiving();render();});
})();
