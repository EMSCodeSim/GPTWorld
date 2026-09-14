import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const WORLD_API='/.netlify/functions/world-v2';
const GAME_KEY='gptworld-day1';
const CLIENT_KEY='gptworld-client-id';
const markers=new Map();
const camera=new THREE.PerspectiveCamera(45,1,.1,200);
let posting=false;
let loading=false;

function game(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}
function cleanName(v){return String(v||'Traveler').replace(/[<>]/g,'').trim().slice(0,20)||'Traveler'}

function ensureLayer(){
  let layer=document.getElementById('livePlayersLayer');
  if(layer)return layer;
  const style=document.createElement('style');
  style.textContent=`#livePlayersLayer{position:fixed;inset:0;z-index:18;pointer-events:none;overflow:hidden}.live-player{position:absolute;transform:translate(-50%,-78%);transition:left .16s linear,top .16s linear,opacity .16s ease;display:grid;justify-items:center;gap:3px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.28));will-change:left,top}.live-player-token{width:26px;height:38px;border-radius:13px 13px 10px 10px;background:linear-gradient(#d4b987 0 28%,#6f7f9a 29% 100%);border:2px solid rgba(255,255,255,.65);box-shadow:0 0 0 3px rgba(14,22,17,.34)}.live-player-name{max-width:120px;padding:3px 7px;border-radius:999px;background:rgba(9,15,11,.78);border:1px solid rgba(255,255,255,.15);color:#fff7df;font:700 10px/1.1 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;backdrop-filter:blur(7px)}.live-player-distance{font:700 9px/1 system-ui,sans-serif;color:rgba(255,255,255,.68);text-shadow:0 1px 3px #000}@media(max-width:800px),(pointer:coarse){.live-player-token{width:23px;height:34px}.live-player-name{font-size:9px;max-width:92px;padding:3px 6px}}`;
  document.head.appendChild(style);
  layer=document.createElement('div');
  layer.id='livePlayersLayer';
  document.body.appendChild(layer);
  return layer;
}

function marker(id,name){
  const layer=ensureLayer();
  let row=markers.get(id);
  if(row)return row;
  const el=document.createElement('div');
  el.className='live-player';
  el.innerHTML='<div class="live-player-name"></div><div class="live-player-token"></div><div class="live-player-distance"></div>';
  layer.appendChild(el);
  row={el,name:el.querySelector('.live-player-name'),distance:el.querySelector('.live-player-distance'),lastSeen:Date.now()};
  row.name.textContent=cleanName(name);
  markers.set(id,row);
  return row;
}

function project(x,z){
  const g=game();
  const px=Number(g.x??0),pz=Number(g.z??12);
  const world=document.getElementById('world');
  const r=world?.getBoundingClientRect();
  if(!r||r.width<1||r.height<1)return null;
  camera.aspect=r.width/r.height;
  camera.position.set(px+12,14,pz+12);
  camera.lookAt(px,.5,pz);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(x,1.15,z).project(camera);
  if(p.z<-1||p.z>1)return null;
  const sx=r.left+(p.x+1)*.5*r.width;
  const sy=r.top+(1-p.y)*.5*r.height;
  if(sx<r.left-45||sx>r.right+45||sy<r.top-70||sy>r.bottom+70)return null;
  return {x:sx,y:sy};
}

function render(list){
  const g=game();
  const myId=localStorage.getItem(CLIENT_KEY)||'';
  const mx=Number(g.x??0),mz=Number(g.z??12);
  const now=Date.now();
  const seen=new Set();
  for(const p of Array.isArray(list)?list:[]){
    if(!p?.client_id||p.client_id===myId)continue;
    const x=Number(p.x),z=Number(p.z);
    if(!Number.isFinite(x)||!Number.isFinite(z))continue;
    const row=marker(p.client_id,p.display_name);
    row.lastSeen=now;
    seen.add(p.client_id);
    row.name.textContent=cleanName(p.display_name);
    row.distance.textContent=`${Math.round(Math.hypot(x-mx,z-mz))}m`;
    const pos=project(x,z);
    if(!pos){row.el.style.opacity='0';continue;}
    row.el.style.left=`${pos.x}px`;
    row.el.style.top=`${pos.y}px`;
    row.el.style.opacity='1';
  }
  for(const [id,row] of markers){
    if(!seen.has(id)&&now-row.lastSeen>1800){row.el.remove();markers.delete(id)}
  }
}

async function pushPosition(){
  if(posting)return;
  const clientId=localStorage.getItem(CLIENT_KEY)||'';
  if(!clientId)return;
  const g=game();
  const x=Number(g.x),z=Number(g.z);
  if(!Number.isFinite(x)||!Number.isFinite(z))return;
  posting=true;
  try{await fetch(WORLD_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,name:g.playerName||'Traveler',x,z})});}catch{}finally{posting=false}
}

async function loadOthers(){
  if(loading)return;
  const id=localStorage.getItem(CLIENT_KEY)||'';
  if(!id)return;
  loading=true;
  try{const r=await fetch(`${WORLD_API}?clientId=${encodeURIComponent(id)}`,{cache:'no-store'});const d=await r.json();if(d.ok)render(d.online||[]);}catch{}finally{loading=false}
}

function tick(){pushPosition();loadOthers()}
ensureLayer();
tick();
setInterval(tick,700);
window.addEventListener('focus',tick);
window.addEventListener('resize',loadOthers);
