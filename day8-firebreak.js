(function(){
const API='/.netlify/functions/world-v2';
const GAME_KEY='gptworld-day1';
const CLIENT_KEY='gptworld-client-id';
const DEFAULT={wood:0,stone:0,woodGoal:6,stoneGoal:24,complete:false};
let state={...DEFAULT},day=0,busy=false,lastFetch=0;

function game(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}
function clientId(){return localStorage.getItem(CLIENT_KEY)||''}
function nearFirebreak(g){
  const x=Number(g.x),z=Number(g.z);
  return Number.isFinite(x)&&Number.isFinite(z)&&x<=-26&&z>=5&&z<=16;
}
function ensureUI(){
  if(document.getElementById('firebreakProject'))return;
  const panel=document.createElement('section');
  panel.id='firebreakProject';
  panel.style.cssText='position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:35;background:rgba(30,27,22,.96);color:#f5f0df;border:1px solid rgba(210,179,106,.5);border-radius:14px;padding:14px 16px;width:min(92vw,440px);box-shadow:0 12px 32px rgba(0,0,0,.38);display:none;font-family:system-ui,sans-serif';
  panel.innerHTML=`
    <div style="font-size:12px;letter-spacing:.12em;opacity:.72">DAY 8 · SHARED PROJECT</div>
    <div style="font-size:20px;font-weight:800;margin-top:2px">The Western Firebreak</div>
    <div id="firebreakStatus" style="margin:8px 0 10px;line-height:1.4"></div>
    <div id="firebreakButtons" style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="firebreakWood" type="button">Give up to 3 wood</button>
      <button id="firebreakStone" type="button">Give up to 8 stone</button>
    </div>
    <div id="firebreakHint" style="font-size:12px;opacity:.72;margin-top:8px">Repeated wildfire has reached the timber line. Mark and clear a defensive strip before further expansion.</div>`;
  document.body.appendChild(panel);
  for(const id of ['firebreakWood','firebreakStone']){
    const b=document.getElementById(id);
    b.style.cssText='background:#d9c896;color:#17231a;border:0;border-radius:9px;padding:9px 11px;font-weight:800;cursor:pointer;touch-action:manipulation';
  }
  document.getElementById('firebreakWood').addEventListener('click',()=>contribute(3,0));
  document.getElementById('firebreakStone').addEventListener('click',()=>contribute(0,8));
}
function toast(message){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);
}
function render(){
  ensureUI();
  const panel=document.getElementById('firebreakProject');
  const g=game();
  if(day<8||!clientId()||!nearFirebreak(g)){panel.style.display='none';return}
  panel.style.display='block';
  const w=Math.min(Number(state.woodGoal||6),Number(state.wood||0));
  const s=Math.min(Number(state.stoneGoal||24),Number(state.stone||0));
  const status=document.getElementById('firebreakStatus');
  const buttons=document.getElementById('firebreakButtons');
  const hint=document.getElementById('firebreakHint');
  if(state.complete){
    status.textContent=`Complete · ${w}/${state.woodGoal||6} wood · ${s}/${state.stoneGoal||24} stone. The cleared line and cairns now remain in the shared world.`;
    buttons.style.display='none';
    hint.textContent='The timber line now carries a permanent defensive break built by travelers.';
  }else{
    status.textContent=`Shared progress: ${w}/${state.woodGoal||6} wood · ${s}/${state.stoneGoal||24} stone. Your pack: ${Number(g.inventory?.wood||0)} wood · ${Number(g.inventory?.stone||0)} stone.`;
    buttons.style.display='flex';
  }
}
async function refresh(){
  const id=clientId();if(!id||busy)return;
  const now=Date.now();if(now-lastFetch<2500)return;lastFetch=now;
  try{
    const r=await fetch(`${API}?clientId=${encodeURIComponent(id)}`,{cache:'no-store'});
    const data=await r.json();if(!data.ok)return;
    day=Number(data.world?.current_day?.day||0);
    state=data.world?.firebreak_project||state;
    render();
  }catch{}
}
async function contribute(wood,stone){
  const id=clientId(),g=game();if(!id||busy)return;
  const giveWood=Math.min(wood,Math.max(0,Number(g.inventory?.wood||0)));
  const giveStone=Math.min(stone,Math.max(0,Number(g.inventory?.stone||0)));
  if(giveWood+giveStone<1){toast('Gather more materials first.');return}
  busy=true;
  try{
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      clientId:id,name:g.playerName||'Traveler',x:g.x??0,z:g.z??12,
      action:'contribute_firebreak',wood:giveWood,stone:giveStone
    })});
    const data=await r.json();
    if(!data.ok){
      toast(data.error==='firebreak_out_of_range'?'Move closer to the timber line.':data.error==='not_enough_materials'?'Your saved inventory does not have enough material.':'The firebreak could not accept that contribution.');
      return;
    }
    state=data.firebreak||state;
    if(data.inventory){
      g.inventory={wood:Number(data.inventory.wood||0),stone:Number(data.inventory.stone||0),herbs:Number(data.inventory.herbs||0)};
      localStorage.setItem(GAME_KEY,JSON.stringify(g));
      const wc=document.getElementById('woodCount'),sc=document.getElementById('stoneCount'),hc=document.getElementById('herbCount');
      if(wc)wc.textContent=String(g.inventory.wood);if(sc)sc.textContent=String(g.inventory.stone);if(hc)hc.textContent=String(g.inventory.herbs);
    }
    toast(state.complete?'The Western Firebreak is complete.':`Contributed ${Number(data.contributed?.wood||0)} wood and ${Number(data.contributed?.stone||0)} stone.`);
    render();
  }catch{toast('The shared world is temporarily unreachable.')}
  finally{busy=false;lastFetch=0;setTimeout(refresh,150)}
}
ensureUI();
setInterval(()=>{render();refresh()},1000);
window.addEventListener('focus',()=>{lastFetch=0;refresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastFetch=0;refresh()}});

})();
