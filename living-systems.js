const LIVING_API='/.netlify/functions/living-systems';
const GAME_KEY='gptworld-day1';
let livingState=null;
let travelTimer=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gameState(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}

function ensureWeatherLayer(){
  if(document.getElementById('livingWeather'))return;
  const layer=document.createElement('div');
  layer.id='livingWeather';
  layer.style.cssText='position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden;transition:background .8s ease,opacity .8s ease';
  document.body.appendChild(layer);
}

function ensureAgingLayer(){
  if(document.getElementById('worldAgingLayer'))return;
  const layer=document.createElement('div');
  layer.id='worldAgingLayer';
  layer.style.cssText='position:fixed;inset:0;z-index:3;pointer-events:none;transition:opacity 1.2s ease,background 1.2s ease;mix-blend-mode:multiply';
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

function renderAging(a={}){
  ensureAgingLayer();
  const patina=Math.max(0,Math.min(1,Number(a.structurePatina||0)));
  const trail=Math.max(0,Math.min(1,Number(a.trailStrength||0)));
  const regrowth=Math.max(0,Math.min(1,Number(a.forestRegrowth||0)));
  const deterioration=Math.max(0,Math.min(1,Number(a.deterioration||0)));
  const layer=document.getElementById('worldAgingLayer');
  layer.style.opacity=String(Math.min(.5,.08+patina*.18+trail*.16));
  layer.style.background=`radial-gradient(ellipse at 50% 76%, rgba(116,91,55,${(.12+trail*.24).toFixed(3)}) 0 8%, transparent 28%),radial-gradient(circle at 8% 72%, rgba(45,91,48,${(.08+regrowth*.22).toFixed(3)}) 0 8%, transparent 30%),radial-gradient(circle at 92% 70%, rgba(45,91,48,${(.08+regrowth*.22).toFixed(3)}) 0 8%, transparent 30%),repeating-linear-gradient(12deg,transparent 0 35px,rgba(76,57,34,${(.015+trail*.045).toFixed(3)}) 36px 38px)`;
  const canvas=document.querySelector('#world canvas');
  if(canvas){canvas.style.transition='filter 1.2s ease';canvas.style.filter=`sepia(${(patina*.10).toFixed(2)}) saturate(${(1-regrowth*.06).toFixed(2)}) brightness(${(1-deterioration*.07).toFixed(2)})`;}
  document.documentElement.style.setProperty('--world-patina',String(patina));
  document.documentElement.style.setProperty('--world-trail-wear',String(trail));
  document.documentElement.style.setProperty('--world-regrowth',String(regrowth));
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

function agingText(a={}){
  const parts=[];
  if(Number(a.trailStrength||0)>.12)parts.push('paths are wearing into trails');
  if(Number(a.forestRegrowth||0)>.1)parts.push('young forest growth is returning');
  if(Number(a.structurePatina||0)>.1)parts.push('wood and stone show weathering');
  if(!parts.length)parts.push('the settlement still looks young');
  return parts.join(' · ');
}

function renderPulse(data){
  ensurePulse();
  const body=document.getElementById('livingPulseBody'); if(!body)return;
  const w=data.weather||{},n=data.needs||{},r=data.npcs?.routines||{},a=data.aging||{};
  const npcRows=Object.entries(r).map(([name,v])=>`<div style="padding:5px 0;border-top:1px solid rgba(255,255,255,.07)"><strong>${esc(name)}</strong><div style="opacity:.72">${esc(v.activity)} · ${esc(v.location)}</div></div>`).join('');
  body.innerHTML=`<div><strong>Weather:</strong> ${esc(w.condition||'clear')} · ${Number(w.temperatureC||0).toFixed(1)}°C · wind ${Number(w.windKph||0).toFixed(0)} km/h</div><div style="margin-top:5px"><strong>Settlement:</strong> ${esc(n.status||'stable')} · supply ${Number(n.score||0)}/100</div><div style="margin-top:5px"><strong>World age:</strong> ${Number(a.ageDays||0).toFixed(1)} days · ${esc(agingText(a))}</div><div style="margin-top:5px;opacity:.65;font-size:11px">Travel wear ${Math.round(Number(a.trailStrength||0)*100)}% · regrowth ${Math.round(Number(a.forestRegrowth||0)*100)}% · patina ${Math.round(Number(a.structurePatina||0)*100)}%</div><div style="margin-top:9px;font-size:11px;letter-spacing:.1em;opacity:.58">NPC ROUTINES</div>${npcRows}`;
}

function emitNPCState(data){window.dispatchEvent(new CustomEvent('gptworld:npc-life',{detail:data.npcs||{}}));}
function emitAgingState(data){window.dispatchEvent(new CustomEvent('gptworld:world-aging',{detail:data.aging||{}}));}

async function observeTravel(){
  const g=gameState();
  if(!Number.isFinite(Number(g.x))||!Number.isFinite(Number(g.z)))return;
  try{await fetch(LIVING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'observe_travel',x:Number(g.x),z:Number(g.z)})});}catch{}
}

async function refreshLiving(){
  try{
    const r=await fetch(LIVING_API,{cache:'no-store'}),data=await r.json();
    if(!data.ok)throw new Error(data.error||'living systems unavailable');
    livingState=data; renderWeather(data.weather); renderAging(data.aging); renderPulse(data); emitNPCState(data); emitAgingState(data);
  }catch(err){console.error('Living systems load failed',err)}
}

refreshLiving(); observeTravel();
setInterval(refreshLiving,60000);
travelTimer=setInterval(observeTravel,30000);
window.addEventListener('focus',()=>{refreshLiving();observeTravel();});
