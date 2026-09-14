import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const dbUrl=()=>globalThis.Netlify?.env?.get?.('DATABASE_URL')||process.env.DATABASE_URL;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hash=(n)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};

function weatherFor(bucket,previous={}){
  const r=hash(bucket),r2=hash(bucket+17),r3=hash(bucket+43);
  let condition='clear';
  if(r<0.16)condition='rain';
  else if(r<0.25)condition='fog';
  else if(r<0.31)condition='storm';
  else if(r<0.57)condition='cloudy';
  const temperatureC=Math.round((10+r2*11)*10)/10;
  const wind=Math.round((2+r3*18)*10)/10;
  const rainfall=condition==='storm'?0.9:condition==='rain'?0.55:condition==='fog'?0.12:0;
  return {version:1,bucket,condition,temperatureC,windKph:wind,rainfall,lastChangedAt:new Date().toISOString(),previous:previous.condition||null};
}

function needsStatus(stock){
  const wood=Number(stock.wood||0),stone=Number(stock.stone||0),herbs=Number(stock.herbs||0);
  const score=clamp(Math.round((Math.min(wood,80)+Math.min(stone,60)+Math.min(herbs,40))/1.8),0,100);
  return {wood,stone,herbs,score,status:score>=75?'well supplied':score>=40?'stable':score>=20?'strained':'shortage'};
}

function npcState(hour,existing={},recent=[]){
  const period=hour<6?'night':hour<10?'morning':hour<17?'day':hour<21?'evening':'night';
  const plans={
    'Mara the Keeper':{morning:['Wayfarer Inn',2,-4,'preparing the common room'],day:['Wayfarer Inn',2,-4,'serving travelers and collecting rumors'],evening:['storehouse',4,7,'checking settlement supplies'],night:['Wayfarer Inn',2,-4,'resting at the inn']},
    'Tovan the Smith':{morning:['smithy',9,2,'lighting the forge'],day:['smithy',9,2,'working metal and repairing tools'],evening:['council hall',-6,5,'discussing materials and repairs'],night:['smithy',9,2,'banking the forge']},
    'Edda the Healer':{morning:['healer’s cottage',-4,-4,'sorting herbs and remedies'],day:['herb plots',-10,13,'gathering and studying plants'],evening:['healer’s cottage',-4,-4,'tending patients and recording remedies'],night:['healer’s cottage',-4,-4,'resting at the cottage']}
  };
  const memoriesByNpc={...existing.memories};
  for(const name of Object.keys(plans)){
    const old=Array.isArray(memoriesByNpc[name])?memoriesByNpc[name]:[];
    const seen=new Set(old.map(m=>m.event_id));
    for(const ev of recent){
      if(seen.has(ev.id))continue;
      const type=String(ev.event_type||'');
      const relevant=name.startsWith('Mara')||
        (name.startsWith('Tovan')&&['bridge_contribution','western_crossing_completed','stockpile_deposit'].includes(type))||
        (name.startsWith('Edda')&&(['resource_gathered','gather','stockpile_deposit','ecosystem_year_advanced'].includes(type)));
      if(!relevant)continue;
      const p=ev.payload||{};
      let text=type.replaceAll('_',' ');
      if(type==='stockpile_deposit')text=`${ev.display_name||'A traveler'} deposited ${p.amount||1} ${p.resource||'supplies'} into the storehouse.`;
      else if(type==='western_crossing_completed')text='The Western Crossing was completed by the settlement.';
      else if(type==='bridge_contribution')text=`${ev.display_name||'A traveler'} helped build the Western Crossing.`;
      else if(type==='resource_gathered'||type==='gather')text=`${ev.display_name||'A traveler'} gathered ${p.resource||'resources'} nearby.`;
      else if(type==='ecosystem_year_advanced')text=`The valley ecosystem advanced to Eco Year ${p.simulatedYear||'?'}.`;
      old.push({event_id:ev.id,text,at:ev.created_at});
      seen.add(ev.id);
    }
    memoriesByNpc[name]=old.slice(-8);
  }
  const routines={};
  for(const [name,p] of Object.entries(plans)){
    const row=p[period];
    routines[name]={period,location:row[0],x:row[1],z:row[2],activity:row[3],memoryCount:(memoriesByNpc[name]||[]).length};
  }
  return {version:1,period,updatedAt:new Date().toISOString(),routines,memories:memoriesByNpc};
}

export default async req=>{
  if(req.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
  const url=dbUrl();
  if(!url)return json({ok:false,error:'database_not_configured'},503);
  const sql=neon(url);
  try{
    const now=Date.now();
    const weatherBucket=Math.floor(now/(3*60*60*1000));
    const needsBucket=Math.floor(now/(6*60*60*1000));
    const hour=new Date().getUTCHours();
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES
      ('living_weather','{}'::jsonb,now()),
      ('settlement_needs','{"last_tick":-1,"status":"stable","score":50}'::jsonb,now()),
      ('npc_life','{"version":1,"memories":{}}'::jsonb,now())
      ON CONFLICT (key) DO NOTHING`;

    let rows=await sql`SELECT key,value FROM world_state WHERE key IN ('living_weather','settlement_needs','npc_life','settlement_stockpile')`;
    let world=Object.fromEntries(rows.map(r=>[r.key,r.value]));

    if(Number(world.living_weather?.bucket)!==weatherBucket){
      const next=weatherFor(weatherBucket,world.living_weather||{});
      await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='living_weather'`;
      await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'weather_changed',${JSON.stringify({condition:next.condition,temperatureC:next.temperatureC,windKph:next.windKph})}::jsonb)`;
      world.living_weather=next;
    }

    if(Number(world.settlement_needs?.last_tick)!==needsBucket){
      const result=await sql`
        WITH n AS (SELECT value FROM world_state WHERE key='settlement_needs' FOR UPDATE),
        s AS (SELECT value FROM world_state WHERE key='settlement_stockpile' FOR UPDATE),
        calc AS (
          SELECT LEAST(4,COALESCE((s.value->>'wood')::int,0)) AS wood_use,
                 LEAST(2,COALESCE((s.value->>'stone')::int,0)) AS stone_use,
                 LEAST(3,COALESCE((s.value->>'herbs')::int,0)) AS herb_use,
                 s.value AS stock,n.value AS needs
          FROM s,n WHERE COALESCE((n.value->>'last_tick')::bigint,-1)<>${needsBucket}::bigint
        ), us AS (
          UPDATE world_state ws SET value=jsonb_build_object(
            'wood',GREATEST(0,COALESCE((calc.stock->>'wood')::int,0)-calc.wood_use),
            'stone',GREATEST(0,COALESCE((calc.stock->>'stone')::int,0)-calc.stone_use),
            'herbs',GREATEST(0,COALESCE((calc.stock->>'herbs')::int,0)-calc.herb_use)
          ),updated_at=now() FROM calc WHERE ws.key='settlement_stockpile' RETURNING ws.value,calc.wood_use,calc.stone_use,calc.herb_use
        )
        SELECT value,wood_use,stone_use,herb_use FROM us`;
      if(result.length){
        const stock=result[0].value||{};
        const status=needsStatus(stock);
        const next={version:1,last_tick:needsBucket,lastTickAt:new Date().toISOString(),...status,consumed:{wood:Number(result[0].wood_use||0),stone:Number(result[0].stone_use||0),herbs:Number(result[0].herb_use||0)}};
        await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='settlement_needs'`;
        await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'settlement_consumption',${JSON.stringify({consumed:next.consumed,status:next.status,score:next.score})}::jsonb)`;
        world.settlement_stockpile=stock;world.settlement_needs=next;
      }
    }

    const recent=await sql`SELECT we.id,we.event_type,we.payload,we.created_at,p.display_name FROM world_events we LEFT JOIN players p ON p.id=we.player_id ORDER BY we.created_at DESC LIMIT 40`;
    const nextNpc=npcState(hour,world.npc_life||{},recent.reverse());
    await sql`UPDATE world_state SET value=${JSON.stringify(nextNpc)}::jsonb,updated_at=now() WHERE key='npc_life'`;
    world.npc_life=nextNpc;

    return json({ok:true,weather:world.living_weather,needs:world.settlement_needs,npcs:world.npc_life,stockpile:world.settlement_stockpile||{}});
  }catch(err){console.error('living systems error',err);return json({ok:false,error:'living_systems_failed',detail:String(err?.message||err).slice(0,180)},500)}
};
