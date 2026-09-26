/** Living Town — Community Projects + demand board for the public settlement. */
const TOWN_API='/.netlify/functions/town-projects';
const CLIENT_KEY='gptworld-client-id';
const GAME_KEY='gptworld-day1';

let panel=null,data=null,busy=false,lastNear=false;

function readGame(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{};}catch{return{};}}
function clientId(){return localStorage.getItem(CLIENT_KEY)||'';}
function toast(message){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=message;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3400);
}
function nearCouncil(){
  const g=readGame();
  return Math.hypot(Number(g.x||0)+6,Number(g.z||0)-5)<5.2;
}
function idem(action){
  return `${action}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
function resourceLabel(key){
  return({wood:'Wood',stone:'Stone',herbs:'Herbs',coins:'Coins',iron:'Iron fittings',tools:'Tools',furniture:'Furniture',rations:'Rations'})[key]||key;
}
function ensurePanel(){
  if(panel)return panel;
  panel=document.createElement('section');
  panel.id='livingTownPanel';
  panel.setAttribute('aria-label','Community town project');
  Object.assign(panel.style,{
    position:'fixed',left:'50%',bottom:'max(150px, calc(env(safe-area-inset-bottom) + 138px))',
    transform:'translateX(-50%)',zIndex:'26',display:'none',width:'min(94vw,440px)',
    padding:'12px 14px',borderRadius:'14px',background:'rgba(18,27,21,.95)',color:'#f5eddc',
    boxShadow:'0 10px 30px rgba(0,0,0,.32)',fontFamily:'system-ui,sans-serif',maxHeight:'42vh',overflow:'auto'
  });
  panel.innerHTML=`
    <div style="font-size:11px;letter-spacing:.12em;opacity:.72">COMMUNITY TOWN PROJECT</div>
    <strong id="ltTitle" style="display:block;margin:4px 0 6px">Loading…</strong>
    <div id="ltSummary" style="font-size:13px;opacity:.86;line-height:1.35;margin-bottom:8px"></div>
    <div id="ltProgress" style="height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-bottom:8px"><span style="display:block;height:100%;width:0;background:linear-gradient(90deg,#8fad6d,#d2b36a)"></span></div>
    <div id="ltPercent" style="font-size:12px;margin-bottom:8px;opacity:.8"></div>
    <div id="ltReqs" style="display:grid;gap:6px;margin-bottom:8px"></div>
    <div id="ltPlayer" style="font-size:12px;opacity:.78;margin-bottom:8px"></div>
    <div id="ltActions" style="display:flex;flex-wrap:wrap;gap:7px"></div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="./town.html" style="color:#e6c68c;font-size:13px;font-weight:700">Town board →</a>
      <button id="ltHistory" type="button" style="border:0;border-radius:9px;padding:8px 10px;background:#3d4a3a;color:#f3efe5;font-weight:700;cursor:pointer">Town history</button>
    </div>
    <div id="ltHistoryBox" hidden style="margin-top:8px;font-size:12px;line-height:1.4;opacity:.9"></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('#ltHistory').addEventListener('click',()=>{
    const box=panel.querySelector('#ltHistoryBox');
    if(!data?.history?.length){box.hidden=false;box.textContent='No town milestones recorded yet.';return;}
    box.hidden=!box.hidden;
    if(!box.hidden){
      box.innerHTML=data.history.slice(0,8).map(entry=>`<div style="margin:0 0 7px"><strong>${entry.title}</strong><div>${entry.summary}</div><small>${entry.gameDay!=null?`Day ${entry.gameDay} · `:''}${new Date(entry.createdAt).toLocaleDateString?.()||''}</small></div>`).join('');
    }
  });
  return panel;
}
function render(){
  ensurePanel();
  const project=data?.activeProject;
  const title=panel.querySelector('#ltTitle');
  const summary=panel.querySelector('#ltSummary');
  const percent=panel.querySelector('#ltPercent');
  const bar=panel.querySelector('#ltProgress span');
  const reqs=panel.querySelector('#ltReqs');
  const player=panel.querySelector('#ltPlayer');
  const actions=panel.querySelector('#ltActions');
  if(!project){
    title.textContent='All listed community projects complete';
    summary.textContent=data?.unlocks?.length?`Unlocked: ${data.unlocks.join(', ')}`:'Contribute from town.html when the next project opens.';
    bar.style.width='100%';
    percent.textContent='100%';
    reqs.replaceChildren();
    actions.replaceChildren();
    player.textContent='';
    return;
  }
  title.textContent=project.name;
  summary.textContent=project.summary;
  bar.style.width=`${Math.min(100,project.percent||0)}%`;
  percent.textContent=`${project.percent}% complete`;
  const inv=data.inventory||{};
  reqs.replaceChildren(...Object.keys(project.required||{}).map(key=>{
    const need=Number(project.required[key]||0);
    const have=Number(project.contributed?.[key]||0);
    const left=Math.max(0,need-have);
    const row=document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05)';
    row.innerHTML=`<span>${resourceLabel(key)}</span><strong>${have}/${need}${left?` · ${left} left`:''}</strong>`;
    return row;
  }));
  player.textContent=project.playerTotal?`Your contribution: ${Object.entries(project.playerContribution||{}).map(([k,v])=>`${v} ${resourceLabel(k)}`).join(', ')}`:'You have not contributed yet.';
  actions.replaceChildren();
  for(const [key,left] of Object.entries(project.remaining||{})){
    if(left<=0)continue;
    const amounts=[1,Math.min(5,left),Math.min(10,left)].filter((n,i,arr)=>n>0&&arr.indexOf(n)===i);
    for(const amount of amounts){
      const btn=document.createElement('button');
      btn.type='button';
      const canPay=['wood','stone','herbs','coins'].includes(key)?Number(inv[key]||0)>=amount:true;
      btn.disabled=busy||!clientId()||!canPay;
      btn.textContent=`Contribute ${amount} ${resourceLabel(key)}`;
      Object.assign(btn.style,{border:'0',borderRadius:'9px',padding:'9px 11px',background:canPay?'#d2b36a':'#5a6356',color:'#17130b',fontWeight:'800',cursor:btn.disabled?'not-allowed':'pointer',minHeight:'42px'});
      btn.addEventListener('click',()=>contribute(project.key,key,amount));
      actions.append(btn);
    }
  }
}
async function refresh(){
  try{
    const id=clientId();
    const response=await fetch(`${TOWN_API}?clientId=${encodeURIComponent(id)}`,{cache:'no-store'});
    const json=await response.json();
    if(json.ok){data=json;render();}
  }catch{/* offline */}
}
async function contribute(projectKey,resource,amount){
  if(busy)return;
  const id=clientId();
  if(!id){toast('Enter the world before contributing.');return;}
  busy=true;render();
  try{
    const response=await fetch(TOWN_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:id,action:'contribute',projectKey,resource,amount,idempotencyKey:idem('contribute')})});
    const json=await response.json();
    if(!json.ok){
      toast(json.error==='not_enough_materials'?'Not enough materials.':json.error==='project_already_complete'?'That project is already complete.':`Could not contribute (${json.error||'error'}).`);
      await refresh();
      return;
    }
    data={...data,...json,inventory:json.inventory||data.inventory};
    if(json.complete)toast(`${json.projectKey} completed! The town remembers this.`);
    else toast(`Contributed ${json.amount} ${resourceLabel(json.resource)}.`);
    if(json.inventory){
      const game=readGame();
      game.inventory={...(game.inventory||{}),...json.inventory};
      localStorage.setItem(GAME_KEY,JSON.stringify(game));
      window.dispatchEvent(new CustomEvent('gptworld:inventory-state',{detail:game.inventory}));
      for(const [k,elId] of Object.entries({wood:'woodCount',stone:'stoneCount',herbs:'herbCount',coins:'coinCount'})){
        const el=document.getElementById(elId);
        if(el&&json.inventory[k]!=null)el.textContent=String(json.inventory[k]);
      }
    }
    render();
  }catch{
    toast('The town board could not reach the shared world.');
  }finally{
    busy=false;render();
  }
}
function tick(){
  ensurePanel();
  const welcome=document.getElementById('welcome');
  const near=!welcome||welcome.hidden?nearCouncil():false;
  panel.style.display=near?'block':'none';
  if(near&&!lastNear)refresh();
  lastNear=near;
}
ensurePanel();
setInterval(tick,450);
setInterval(refresh,20000);
window.addEventListener('focus',refresh);
refresh();
