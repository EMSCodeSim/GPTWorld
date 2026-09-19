import { neon } from '@neondatabase/serverless';
import {harvestPlant,normalizePlant,resourceLifecycle} from '../../lib/plant-lifecycle.mjs';
import {RESOURCE_DEFAULTS} from '../../lib/resource-defaults.mjs';
import {ecologyRenderEntities} from './_sim-core.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const DEFAULT_NODE_CONFIG = {
  'tree-0':{resource:'wood',max:6,regrowMinutes:60},'tree-1':{resource:'wood',max:6,regrowMinutes:60},'tree-2':{resource:'wood',max:6,regrowMinutes:60},'tree-3':{resource:'wood',max:6,regrowMinutes:60},'tree-4':{resource:'wood',max:6,regrowMinutes:60},'tree-5':{resource:'wood',max:6,regrowMinutes:60},'tree-6':{resource:'wood',max:6,regrowMinutes:60},'tree-7':{resource:'wood',max:6,regrowMinutes:60},'tree-8':{resource:'wood',max:6,regrowMinutes:60},'tree-9':{resource:'wood',max:6,regrowMinutes:60},'tree-10':{resource:'wood',max:6,regrowMinutes:60},'tree-11':{resource:'wood',max:6,regrowMinutes:60},'tree-12':{resource:'wood',max:6,regrowMinutes:60},'tree-13':{resource:'wood',max:6,regrowMinutes:60},'tree-14':{resource:'wood',max:6,regrowMinutes:60},'tree-15':{resource:'wood',max:6,regrowMinutes:60},'tree-16':{resource:'wood',max:6,regrowMinutes:60},'tree-17':{resource:'wood',max:6,regrowMinutes:60},'tree-18':{resource:'wood',max:6,regrowMinutes:60},'tree-19':{resource:'wood',max:6,regrowMinutes:60},'tree-20':{resource:'wood',max:6,regrowMinutes:60},'tree-21':{resource:'wood',max:6,regrowMinutes:60},'tree-22':{resource:'wood',max:6,regrowMinutes:60},
  'rock-0':{resource:'stone',max:4,regrowMinutes:90},'rock-1':{resource:'stone',max:4,regrowMinutes:90},'rock-2':{resource:'stone',max:4,regrowMinutes:90},'rock-3':{resource:'stone',max:4,regrowMinutes:90},'rock-4':{resource:'stone',max:4,regrowMinutes:90},
  'herb-0':{resource:'herbs',max:3,regrowMinutes:20},'herb-1':{resource:'herbs',max:3,regrowMinutes:20},'herb-2':{resource:'herbs',max:3,regrowMinutes:20},'herb-3':{resource:'herbs',max:3,regrowMinutes:20},'herb-4':{resource:'herbs',max:3,regrowMinutes:20}
};

const TREE_POSITIONS=[[18,-13],[20,-7],[19,4],[23,10],[16,15],[10,18],[3,19],[-5,18],[-12,15],[-16,8],[-17,-1],[-15,-12],[-9,-17],[1,-18],[12,-17],[27,-17],[28,-7],[28,3],[27,15],[-29,-18],[-31,-8],[-30,7],[-29,18]];
const ROCK_POSITIONS=[[15,9],[-12,10],[20,-2],[-15,-6],[9,14]];
const HERB_POSITIONS=[[7,14],[-10,13],[17,-10],[-13,-3],[13,11]];
TREE_POSITIONS.forEach(([x,z],i)=>Object.assign(DEFAULT_NODE_CONFIG[`tree-${i}`],{x,z}));
ROCK_POSITIONS.forEach(([x,z],i)=>Object.assign(DEFAULT_NODE_CONFIG[`rock-${i}`],{x,z}));
HERB_POSITIONS.forEach(([x,z],i)=>Object.assign(DEFAULT_NODE_CONFIG[`herb-${i}`],{x,z}));

// Biological resources colonize new habitat after depletion. Stone deposits are finite.
const MOBILE_RESOURCES=new Set(['wood','herbs']);
const habitatSeed=(text)=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295};
function relocatedPosition(nodeId,generation,resource){
  const a=habitatSeed(`${nodeId}:${generation}:a`)*Math.PI*2;
  const r=5+habitatSeed(`${nodeId}:${generation}:r`)*18;
  let x=Math.cos(a)*r+(resource==='herbs'?2:6),z=Math.sin(a)*r;
  if(x>-30&&x<-18)x=-17+habitatSeed(`${nodeId}:${generation}:bank`)*5;
  return{x:Number(Math.max(-31,Math.min(31,x)).toFixed(2)),z:Number(Math.max(-31,Math.min(31,z)).toFixed(2))};
}

const safeInt=(value,fallback,min,max)=>{
  const n=Math.round(Number(value));
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
const safeCoordinate=(value)=>{
  const n=Number(value);
  return Number.isFinite(n)?Math.max(-64,Math.min(64,n)):null;
};

const forestStage=(pressure)=>pressure>=70?'critical':pressure>=45?'stressed':pressure>=20?'watched':'stable';
const forestPressureScore=(harvested,depletedSites,mitigation=0,expansion=0)=>Math.max(0,Math.min(100,harvested*2+depletedSites*8-mitigation+expansion*8));

async function ensureForestPressure(sql){
  const history=await sql`SELECT count(*)::int AS harvested, count(*) FILTER (WHERE COALESCE((payload->>'remaining')::int,1)<=0)::int AS depleted FROM world_events WHERE event_type='resource_gathered' AND payload->>'resource'='wood'`;
  const historicalHarvests=Number(history[0]?.harvested||0),historicalDepletions=Number(history[0]?.depleted||0);
  const harvested=Math.min(12,historicalHarvests),depletedSites=Math.min(2,historicalDepletions),pressure=forestPressureScore(harvested,depletedSites);
  const initial={version:1,harvested,depletedSites,pressure,stage:forestStage(pressure),response:null,responseVotes:{replant:0,managed_woodlot:0,restrict_harvest:0,continue_expansion:0},mitigation:0,expansion:0,milestone:0,lastEventAt:null,lastNodeId:null};
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('forest_pressure',${JSON.stringify(initial)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
  if(historicalHarvests>0){
    const boot=await sql`UPDATE world_state SET value=${JSON.stringify({...initial,milestone:1,lastEventAt:new Date().toISOString()})}::jsonb,updated_at=now() WHERE key='forest_pressure' AND COALESCE((value->>'harvested')::int,0)=0 AND value->>'lastEventAt' IS NULL RETURNING value`;
    if(boot.length)await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'forest_pressure_changed',${JSON.stringify({from:'stable',stage:initial.stage,pressure:initial.pressure,milestone:1,reason:'historical_harvest_evidence'})}::jsonb)`;
  }
}

async function recordForestHarvest(sql,playerId,nodeId,depleted){
  await ensureForestPressure(sql);
  const rows=await sql`
    WITH current AS (SELECT value FROM world_state WHERE key='forest_pressure' FOR UPDATE),
    counted AS (
      SELECT value,COALESCE((value->>'harvested')::int,0)+1 AS harvested,
        COALESCE((value->>'depletedSites')::int,0)+${depleted?1:0}::int AS depleted_sites,
        COALESCE((value->>'mitigation')::int,0) AS mitigation,
        COALESCE((value->>'expansion')::int,0) AS expansion,
        COALESCE(value->>'stage','stable') AS old_stage
      FROM current
    ), scored AS (
      SELECT *,LEAST(100,GREATEST(0,harvested*2+depleted_sites*8-mitigation+expansion*8))::int AS pressure FROM counted
    ), staged AS (
      SELECT *,CASE WHEN pressure>=70 THEN 'critical' WHEN pressure>=45 THEN 'stressed' WHEN pressure>=20 THEN 'watched' ELSE 'stable' END AS new_stage FROM scored
    ), updated AS (
      UPDATE world_state ws SET value=jsonb_build_object(
        'version',1,'harvested',staged.harvested,'depletedSites',staged.depleted_sites,'pressure',staged.pressure,
        'stage',staged.new_stage,'response',staged.value->'response','responseVotes',COALESCE(staged.value->'responseVotes','{}'::jsonb),
        'mitigation',staged.mitigation,'expansion',staged.expansion,
        'milestone',COALESCE((staged.value->>'milestone')::int,0)+CASE WHEN staged.new_stage<>staged.old_stage THEN 1 ELSE 0 END,
        'lastEventAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastNodeId',${nodeId}::text
      ),updated_at=now() FROM staged WHERE ws.key='forest_pressure'
      RETURNING ws.value,staged.old_stage,staged.new_stage
    ) SELECT value,old_stage,new_stage FROM updated`;
  const row=rows[0];
  if(row&&row.old_stage!==row.new_stage){
    const payload={from:row.old_stage,stage:row.new_stage,pressure:Number(row.value?.pressure||0),milestone:Number(row.value?.milestone||0),nodeId};
    await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (${playerId},'forest_pressure_changed',${JSON.stringify(payload)}::jsonb)`;
  }
  return row?.value||null;
}

function renderList(value){
  if(Array.isArray(value))return value;
  if(Array.isArray(value?.entities))return value.entities;
  return [];
}

async function nodeConfig(sql){
  const config={...DEFAULT_NODE_CONFIG};
  const rows=await sql`SELECT value FROM world_state WHERE key='render_entities' LIMIT 1`;
  for(const entity of renderList(rows[0]?.value)){
    if(String(entity?.type||'')!=='resource')continue;
    const id=String(entity?.id||'').trim().slice(0,40);
    const resource=String(entity?.resource||'').trim().toLowerCase();
    if(!id||config[id]||!RESOURCE_DEFAULTS[resource])continue;
    const defaults=RESOURCE_DEFAULTS[resource];
    const x=safeCoordinate(entity.x),z=safeCoordinate(entity.z);
    // Dynamic resources are playable world objects: without a valid server position
    // they must not be registered as authoritative gathering nodes.
    if(x===null||z===null)continue;
    config[id]={
      resource,
      max:safeInt(entity.max,defaults.max,1,100),
      regrowMinutes:safeInt(entity.regrowMinutes,defaults.regrowMinutes,1,10080),
      x,z
    };
  }
  return config;
}

async function getInventory(sql, playerId) {
  const rows = await sql`SELECT wood, stone, herbs, updated_at FROM player_inventory WHERE player_id = ${playerId} LIMIT 1`;
  const row = rows[0] || {};
  return { wood:Number(row.wood||0), stone:Number(row.stone||0), herbs:Number(row.herbs||0), updated_at:row.updated_at||null };
}

async function gatherIndividualPlant(sql,player,key,plantId){
  const prior=await sql`SELECT response FROM public_resource_action_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response;
  const claim=await sql`INSERT INTO public_resource_action_receipts(player_id,idempotency_key,node_id,response) VALUES(${player.id},${key},${plantId},'{"ok":false,"error":"action_in_progress"}'::jsonb) ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING player_id`;
  if(!claim.length){const raced=await sql`SELECT response FROM public_resource_action_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;return raced[0]?.response||{ok:false,error:'action_in_progress'};}
  const stateRows=await sql`SELECT key,value FROM world_state WHERE key IN ('ecosystem','weather_sim','forest_pressure')`;
  const state=Object.fromEntries(stateRows.map(row=>[row.key,row.value])),ecosystem=state.ecosystem||{},index=(ecosystem.plantIndividuals||[]).findIndex(plant=>String(plant.id)===plantId);
  if(index<0){const response={ok:false,error:'plant_not_found'};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${player.id} AND idempotency_key=${key}`;return response;}
  const raw=ecosystem.plantIndividuals[index],plant=normalizePlant(raw,{id:plantId,speciesId:raw.speciesId,year:Number(ecosystem.simulatedYear||0),slot:raw.slot,maxResources:1,legacyMature:true});
  const parts=ecologyRenderEntities({...ecosystem,plantIndividuals:[plant]},Date.now(),state.weather_sim,player,state.forest_pressure).filter(entity=>entity.plantId===plantId);
  const anchor=parts.find(entity=>entity.part==='blade'||entity.part==='stem')||parts[0],distance=anchor?Math.hypot(Number(player.x)-Number(anchor.x),Number(player.z)-Number(anchor.z)):Infinity;
  if(!Number.isFinite(distance)||distance>4.5){const response={ok:false,error:'resource_out_of_range'};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${player.id} AND idempotency_key=${key}`;return response;}
  const harvested=harvestPlant(plant,{amount:1,year:Number(ecosystem.simulatedYear||0),playerId:player.id});
  if(!harvested.ok){const response={ok:false,error:harvested.error,node:{nodeId:plantId,resource:'herbs',plant,remaining:Math.floor(plant.resources),max:plant.maxResources}};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${player.id} AND idempotency_key=${key}`;return response;}
  const rows=await sql`
    WITH current AS (SELECT value FROM world_state WHERE key='ecosystem' FOR UPDATE), target AS (
      SELECT value,ord-1 AS idx,individual FROM current,jsonb_array_elements(COALESCE(value->'plantIndividuals','[]'::jsonb)) WITH ORDINALITY AS items(individual,ord)
      WHERE individual->>'id'=${plantId} AND COALESCE((individual->>'resources')::numeric,0)=${Number(raw.resources||0)}::numeric
    ), changed AS (
      UPDATE world_state ws SET value=jsonb_set(target.value,ARRAY['plantIndividuals',target.idx::text],${JSON.stringify(harvested.plant)}::jsonb,false),updated_at=now()
      FROM target WHERE ws.key='ecosystem' RETURNING ws.value
    ), inventory AS (
      INSERT INTO player_inventory(player_id,wood,stone,herbs,updated_at) SELECT ${player.id},0,0,1,now() FROM changed
      ON CONFLICT(player_id) DO UPDATE SET herbs=player_inventory.herbs+1,updated_at=now() RETURNING wood,stone,herbs
    ), logged AS (
      INSERT INTO world_events(player_id,event_type,payload) SELECT ${player.id},'plant_harvested',jsonb_build_object('plantId',${plantId},'speciesId',${plant.speciesId},'amount',1,'remaining',${harvested.plant.resources}) FROM inventory RETURNING id
    ) SELECT wood,stone,herbs FROM inventory,logged`;
  const response=rows.length?{ok:true,gathered:{resource:'herbs',amount:1,nodeId:plantId},remaining:Math.floor(harvested.plant.resources),node:{nodeId:plantId,resource:'herbs',plant:harvested.plant,remaining:Math.floor(harvested.plant.resources),max:harvested.plant.maxResources},inventory:{wood:Number(rows[0].wood||0),stone:Number(rows[0].stone||0),herbs:Number(rows[0].herbs||0)}}:{ok:false,error:'plant_depleted'};
  await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${player.id} AND idempotency_key=${key}`;return response;
}

async function resourceNodes(sql,config){
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('resource_nodes','{}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
  const rows=await sql`SELECT value FROM world_state WHERE key='resource_nodes' LIMIT 1`;
  const stored=rows[0]?.value||{};
  const now=Date.now();
  const out={};
  for(const [id,cfg] of Object.entries(config)){
    const s=stored[id]||{};
    const regrowAt=s.regrowAt?Date.parse(s.regrowAt):0;
    const regrown=regrowAt>0&&regrowAt<=now&&!MOBILE_RESOURCES.has(cfg.resource);
    const generation=Number(s.generation||0)+(regrown?1:0);
    const pos=regrown?relocatedPosition(id,generation,cfg.resource):{x:s.x??null,z:s.z??null};
    const base={...s,resource:cfg.resource,max:cfg.max,remaining:regrown?cfg.max:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:regrown?null:(s.regrowAt||null),generation,x:pos.x??cfg.x??null,z:pos.z??cfg.z??null};
    out[id]=resourceLifecycle(base,{nodeId:id,resource:cfg.resource,max:cfg.max,generation,now:new Date(),legacyMature:true});
    if(JSON.stringify(s)!==JSON.stringify(out[id]))await sql`UPDATE world_state SET value=jsonb_set(value,ARRAY[${id}::text],${JSON.stringify(out[id])}::jsonb,true),updated_at=now() WHERE key='resource_nodes' AND value->${id} IS NOT DISTINCT FROM ${stored[id]?JSON.stringify(s):null}::jsonb`;
  }
  return out;
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok:false,error:'database_not_configured' },503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const config=await nodeConfig(sql);
    await ensureForestPressure(sql);
    if(req.method==='GET'){
      const url=new URL(req.url);
      const clientId=String(url.searchParams.get('clientId')||'').trim().slice(0,80);
      if(!clientId)return json({ok:false,error:'client_id_required'},400);
      const players=await sql`SELECT id,x,z FROM players WHERE client_id=${clientId} LIMIT 1`;
      const nodes=await resourceNodes(sql,config);
      if(!players.length)return json({ok:true,inventory:null,nodes});
      return json({ok:true,inventory:await getInventory(sql,players[0].id),nodes});
    }

    if(req.method==='POST'){
      const body=await req.json();
      const clientId=String(body.clientId||'').trim().slice(0,80);
      if(!clientId)return json({ok:false,error:'client_id_required'},400);
      const players=await sql`SELECT id,x,z FROM players WHERE client_id=${clientId} LIMIT 1`;
      if(!players.length)return json({ok:false,error:'player_not_registered'},409);
      if(body.action!=='gather')return json({ok:false,error:'server_authoritative_inventory'},409);
      const playerId=players[0].id;
      const nodeId=String(body.nodeId||'').trim().slice(0,80);
      const key=String(body.idempotencyKey||'').trim().slice(0,120);
      if(!key)return json({ok:false,error:'idempotency_key_required'},400);
      if(nodeId.startsWith('plant-')){const response=await gatherIndividualPlant(sql,players[0],key,nodeId);return json(response,response.ok?200:response.error==='resource_out_of_range'?403:409);}
      const cfg=config[nodeId];
      if(!cfg)return json({ok:false,error:'invalid_resource_node'},400);
      const resource=String(body.resource||'').trim().toLowerCase();
      if(resource!==cfg.resource)return json({ok:false,error:'resource_node_mismatch'},400);
      const amount=1;
      const prior=await sql`SELECT response FROM public_resource_action_receipts WHERE player_id=${playerId} AND idempotency_key=${key} LIMIT 1`;
      if(prior.length)return json(prior[0].response,prior[0].response?.ok?200:409);
      const claim=await sql`INSERT INTO public_resource_action_receipts(player_id,idempotency_key,node_id,response) VALUES(${playerId},${key},${nodeId},'{"ok":false,"error":"action_in_progress"}'::jsonb) ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING player_id`;
      if(!claim.length){const raced=await sql`SELECT response FROM public_resource_action_receipts WHERE player_id=${playerId} AND idempotency_key=${key} LIMIT 1`;return json(raced[0]?.response||{ok:false,error:'action_in_progress'},raced[0]?.response?.ok?200:409);}
      await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('resource_nodes','{}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
      const prepared=await resourceNodes(sql,config),current=prepared[nodeId];
      const px=Number(players[0].x),pz=Number(players[0].z),distance=Math.hypot(px-Number(current?.x),pz-Number(current?.z));
      if(!Number.isFinite(distance)||distance>3.4){const response={ok:false,error:'resource_out_of_range'};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${playerId} AND idempotency_key=${key}`;return json(response,403);}
      const harvested=cfg.resource==='stone'?null:harvestPlant(current.plant,{amount,year:0,playerId});
      if(harvested&&!harvested.ok){const response={ok:false,error:harvested.error,node:current,nodeId};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${playerId} AND idempotency_key=${key}`;return json(response,409);}
      const nextPlant=harvested?.plant||null;if(nextPlant?.stage==='dead')current.replacementAt=new Date(Date.now()+24*60*60*1000).toISOString();
      const result=await sql`
        WITH current AS (
          SELECT value FROM world_state WHERE key='resource_nodes' FOR UPDATE
        ), calc AS (
          SELECT value,
            CASE
              WHEN NULLIF(value->${nodeId}->>'regrowAt','') IS NOT NULL AND (value->${nodeId}->>'regrowAt')::timestamptz <= now() THEN ${cfg.max}::int
              ELSE COALESCE((value->${nodeId}->>'remaining')::int,${cfg.max}::int)
            END AS before_count
          FROM current
        ), changed AS (
          UPDATE world_state ws SET value=jsonb_set(
            calc.value,
            ARRAY[${nodeId}::text],
            jsonb_build_object(
              'resource',${cfg.resource}::text,
              'max',${cfg.max}::int,
              'remaining',CASE WHEN ${nextPlant?true:false}::boolean THEN floor(${Number(nextPlant?.resources||0)}::numeric)::int ELSE GREATEST(0,calc.before_count-${amount}::int) END,
              'regrowAt','null'::jsonb,
              'generation',COALESCE((calc.value->${nodeId}->>'generation')::int,0),
              'x',calc.value->${nodeId}->'x','z',calc.value->${nodeId}->'z',
              'plant',CASE WHEN ${nextPlant?true:false}::boolean THEN ${JSON.stringify(nextPlant)}::jsonb ELSE calc.value->${nodeId}->'plant' END,
              'replacementAt',CASE WHEN ${Boolean(nextPlant?.stage==='dead')}::boolean THEN to_jsonb(${current.replacementAt||null}::text) ELSE calc.value->${nodeId}->'replacementAt' END,
              'lastGrowthAt',to_jsonb(now())
            ),true
          ), updated_at=now()
          FROM calc WHERE ws.key='resource_nodes' AND calc.before_count>=${amount}::int
            AND (${cfg.resource==='stone'}::boolean OR COALESCE((calc.value->${nodeId}->'plant'->>'resources')::numeric,-1)=${Number(current.plant?.resources??-1)}::numeric)
          RETURNING CASE WHEN ${nextPlant?true:false}::boolean THEN floor(${Number(nextPlant?.resources||0)}::numeric)::int ELSE GREATEST(0,calc.before_count-${amount}::int) END AS remaining
        ), inv AS (
          INSERT INTO player_inventory (player_id,wood,stone,herbs,updated_at)
          SELECT ${playerId}::bigint,${cfg.resource==='wood'?1:0}::int,${cfg.resource==='stone'?1:0}::int,${cfg.resource==='herbs'?1:0}::int,now()
          FROM changed
          ON CONFLICT (player_id) DO UPDATE SET
            wood=player_inventory.wood+EXCLUDED.wood,
            stone=player_inventory.stone+EXCLUDED.stone,
            herbs=player_inventory.herbs+EXCLUDED.herbs,
            updated_at=now()
          RETURNING (SELECT remaining FROM changed LIMIT 1) AS remaining
        ), logged AS (
          INSERT INTO world_events (player_id,event_type,payload)
          SELECT ${playerId}::bigint,'resource_gathered',jsonb_build_object('resource',${cfg.resource}::text,'amount',1,'nodeId',${nodeId}::text,'remaining',remaining)
          FROM inv RETURNING id
        )
        SELECT remaining FROM inv`;
      if(!result.length){
        const nodes=await resourceNodes(sql,config);
        const node=nodes[nodeId];
        const response={ok:false,error:Number(node?.remaining)>0?'resource_changed':'resource_depleted',node,nodeId};await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${playerId} AND idempotency_key=${key}`;
        return json(response,409);
      }
      const remaining=Number(result[0].remaining||0);
      const forestPressure=cfg.resource==='wood'?await recordForestHarvest(sql,playerId,nodeId,remaining<=0):null;
      const inventory=await getInventory(sql,playerId);
      const nodes=await resourceNodes(sql,config);
      const response={ok:true,gathered:{resource:cfg.resource,amount:1,nodeId},remaining,node:nodes[nodeId],inventory,nodes,forestPressure};
      await sql`UPDATE public_resource_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${playerId} AND idempotency_key=${key}`;
      return json(response);
    }
    return json({ok:false,error:'method_not_allowed'},405);
  }catch(error){
    console.error('GPTWorld resource-state error',error);
    return json({ok:false,error:'resource_state_failed',detail:String(error?.message||error).slice(0,180)},500);
  }
};
