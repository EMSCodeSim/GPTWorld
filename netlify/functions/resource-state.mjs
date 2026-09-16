import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const DEFAULT_NODE_CONFIG = {
  'tree-0':{resource:'wood',max:6,regrowMinutes:60},'tree-1':{resource:'wood',max:6,regrowMinutes:60},'tree-2':{resource:'wood',max:6,regrowMinutes:60},'tree-3':{resource:'wood',max:6,regrowMinutes:60},'tree-4':{resource:'wood',max:6,regrowMinutes:60},'tree-5':{resource:'wood',max:6,regrowMinutes:60},'tree-6':{resource:'wood',max:6,regrowMinutes:60},'tree-7':{resource:'wood',max:6,regrowMinutes:60},'tree-8':{resource:'wood',max:6,regrowMinutes:60},'tree-9':{resource:'wood',max:6,regrowMinutes:60},'tree-10':{resource:'wood',max:6,regrowMinutes:60},'tree-11':{resource:'wood',max:6,regrowMinutes:60},'tree-12':{resource:'wood',max:6,regrowMinutes:60},'tree-13':{resource:'wood',max:6,regrowMinutes:60},'tree-14':{resource:'wood',max:6,regrowMinutes:60},'tree-15':{resource:'wood',max:6,regrowMinutes:60},'tree-16':{resource:'wood',max:6,regrowMinutes:60},'tree-17':{resource:'wood',max:6,regrowMinutes:60},'tree-18':{resource:'wood',max:6,regrowMinutes:60},'tree-19':{resource:'wood',max:6,regrowMinutes:60},'tree-20':{resource:'wood',max:6,regrowMinutes:60},'tree-21':{resource:'wood',max:6,regrowMinutes:60},'tree-22':{resource:'wood',max:6,regrowMinutes:60},
  'rock-0':{resource:'stone',max:4,regrowMinutes:90},'rock-1':{resource:'stone',max:4,regrowMinutes:90},'rock-2':{resource:'stone',max:4,regrowMinutes:90},'rock-3':{resource:'stone',max:4,regrowMinutes:90},'rock-4':{resource:'stone',max:4,regrowMinutes:90},
  'herb-0':{resource:'herbs',max:3,regrowMinutes:20},'herb-1':{resource:'herbs',max:3,regrowMinutes:20},'herb-2':{resource:'herbs',max:3,regrowMinutes:20},'herb-3':{resource:'herbs',max:3,regrowMinutes:20},'herb-4':{resource:'herbs',max:3,regrowMinutes:20}
};

const RESOURCE_DEFAULTS = {
  wood:{max:6,regrowMinutes:60},
  stone:{max:4,regrowMinutes:90},
  herbs:{max:3,regrowMinutes:20}
};

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

const forestStage=(pressure)=>pressure>=70?'critical':pressure>=45?'stressed':pressure>=20?'watched':'stable';
const forestPressureScore=(harvested,depletedSites,mitigation=0,expansion=0)=>Math.max(0,Math.min(100,harvested*2+depletedSites*8-mitigation+expansion*8));

async function ensureForestPressure(sql){
  const history=await sql`SELECT count(*)::int AS harvested, count(*) FILTER (WHERE COALESCE((payload->>'remaining')::int,1)<=0)::int AS depleted FROM world_events WHERE event_type='resource_gathered' AND payload->>'resource'='wood'`;
  const harvested=Number(history[0]?.harvested||0),depletedSites=Number(history[0]?.depleted||0),pressure=forestPressureScore(harvested,depletedSites);
  const initial={version:1,harvested,depletedSites,pressure,stage:forestStage(pressure),response:null,responseVotes:{replant:0,managed_woodlot:0,restrict_harvest:0,continue_expansion:0},mitigation:0,expansion:0,milestone:0,lastEventAt:null,lastNodeId:null};
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('forest_pressure',${JSON.stringify(initial)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
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
    await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (${playerId},'forest_pressure_changed',jsonb_build_object('from',${row.old_stage},'stage',${row.new_stage},'pressure',COALESCE(((${row.value}::jsonb)->>'pressure')::int,0),'milestone',COALESCE(((${row.value}::jsonb)->>'milestone')::int,0),'nodeId',${nodeId}))`;
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
    config[id]={
      resource,
      max:safeInt(entity.max,defaults.max,1,100),
      regrowMinutes:safeInt(entity.regrowMinutes,defaults.regrowMinutes,1,10080)
    };
  }
  return config;
}

async function getInventory(sql, playerId) {
  const rows = await sql`SELECT wood, stone, herbs, updated_at FROM player_inventory WHERE player_id = ${playerId} LIMIT 1`;
  const row = rows[0] || {};
  return { wood:Number(row.wood||0), stone:Number(row.stone||0), herbs:Number(row.herbs||0), updated_at:row.updated_at||null };
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
    const regrown=regrowAt>0&&regrowAt<=now&&MOBILE_RESOURCES.has(cfg.resource);
    const generation=Number(s.generation||0)+(regrown?1:0);
    const pos=regrown?relocatedPosition(id,generation,cfg.resource):{x:s.x??null,z:s.z??null};
    out[id]={resource:cfg.resource,max:cfg.max,remaining:regrown?cfg.max:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:regrown?null:(s.regrowAt||null),generation,x:pos.x,z:pos.z};
    if(regrown){
      await sql`UPDATE world_state SET value=jsonb_set(value,ARRAY[${id}::text],${JSON.stringify(out[id])}::jsonb,true),updated_at=now() WHERE key='resource_nodes' AND NULLIF(value->${id}->>'regrowAt','') IS NOT NULL AND (value->${id}->>'regrowAt')::timestamptz<=now()`;
    }
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
      const players=await sql`SELECT id FROM players WHERE client_id=${clientId} LIMIT 1`;
      const nodes=await resourceNodes(sql,config);
      if(!players.length)return json({ok:true,inventory:null,nodes});
      return json({ok:true,inventory:await getInventory(sql,players[0].id),nodes});
    }

    if(req.method==='POST'){
      const body=await req.json();
      const clientId=String(body.clientId||'').trim().slice(0,80);
      if(!clientId)return json({ok:false,error:'client_id_required'},400);
      const players=await sql`SELECT id FROM players WHERE client_id=${clientId} LIMIT 1`;
      if(!players.length)return json({ok:false,error:'player_not_registered'},409);
      if(body.action!=='gather')return json({ok:false,error:'server_authoritative_inventory'},409);
      const playerId=players[0].id;
      const nodeId=String(body.nodeId||'').trim().slice(0,40);
      const cfg=config[nodeId];
      if(!cfg)return json({ok:false,error:'invalid_resource_node'},400);
      const resource=String(body.resource||'').trim().toLowerCase();
      if(resource!==cfg.resource)return json({ok:false,error:'resource_node_mismatch'},400);
      const amount=1;
      await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('resource_nodes','{}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
      await resourceNodes(sql,config);
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
              'remaining',GREATEST(0,calc.before_count-${amount}::int),
              'regrowAt',CASE WHEN calc.before_count-${amount}::int<=0 AND ${MOBILE_RESOURCES.has(cfg.resource)}::boolean THEN to_jsonb(now()+(${cfg.regrowMinutes}::int||' minutes')::interval) ELSE 'null'::jsonb END,
              'generation',COALESCE((calc.value->${nodeId}->>'generation')::int,0),
              'x',calc.value->${nodeId}->'x','z',calc.value->${nodeId}->'z'
            ),true
          ), updated_at=now()
          FROM calc WHERE ws.key='resource_nodes' AND calc.before_count>=${amount}::int
          RETURNING GREATEST(0,calc.before_count-${amount}::int) AS remaining
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
        return json({ok:false,error:'resource_depleted',node,nodeId},409);
      }
      const remaining=Number(result[0].remaining||0);
      const forestPressure=cfg.resource==='wood'?await recordForestHarvest(sql,playerId,nodeId,remaining<=0):null;
      const inventory=await getInventory(sql,playerId);
      const nodes=await resourceNodes(sql,config);
      return json({ok:true,gathered:{resource:cfg.resource,amount:1,nodeId},remaining,node:nodes[nodeId],inventory,nodes,forestPressure});
    }
    return json({ok:false,error:'method_not_allowed'},405);
  }catch(error){
    console.error('GPTWorld resource-state error',error);
    return json({ok:false,error:'resource_state_failed',detail:String(error?.message||error).slice(0,180)},500);
  }
};
