const LIVING_API='/.netlify/functions/living-systems';
const GAME_KEY='gptworld-day1';
let livingState=null;
let travelTimer=null;
let lightningTimer=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gameState(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}

function ensureAtmosphereStyles(){
  if(document.getElementById('livingAtmosphereStyles'))return;
  const style=document.createElement('style');
  style.id='livingAtmosphereStyles';
  style.textContent=`
    @keyframes gptRainFall{0%{transform:translate3d(0,-16vh,0)}100%{transform:translate3d(-7vw,118vh,0)}}
    @keyframes gptStormRainFall{0%{transform:translate3d(0,-18vh,0)}100%{transform:translate3d(-13vw,120vh,0)}}
    @keyframes gptCloudDrift{0%{transform:translateX(-28vw)}100%{transform:translateX(128vw)}}
    @keyframes gptFogDrift{0%{transform:translateX(-12vw)}50%{transform:translateX(8vw)}100%{transform:translateX(-12vw)}}
    @keyframes gptStarTwinkle{0%,100%{opacity:.35}50%{opacity:.95}}
    .gpt-rain-drop{position:absolute;top:-18vh;width:2px;height:13vh;border-radius:999px;background:linear-gradient(to bottom,transparent,rgba(210,235,248,.8));transform:rotate(8deg);will-change:transform;animation:gptRainFall 1.05s linear infinite}
    .weather-storm .gpt-rain-drop{height:16vh;width:2.5px;background:linear-gradient(to bottom,transparent,rgba(220,240,250,.9));animation-name:gptStormRainFall;animation-duration:.62s}
    .gpt-cloud{position:absolute;height:18vh;width:46vw;min-width:210px;min-height:85px;border-radius:50%;filter:blur(18px);background:radial-gradient(ellipse at center,rgba(105,120,125,.38),rgba(105,120,125,.17) 48%,transparent 72%);will-change:transform;animation:gptCloudDrift 38s linear infinite}
    .weather-storm .gpt-cloud{background:radial-gradient(ellipse at center,rgba(42,52,62,.66),rgba(55,65,72,.34) 52%,transparent 74%)}
    .gpt-fog-bank{position:absolute;left:-20vw;width:140vw;height:28vh;border-radius:50%;filter:blur(26px);background:radial-gradient(ellipse at center,rgba(226,236,234,.38),rgba(215,226,224,.17) 55%,transparent 76%);animation:gptFogDrift 22s ease-in-out infinite alternate}
    .gpt-star{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff7d6;box-shadow:0 0 5px rgba(255,247,214,.75);animation:gptStarTwinkle 2.8s ease-in-out infinite}
    #livingWeather,#livingDayNight{pointer-events:none}
  `;
  document.head.appendChild(style);
}

function ensureWeatherLayer(){
  ensureAtmosphereStyles();
  if(document.getElementById('livingWeather'))return;
  const layer=document.createElement('div');
  layer.id='livingWeather';
  layer.style.cssText='position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden;transition:background 1.4s ease,opacity 1.4s ease';
  document.body.appendChild(layer);
}

function ensureDayNightLayer(){
  ensureAtmosphereStyles();
  if(document.getElementById('livingDayNight'))return;
  const layer=document.createElement('div');
  layer.id='livingDayNight';
  layer.style.cssText='position:fixed;inset:0;z-index:3;pointer-events:none;overflow:hidden;transition:background 2s ease,opacity 2s ease';
  document.body.appendChild(layer);
}

function ensureAgingLayer(){
  if(document.getElementById('worldAgingLayer'))return;
  const layer=document.createElement('div');
  layer.id='worldAgingLayer';
  layer.style.cssText='position:fixed;inset:0;z-index:2;pointer-events:none;transition:opacity 1.2s ease,background 1.2s ease;mix-blend-mode:multiply';
  document.body.appendChild(layer);
}

function makeRain(layer,storm=false){
  const count=storm?56:36;
  for(let i=0;i<count;i++){
    const d=document.createElement('i');
    d.className='gpt-rain-drop';
    d.style.left=`${Math.round((i*37.7)%108)-4}%`;
    d.style.animationDelay=`-${(i%13)*0.11}s`;
    d.style.opacity=String(.32+(i%6)*.09);
    d.style.transform=`rotate(${storm?14:8}deg)`;
    layer.appendChild(d);
  }
}

function makeClouds(layer,storm=false){
  const count=storm?5:3;
  for(let i=0;i<count;i++){
    const c=document.createElement('div');
    c.className='gpt-cloud';
    c.style.top=`${2+i*11}%`;
    c.style.animationDelay=`-${i*11}s`;
    c.style.animationDuration=`${storm?24+i*3:36+i*5}s`;
    c.style.opacity=String(storm?.62:.42);
    layer.appendChild(c);
  }
}

function makeFog(layer){
  for(let i=0;i<4;i++){
    const f=document.createElement('div');
    f.className='gpt-fog-bank';
    f.style.top=`${18+i*19}%`;
    f.style.animationDelay=`-${i*5}s`;
    f.style.opacity=String(.42-i*.05);
    layer.appendChild(f);
  }
}

function scheduleLightning(layer,enabled){
  if(lightningTimer){clearTimeout(lightningTimer);lightningTimer=null;}
  if(!enabled)return;
  const flash=()=>{
    if(!document.body.contains(layer)||!layer.classList.contains('weather-storm'))return;
    layer.style.boxShadow='inset 0 0 0 100vmax rgba(225,235,255,.44)';
    setTimeout(()=>{layer.style.boxShadow='none';},80);
    setTimeout(()=>{layer.style.boxShadow='inset 0 0 0 100vmax rgba(225,235,255,.18)';},145);
    setTimeout(()=>{layer.style.boxShadow='none';},220);
    lightningTimer=setTimeout(flash,4200+Math.random()*7800);
  };
  lightningTimer=setTimeout(flash,2600+Math.random()*5000);
}

function renderWeather(w){
  ensureWeatherLayer();
  const layer=document.getElementById('livingWeather');
  const cond=String(w?.condition||'clear');
  layer.className=`weather-${cond}`;
  layer.innerHTML='';
  layer.style.boxShadow='none';
  layer.style.opacity='1';
  if(cond==='clear'){
    layer.style.background='transparent';
    scheduleLightning(layer,false);
  }else if(cond==='cloudy'){
    layer.style.background='linear-gradient(rgba(65,78,82,.18),rgba(80,95,100,.08) 42%,transparent 72%)';
    makeClouds(layer,false);scheduleLightning(layer,false);
  }else if(cond==='fog'){
    layer.style.background='linear-gradient(rgba(205,218,216,.14),rgba(190,205,200,.08))';
    makeFog(layer);scheduleLightning(layer,false);
  }else if(cond==='rain'){
    layer.style.background='linear-gradient(rgba(62,78,88,.22),rgba(68,85,94,.07) 60%,transparent)';
    makeClouds(layer,false);makeRain(layer,false);scheduleLightning(layer,false);
  }else if(cond==='storm'){
    layer.style.background='linear-gradient(rgba(25,33,43,.42),rgba(42,52,60,.18) 62%,rgba(20,28,35,.12))';
    makeClouds(layer,true);makeRain(layer,true);scheduleLightning(layer,true);
  }
  document.documentElement.style.setProperty('--living-weather',cond);
}

function parseWorldHour(){
  const text=document.getElementById('clock')?.textContent||'';
  const m=text.match(/(\d{1,2}):(\d{2})/);
  if(!m)return 12;
  return (Number(m[1])%24)+Number(m[2])/60;
}

function makeStars(layer){
  for(let i=0;i<42;i++){
    const s=document.createElement('i');
    s.className='gpt-star';
    s.style.left=`${(i*47.3)%100}%`;
    s.style.top=`${3+(i*29.7)%55}%`;
    s.style.animationDelay=`-${(i%9)*.31}s`;
    s.style.opacity=String(.3+(i%5)*.11);
    layer.appendChild(s);
  }
}

function renderDayNight(){
  ensureDayNightLayer();
  const layer=document.getElementById('livingDayNight');
  const h=parseWorldHour();
  let phase='day';
  if(h>=20||h<5)phase='night'; else if(h<7)phase='dawn'; else if(h>=18)phase='dusk';
  if(layer.dataset.phase===phase)return;
  layer.dataset.phase=phase;
  layer.innerHTML='';
  if(phase==='night'){
    layer.style.background='linear-gradient(rgba(4,10,24,.68),rgba(10,20,30,.52) 55%,rgba(14,22,28,.46))';
    makeStars(layer);
    const moon=document.createElement('div');
    moon.style.cssText='position:absolute;right:10vw;top:11vh;width:42px;height:42px;border-radius:50%;background:#efe5c7;box-shadow:0 0 28px rgba(239,229,199,.42)';
    layer.appendChild(moon);
  }else if(phase==='dawn'){
    layer.style.background='linear-gradient(rgba(83,92,126,.28),rgba(238,153,102,.22) 46%,rgba(255,203,120,.12) 72%,transparent)';
  }else if(phase==='dusk'){
    layer.style.background='linear-gradient(rgba(76,60,98,.28),rgba(218,112,78,.22) 48%,rgba(93,51,72,.16) 75%,transparent)';
  }else{
    layer.style.background='linear-gradient(rgba(255,224,155,.055),transparent 44%)';
  }
  document.documentElement.dataset.worldPhase=phase;
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
  const phase=document.documentElement.dataset.worldPhase||'day';
  const npcRows=Object.entries(r).map(([name,v])=>`<div style="padding:5px 0;border-top:1px solid rgba(255,255,255,.07)"><strong>${esc(name)}</strong><div style="opacity:.72">${esc(v.activity)} · ${esc(v.location)}</div></div>`).join('');
  body.innerHTML=`<div><strong>Weather:</strong> ${esc(w.condition||'clear')} · ${Number(w.temperatureC||0).toFixed(1)}°C · wind ${Number(w.windKph||0).toFixed(0)} km/h</div><div style="margin-top:5px"><strong>Time:</strong> ${esc(phase)} · ${esc(document.getElementById('clock')?.textContent||'')}</div><div style="margin-top:5px"><strong>Settlement:</strong> ${esc(n.status||'stable')} · supply ${Number(n.score||0)}/100</div><div style="margin-top:5px"><strong>World age:</strong> ${Number(a.ageDays||0).toFixed(1)} days · ${esc(agingText(a))}</div><div style="margin-top:5px;opacity:.65;font-size:11px">Travel wear ${Math.round(Number(a.trailStrength||0)*100)}% · regrowth ${Math.round(Number(a.forestRegrowth||0)*100)}% · patina ${Math.round(Number(a.structurePatina||0)*100)}%</div><div style="margin-top:9px;font-size:11px;letter-spacing:.1em;opacity:.58">NPC ROUTINES</div>${npcRows}`;
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
    livingState=data; renderDayNight(); renderWeather(data.weather); renderAging(data.aging); renderPulse(data); emitNPCState(data); emitAgingState(data);
  }catch(err){console.error('Living systems load failed',err)}
}

refreshLiving(); observeTravel(); renderDayNight();
setInterval(refreshLiving,60000);
setInterval(()=>{renderDayNight();if(livingState)renderPulse(livingState);},5000);
travelTimer=setInterval(observeTravel,30000);
window.addEventListener('focus',()=>{refreshLiving();observeTravel();renderDayNight();});
