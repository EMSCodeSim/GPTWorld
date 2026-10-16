#!/usr/bin/env node
/**
 * Local static + API playtest server.
 * Serves repo files, implements shipment-quest + lightweight presence in memory,
 * and proxies other Netlify functions to production so the world still boots.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SHIPMENT_POINTS,SHIPMENT_REWARD,shipmentNext,shipmentNarrative,shipmentObjective,
  shipmentFeedback,shipmentNormalizeMeta,shipmentRewardFor,
  isShipmentClueAction,shipmentClueKey,shipmentCluePoint,shipmentClueAllowed
} from '../lib/shipment-quest-core.mjs';
import {
  encounterByKey,choiceById,canAfford,applyCost,applyReward,rewardSummary,
  regionAt,pickEncounter,normalizeHistory,recentKeysFromHistory,cooldownsFromHistory,
  buildEncounterInstance,publicEncounterView,shouldTrace,
  ENCOUNTER_APPROACH_RADIUS,ENCOUNTER_CLUE_RADIUS
} from '../lib/world-encounters-core.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(__dirname,'..');
const PORT=Number(process.env.PORT||8765);
const UPSTREAM='https://gptlife.netlify.app';
const MIME={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon','.md':'text/markdown; charset=utf-8'
};

const presence=new Map(); // clientId -> {x,z,name}
const quests=new Map(); // clientId -> quest row
const invent=new Map(); // clientId -> {coins,stone,wood,herbs}
const encounters=new Map(); // clientId -> {active,history,traces,favors}
const encounterReceipts=new Map(); // clientId:key -> response

function json(res,obj,status=200){
  const body=JSON.stringify(obj);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(body);
}
function inventory(clientId){
  if(!invent.has(clientId))invent.set(clientId,{coins:20,stone:5,wood:5,herbs:2});
  return invent.get(clientId);
}
function pack(clientId){
  const row=quests.get(clientId)||{stage:'not_started',choice:null,started_at:null,completed_at:null,meta:{}};
  const meta=shipmentNormalizeMeta(row.meta||{},row.stage);
  if(row.choice)meta.choice=row.choice;
  return{
    ok:true,
    quest:{key:'missing-blacksmith-shipment',stage:row.stage,choice:row.choice,started_at:row.started_at,completed_at:row.completed_at,meta,
      description:shipmentNarrative(row.stage,meta),objective:shipmentObjective(row.stage,meta)},
    player:{...inventory(clientId)}
  };
}
function atPoint(clientId,point){
  const p=presence.get(clientId)||{x:0,z:12};
  return Math.hypot(Number(p.x)-point.x,Number(p.z)-point.z)<=6.5;
}
function handleShipment(req,res,url,body){
  const clientId=String((req.method==='GET'?url.searchParams.get('clientId'):body.clientId)||'').trim();
  if(!clientId)return json(res,{ok:false,error:'client_id_required'},400);
  if(req.method==='GET')return json(res,pack(clientId));
  const action=String(body.action||'').trim();
  if(!body.idempotencyKey)return json(res,{ok:false,error:'idempotency_key_required'},400);
  const record=pack(clientId);
  let stage=record.quest.stage;
  let meta=shipmentNormalizeMeta(record.quest.meta,stage);
  const row=()=>quests.get(clientId)||{stage:'not_started',choice:null,started_at:null,completed_at:null,meta:{}};

  if(isShipmentClueAction(action)){
    if(!shipmentClueAllowed(stage))return json(res,{ok:false,error:'quest_action_unavailable',quest:record.quest},409);
    const clue=shipmentClueKey(action),point=shipmentCluePoint(action);
    if(!point||!atPoint(clientId,point))return json(res,{ok:false,error:'approach_quest_location',target:point},409);
    if(meta.clues.includes(clue))return json(res,{...record,action,message:shipmentFeedback(action,record.quest),alreadyHad:true});
    meta={...meta,clues:[...meta.clues,clue]};
    const nextRow={...row(),meta};quests.set(clientId,nextRow);
    const inv=inventory(clientId);
    if(clue==='axle')inv.stone+=1;if(clue==='scrap')inv.wood+=1;if(clue==='rumor')inv.herbs+=1;
    const result=pack(clientId);
    return json(res,{...result,action,message:shipmentFeedback(action,result.quest),clue});
  }

  const position=SHIPMENT_POINTS[({turn_in:'tovan',inspect_tracks:'tracks',recover:'cache',fight_wolf:'wolf',avoid_wolf:'wolf'})[action]];
  // Local playtest assumes a bow is available so both wolf choices remain testable without equipment DB.
  const nextStage=shipmentNext(stage,action,{hasBow:true});
  if(!nextStage)return json(res,{ok:false,error:action==='fight_wolf'?'equip_bow_first':'quest_action_unavailable',quest:record.quest},409);
  if(position&&!atPoint(clientId,position))return json(res,{ok:false,error:'approach_quest_location',target:position},409);

  if(action==='accept'){
    meta=shipmentNormalizeMeta({run:1,seed:Math.floor(Math.random()*100000),clues:[],choice:null,completions:meta.completions||0},'tracking');
    quests.set(clientId,{stage:'tracking',choice:null,started_at:new Date().toISOString(),completed_at:row().completed_at||null,meta});
  }else if(action==='replay'){
    if(stage!=='completed')return json(res,{ok:false,error:'quest_state_changed'},409);
    meta=shipmentNormalizeMeta({run:(meta.run||1)+1,seed:Math.floor(Math.random()*100000),clues:[],choice:null,completions:Math.max(1,meta.completions||1)},'tracking');
    quests.set(clientId,{stage:'tracking',choice:null,started_at:new Date().toISOString(),completed_at:row().completed_at,meta});
  }else if(action==='turn_in'){
    if(stage!=='shipment_recovered')return json(res,{ok:false,error:'reward_unavailable_retry'},409);
    const provisional={...record.quest,stage:'completed',meta:{...meta,choice:record.quest.choice||meta.choice}};
    const reward=shipmentRewardFor(provisional);
    const inv=inventory(clientId);
    inv.coins+=reward.coins;inv.stone+=reward.stone;inv.wood+=reward.wood||0;inv.herbs+=reward.herbs||0;
    meta=shipmentNormalizeMeta({...meta,choice:record.quest.choice||meta.choice,completions:(meta.completions||0)+1},'completed');
    quests.set(clientId,{stage:'completed',choice:record.quest.choice||meta.choice,started_at:row().started_at,completed_at:new Date().toISOString(),meta});
    const result=pack(clientId);
    return json(res,{...result,action,reward,message:shipmentFeedback(action,result.quest),combat:null});
  }else{
    const chosen=action==='fight_wolf'?'bow':action==='avoid_wolf'?'stealth':null;
    if(chosen)meta={...meta,choice:chosen};
    if(action==='fight_wolf'&&body.forceMiss){
      return json(res,{...record,combat:{success:false,chance:.4,xp:.3},message:'Your arrow misses or glances off. The wolf stays near the wagon. Try again or sneak past.'});
    }
    quests.set(clientId,{...row(),stage:nextStage,choice:chosen||row().choice,meta});
  }
  const result=pack(clientId);
  return json(res,{...result,action,combat:action==='fight_wolf'?{success:true,chance:.7,xp:SHIPMENT_REWARD.archeryXp}:null,
    reward:null,message:shipmentFeedback(action,result.quest)});
}

async function proxy(req,res,url){
  const target=UPSTREAM+url.pathname+url.search;
  const headers={...req.headers,host:'gptlife.netlify.app'};
  delete headers['content-length'];
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks);
  try{
    const upstream=await fetch(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
    const buf=Buffer.from(await upstream.arrayBuffer());
    const outHeaders={'cache-control':'no-store','access-control-allow-origin':'*'};
    const ct=upstream.headers.get('content-type');if(ct)outHeaders['content-type']=ct;
    res.writeHead(upstream.status,outHeaders);res.end(buf);
  }catch(error){
    json(res,{ok:false,error:'proxy_failed',detail:String(error.message||error)},502);
  }
}

function encState(clientId){
  if(!encounters.has(clientId))encounters.set(clientId,{active:null,history:[],traces:[],favors:{}});
  return encounters.get(clientId);
}
function encPack(clientId,extra={}){
  const st=encState(clientId),actor=presence.get(clientId)||{x:0,z:12},inv=inventory(clientId);
  const def=encounterByKey(st.active?.key);
  return{ok:true,encounter:publicEncounterView(st.active,def),traces:st.traces,favors:st.favors,
    history:normalizeHistory(st.history).slice(-6),region:regionAt(actor.x,actor.z),level:1,
    player:{...inv},...extra};
}
function encNear(clientId,point,radius){
  const p=presence.get(clientId)||{x:0,z:12};
  return point&&Math.hypot(Number(p.x)-point.x,Number(p.z)-point.z)<=radius;
}
function handleEncounters(req,res,url,body){
  const clientId=String((req.method==='GET'?url.searchParams.get('clientId'):body.clientId)||'').trim();
  if(!clientId)return json(res,{ok:false,error:'client_id_required'},400);
  const st=encState(clientId);
  if(req.method==='GET'){
    if(url.searchParams.get('scan')==='1'&&(!st.active||st.active.status==='resolved')){
      const actor=presence.get(clientId)||{x:0,z:12};
      const region=regionAt(actor.x,actor.z);
      const seed=Math.floor(Date.now()/60000)+clientId.length;
      if(region){
        const def=pickEncounter({regionKey:region.key,level:3,recentKeys:recentKeysFromHistory(st.history,5),seed,cooldowns:cooldownsFromHistory(st.history)});
        if(def)st.active=buildEncounterInstance(def,{seed});
      }else if(st.active?.status==='resolved')st.active=null;
    }
    return json(res,encPack(clientId));
  }
  const action=String(body.action||'').trim(),key=String(body.idempotencyKey||'').trim();
  if(!key)return json(res,{ok:false,error:'idempotency_key_required'},400);
  const receiptKey=`${clientId}:${key}`;
  if(encounterReceipts.has(receiptKey))return json(res,encounterReceipts.get(receiptKey));
  const remember=payload=>{encounterReceipts.set(receiptKey,payload);return json(res,payload);};

  if(action==='scan'){
    if(st.active&&['available','engaged','deferred'].includes(st.active.status))return remember(encPack(clientId,{message:'An encounter is already nearby.'}));
    const actor=presence.get(clientId)||{x:0,z:12};
    const region=regionAt(actor.x,actor.z);
    if(!region)return remember(encPack(clientId,{message:'Keep exploring — events appear around the settlement and trails.'}));
    const def=pickEncounter({regionKey:region.key,level:3,recentKeys:recentKeysFromHistory(st.history,5),seed:Date.now(),cooldowns:cooldownsFromHistory(st.history)});
    if(!def)return remember(encPack(clientId,{message:'The area is quiet for now.'}));
    st.active=buildEncounterInstance(def,{seed:Date.now()});
    return remember(encPack(clientId,{message:`Something stirs near the ${region.label.toLowerCase()}.`}));
  }
  if(action==='find_clue'){
    const def=encounterByKey(st.active?.key);if(!def?.clue)return json(res,{ok:false,error:'no_clue'},409);
    if(!encNear(clientId,def.clue,ENCOUNTER_CLUE_RADIUS+0.8))return json(res,{ok:false,error:'approach_clue'},409);
    if(st.active.clue?.found)return remember(encPack(clientId,{message:'You already found that clue.',alreadyHad:true}));
    st.active={...st.active,clue:{...(st.active.clue||def.clue),found:true}};
    return remember(encPack(clientId,{message:`Clue found: ${def.clue.label}.`}));
  }
  if(action==='engage'){
    const def=encounterByKey(st.active?.key);
    if(!st.active)return json(res,{ok:false,error:'no_active_encounter'},409);
    if(!encNear(clientId,st.active.spawn||def?.spawn,ENCOUNTER_APPROACH_RADIUS+0.8))return json(res,{ok:false,error:'approach_encounter'},409);
    st.active={...st.active,status:'engaged',openedAt:st.active.openedAt||new Date().toISOString()};
    return remember(encPack(clientId,{message:def?.title||'You look closer.'}));
  }
  if(action==='defer'||action==='leave_open'){
    if(!st.active||st.active.status==='resolved')return json(res,{ok:false,error:'no_active_encounter'},409);
    st.active={...st.active,status:'deferred'};
    return remember(encPack(clientId,{message:'You step away. The situation remains if you return.'}));
  }
  if(action==='choose'){
    const def=encounterByKey(st.active?.key);const choice=choiceById(def,body.choiceId);
    if(!def||!choice)return json(res,{ok:false,error:'invalid_choice'},400);
    if(!encNear(clientId,st.active.spawn||def.spawn,ENCOUNTER_APPROACH_RADIUS+0.8))return json(res,{ok:false,error:'approach_encounter'},409);
    if(choice.requiresClue&&!st.active.clue?.found)return json(res,{ok:false,error:'clue_required'},409);
    let inv=inventory(clientId);
    if(!canAfford(choice,inv))return json(res,{ok:false,error:'insufficient_resources',need:choice.cost||{}},409);
    // Local playtest treats combat choices as successful so both paths remain testable.
    inv=Object.assign(inv,applyReward(applyCost({...inv},choice),choice));
    invent.set(clientId,inv);
    const opensRoute=Boolean(choice.opensRoute);
    const trace=shouldTrace(def,choice.id,opensRoute);
    st.active={...st.active,status:'resolved',choice:choice.id,resolvedAt:new Date().toISOString(),message:choice.message,hint:choice.hint||null,opensRoute};
    st.history=normalizeHistory([...st.history,{key:def.key,choice:choice.id,at:new Date().toISOString(),region:def.region}]);
    if(trace){
      if(trace.kind==='route'&&trace.id&&!st.traces.some(t=>t.id===trace.id))st.traces.push({id:trace.id,kind:'route',label:trace.label,points:trace.points||[],at:new Date().toISOString()});
      if(trace.npc&&trace.text){const list=st.favors[trace.npc]||[];list.push({text:trace.text,choice:choice.id,at:new Date().toISOString()});st.favors[trace.npc]=list.slice(-6);}
    }
    const summary=rewardSummary(choice);
    return remember(encPack(clientId,{action:'choose',choiceId:choice.id,reward:choice.reward||{},message:choice.message+(summary?` (${summary})`:''),hint:choice.hint||null,combat:choice.combat?{success:true,chance:.8,xp:1}:null}));
  }
  if(action==='clear_resolved'){
    if(st.active?.status==='resolved')st.active=null;
    return remember(encPack(clientId));
  }
  return json(res,{ok:false,error:'unknown_action'},400);
}

function serveStatic(req,res,url){
  let filePath=decodeURIComponent(url.pathname);
  if(filePath==='/' )filePath='/index.html';
  const full=path.normalize(path.join(ROOT,filePath));
  if(!full.startsWith(ROOT)){res.writeHead(403);return res.end('forbidden');}
  if(!fs.existsSync(full)||fs.statSync(full).isDirectory()){res.writeHead(404);return res.end('not found');}
  const ext=path.extname(full).toLowerCase();
  res.writeHead(200,{'content-type':MIME[ext]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(full).pipe(res);
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end();}

  // Capture presence from world posts so shipment/encounter proximity checks work offline.
  if((url.pathname==='/.netlify/functions/world'||url.pathname==='/.netlify/functions/world-v2')&&req.method==='POST'){
    const chunks=[];for await(const c of req)chunks.push(c);
    const raw=Buffer.concat(chunks);
    try{
      const body=JSON.parse(raw.toString('utf8')||'{}');
      if(body.clientId&&Number.isFinite(Number(body.x))&&Number.isFinite(Number(body.z))){
        presence.set(String(body.clientId),{x:Number(body.x),z:Number(body.z),name:body.name||'Traveler'});
      }
    }catch{}
    // Replay body to upstream; local presence already updated for encounter proximity.
    try{
      const upstream=await fetch(UPSTREAM+url.pathname+url.search,{method:'POST',headers:{'content-type':'application/json',host:'gptlife.netlify.app'},body:raw});
      const buf=Buffer.from(await upstream.arrayBuffer());
      // Unregistered playtest clients may 4xx upstream — still acknowledge local presence.
      if(upstream.status>=400)return json(res,{ok:true,online:[],world:{},proxied:false,upstreamStatus:upstream.status});
      res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'no-store'});
      return res.end(buf);
    }catch{
      return json(res,{ok:true,online:[],world:{},proxied:false});
    }
  }

  if(url.pathname==='/.netlify/functions/shipment-quest'){
    const chunks=[];for await(const c of req)chunks.push(c);
    let body={};try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{body={};}
    return handleShipment(req,res,url,body);
  }

  if(url.pathname==='/.netlify/functions/world-encounters'){
    const chunks=[];for await(const c of req)chunks.push(c);
    let body={};try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{body={};}
    return handleEncounters(req,res,url,body);
  }

  if(url.pathname.startsWith('/.netlify/functions/'))return proxy(req,res,url);
  return serveStatic(req,res,url);
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`GPTWorld playtest server on http://127.0.0.1:${PORT}`);
});
