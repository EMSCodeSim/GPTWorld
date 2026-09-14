import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const WORLD_API='/.netlify/functions/world-v2';
const CLIENT_KEY='gptworld-client-id';
const GAME_KEY='gptworld-day1';
const POLL_MS=1200;
const remotePlayers=new Map();
let lastOnline=[];

function gameState(){try{return JSON.parse(localStorage.getItem(GAME_KEY))||{}}catch{return{}}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

function ensureLayer(){
  let layer=document.getElementById('remotePlayersLayer');
  if(layer)return layer;
  layer=document.createElement('div');
  layer.id='remotePlayersLayer';
  layer.setAttribute('aria-label','Other online travelers');
  layer.style.cssText='position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden';
  document.body.appendChild(layer);
  return layer;
}

function makeAvatar(row){
  const el=document.createElement('div');
  el.className='remote-player';
  el.style.cssText='position:absolute;left:0;top:0;transform:translate(-50%,-78%);transform-origin:50% 100%;transition:left .18s linear,top .18s linear,opacity .25s ease,transform .18s linear;will-change:left,top,transform;pointer-events:none;text-align:center';
  el.innerHTML=`<div class="remote-name" style="display:inline-block;margin-bottom:4px;padding:3px 7px;border-radius:999px;background:rgba(9,14,11,.78);border:1px solid rgba(255,255,255,.16);color:#f5f0df;font:700 11px/1.1 system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.28)"></div><div style="position:relative;width:26px;height:44px;margin:auto"><div style="position:absolute;left:50%;top:0;width:17px;height:17px;border-radius:50%;transform:translateX(-50%);background:#d7ad7d;border:1px solid rgba(60,40,25,.35);box-shadow:0 2px 4px rgba(0,0,0,.25)"></div><div style="position:absolute;left:50%;top:14px;width:22px;height:29px;transform:translateX(-50%);border-radius:8px 8px 10px 10px;background:#6683a1;border:1px solid rgba(20,35,48,.45);box-shadow:0 4px 8px rgba(0,0,0,.32)"></div></div>`;
  el.querySelector('.remote-name').textContent=row.display_name||'Traveler';
  ensureLayer().appendChild(el);
  return {el,x:Number(row.x)||0,z:Number(row.z)||0,targetX:Number(row.x)||0,targetZ:Number(row.z)||0,lastSeen:Date.now()};
}

function syncRows(rows){
  const selfId=localStorage.getItem(CLIENT_KEY)||'';
  const seen=new Set();
  for(const row of rows||[]){
    if(!row?.client_id||row.client_id===selfId)continue;
    seen.add(row.client_id);
    let p=remotePlayers.get(row.client_id);
    if(!p){p=makeAvatar(row);remotePlayers.set(row.client_id,p)}
    p.targetX=Number(row.x)||0;
    p.targetZ=Number(row.z)||0;
    p.lastSeen=Date.now();
    const name=p.el.querySelector('.remote-name');
    if(name&&name.textContent!==(row.display_name||'Traveler'))name.textContent=row.display_name||'Traveler';
  }
  for(const [id,p] of remotePlayers){
    if(!seen.has(id)&&Date.now()-p.lastSeen>2500){p.el.remove();remotePlayers.delete(id)}
  }
}

async function refreshPresence(){
  const clientId=localStorage.getItem(CLIENT_KEY)||'';
  try{
    const r=await fetch(`${WORLD_API}?clientId=${encodeURIComponent(clientId)}`,{cache:'no-store'});
    const data=await r.json();
    if(!data.ok||!Array.isArray(data.online))return;
    lastOnline=data.online;
    syncRows(lastOnline);
  }catch{}
}

function render(){
  const state=gameState();
  const px=Number(state.x)||0,pz=Number(state.z)||12;
  const w=window.innerWidth,h=window.innerHeight;
  const camera=new THREE.PerspectiveCamera(45,w/Math.max(1,h),.1,200);
  camera.position.set(px+16,18,pz+16);
  camera.lookAt(px,0,pz);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  for(const p of remotePlayers.values()){
    p.x+=(p.targetX-p.x)*.22;
    p.z+=(p.targetZ-p.z)*.22;
    const v=new THREE.Vector3(p.x,1.55,p.z).project(camera);
    const sx=(v.x*.5+.5)*w;
    const sy=(-v.y*.5+.5)*h;
    const visible=v.z>-1&&v.z<1&&sx>-80&&sx<w+80&&sy>-80&&sy<h+80;
    const distance=Math.hypot(p.x-px,p.z-pz);
    const scale=clamp(1.22-distance/85,.72,1.18);
    p.el.style.left=`${sx}px`;
    p.el.style.top=`${sy}px`;
    p.el.style.opacity=visible?'1':'0';
    p.el.style.transform=`translate(-50%,-78%) scale(${scale.toFixed(2)})`;
    p.el.style.zIndex=String(Math.max(1,1000-Math.round(distance*10)));
  }
  requestAnimationFrame(render);
}

ensureLayer();
refreshPresence();
setInterval(refreshPresence,POLL_MS);
window.addEventListener('focus',refreshPresence);
requestAnimationFrame(render);
