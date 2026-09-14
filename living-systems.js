const LIVING_API='/.netlify/functions/living-systems';
let livingState=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function ensureWeatherLayer(){
  if(document.getElementById('livingWeather'))return;
  const layer=document.createElement('div');
  layer.id='livingWeather';
  layer.style.cssText='position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden;transition:background .8s ease,opacity .8s ease';
  document.body.appendChild(layer);
}

function renderWeather(w){
  ensureWeatherLayer();
  const layer=document.getElementById('livingWeather');
  const cond=String(w?.condition||'clear');
  layer.className=`weather-${cond}`;
  if(cond==='clear')layer.style.background='linear-gradient(rgba(255,214,130,.06),transparent 45%)';
  if(cond==='cloudy')layer.style.background='rgba(80,95,100,.13)';
  if(cond==='fog')layer.style.background='linear-gradient(rgba(225,235,230,.33),rgba(190,205,200,.22))';
  if(cond==='rain')layer.style.background='repeating-linear-gradient(105deg,transparent 0 18px,rgba(185,215,230,.18) 19px 20px)';
  if(cond==='storm')layer.style.background='repeating-linear-gradient(105deg,rgba(35,45,55,.2) 0 16px,rgba(190,220,235,.22) 17px 19px)';
  layer.style.opacity=cond==='fog'?'.9':cond==='storm'?'.75':'.65';
  document.documentElement.style.setProperty('--living-weather',cond);
}

function ensurePulse(){
  if(document.getElementById('livingPulse'))return;
  const panel=document.createElement('section');
  panel.id='livingPulse';
  panel.style.cssText='position:fixed;left:18px;top:78px;z-index:20;width:min(310px,calc(100vw - 36px));background:rgba(14,22,17,.9);color:#f3efe5;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 13px;box-shadow:0 10px 30px rgba(0,0,0,.24);font:13px system-ui,sans-serif;backdrop-filter:blur(12px)';
  panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Living World</strong><button id="livingPulseToggle" type="button" style="border:0;border-radius:8px;padding:5px 8px;background:rgba(255,255,255,.08);color:#ddd">Hide</button></div><div id="livingPulseBody" style="margin-top:9px"></div>';
  document.body.appendChild(panel);
  let open=true;
  document.getElementById('livingPulseToggle')?.addEventListener('click',()=>{open=!open;document.getElementById('livingPulseBody').style.display=open?'block':'none';document.getElementById('livingPulseToggle').textContent=open?'Hide':'Show';});
}

function renderPulse(data){
  ensurePulse();
  const body=document.getElementById('livingPulseBody');
  if(!body)return;
  const w=data.weather||{},n=data.needs||{},r=data.npcs?.routines||{};
  const npcRows=Object.entries(r).map(([name,v])=>`<div style="padding:5px 0;border-top:1px solid rgba(255,255,255,.07)"><strong>${esc(name)}</strong><div style="opacity:.72">${esc(v.activity)} · ${esc(v.location)}</div></div>`).join('');
  body.innerHTML=`<div><strong>Weather:</strong> ${esc(w.condition||'clear')} · ${Number(w.temperatureC||0).toFixed(1)}°C · wind ${Number(w.windKph||0).toFixed(0)} km/h</div><div style="margin-top:5px"><strong>Settlement:</strong> ${esc(n.status||'stable')} · supply ${Number(n.score||0)}/100</div><div style="margin-top:5px;opacity:.72">Needs consume shared supplies every 6 hours.</div><div style="margin-top:9px;font-size:11px;letter-spacing:.1em;opacity:.58">NPC ROUTINES</div>${npcRows}`;
}

function emitNPCState(data){
  window.dispatchEvent(new CustomEvent('gptworld:npc-life',{detail:data.npcs||{}}));
}

async function refreshLiving(){
  try{
    const r=await fetch(LIVING_API,{cache:'no-store'});
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'living systems unavailable');
    livingState=data;
    renderWeather(data.weather);
    renderPulse(data);
    emitNPCState(data);
  }catch(err){console.error('Living systems load failed',err)}
}

refreshLiving();
setInterval(refreshLiving,60000);
window.addEventListener('focus',refreshLiving);
