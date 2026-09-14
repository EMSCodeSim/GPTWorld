const WORLD_API='/.netlify/functions/world-v2';
const GAME_KEY='gptworld-day1';
const CLIENT_KEY='gptworld-client-id';
let markers=new Map();

function game(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}
function ensureLayer(){
  let layer=document.getElementById('livePlayersLayer');
  if(layer)return layer;
  const style=document.createElement('style');
  style.textContent=`
    #livePlayersLayer{position:fixed;inset:0;z-index:18;pointer-events:none;overflow:hidden}
    .live-player{position:absolute;transform:translate(-50%,-50%);transition:left .7s linear,top .7s linear,opacity .25s ease;display:grid;justify-items:center;gap:3px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.28))}
    .live-player-token{width:26px;height:38px;border-radius:13px 13px 10px 10px;background:linear-gradient(#d4b987 0 28%,#6f7f9a 29% 100%);border:2px solid rgba(255,255,255,.65);box-shadow:0 0 0 3px rgba(14,22,17,.34)}
    .live-player-name{max-width:120px;padding:3px 7px;border-radius:999px;background:rgba(9,15,11,.78);border:1px solid rgba(255,255,255,.15);color:#fff7df;font:700 10px/1.1 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;backdrop-filter:blur(7px)}
    .live-player-distance{font:700 9px/1 system-ui,sans-serif;color:rgba(255,255,255,.68);text-shadow:0 1px 3px #000}
    @media(max-width:800px),(pointer:coarse){.live-player-token{width:23px;height:34px}.live-player-name{font-size:9px;max-width:92px;padding:3px 6px}}
  `;
  document.head.appendChild(style);
  layer=document.createElement('div');
  layer.id='livePlayersLayer';
  document.body.appendChild(layer);
  return layer;
}

function safeName(v){return String(v||'Traveler').replace(/[<>]/g,'').trim().slice(0,20)||'Traveler'}
function markerFor(id,name){
  const layer=ensureLayer();
  let row=markers.get(id);
  if(row)return row;
  const el=document.createElement('div');
  el.className='live-player';
  el.innerHTML='<div class="live-player-token"></div><div class="live-player-name"></div><div class="live-player-distance"></div>';
  layer.appendChild(el);
  row={el,name:el.querySelector('.live-player-name'),distance:el.querySelector('.live-player-distance'),lastSeen:Date.now()};
  row.name.textContent=safeName(name);
  markers.set(id,row);
  return row;
}

function projectRelative(dx,dz){
  const w=innerWidth,h=innerHeight;
  const scale=Math.max(8,Math.min(18,w/27));
  const sx=w*.5+(dx-dz)*scale*.74;
  const sy=h*.47+(dx+dz)*scale*.36;
  return {x:Math.max(38,Math.min(w-38,sx)),y:Math.max(100,Math.min(h-175,sy))};
}

function renderOnline(list){
  const me=game();
  const myId=localStorage.getItem(CLIENT_KEY)||'';
  const mx=Number(me.x||0),mz=Number(me.z||12);
  const now=Date.now();
  const seen=new Set();
  for(const p of Array.isArray(list)?list:[]){
    if(!p?.client_id||p.client_id===myId)continue;
    const x=Number(p.x),z=Number(p.z);
    if(!Number.isFinite(x)||!Number.isFinite(z))continue;
    const dx=x-mx,dz=z-mz,dist=Math.hypot(dx,dz);
    const row=markerFor(p.client_id,p.display_name);
    row.lastSeen=now;seen.add(p.client_id);
    row.name.textContent=safeName(p.display_name);
    row.distance.textContent=`${Math.round(dist)}m`;
    const pos=projectRelative(dx,dz);
    row.el.style.left=`${pos.x}px`;row.el.style.top=`${pos.y}px`;
    row.el.style.opacity=dist>24?'.5':'1';
    row.el.style.transform=`translate(-50%,-50%) scale(${dist<4?1.08:dist>18?.86:1})`;
  }
  for(const [id,row] of markers){if(!seen.has(id)&&now-row.lastSeen>3500){row.el.remove();markers.delete(id)}}
}

async function refresh(){
  try{
    const id=localStorage.getItem(CLIENT_KEY)||'';
    const r=await fetch(`${WORLD_API}?clientId=${encodeURIComponent(id)}`,{cache:'no-store'});
    const d=await r.json();
    if(d.ok)renderOnline(d.online||[]);
  }catch{}
}

ensureLayer();refresh();setInterval(refresh,1200);window.addEventListener('focus',refresh);
