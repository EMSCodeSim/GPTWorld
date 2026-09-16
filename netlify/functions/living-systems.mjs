import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const dbUrl=()=>globalThis.Netlify?.env?.get?.('DATABASE_URL')||process.env.DATABASE_URL;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hash=(n)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
const hourMs=60*60*1000;

function weatherFor(bucket,previous={}){
  const r=hash(bucket),r2=hash(bucket+17),r3=hash(bucket+43);
  let condition='clear';
  if(r<0.16)condition='rain'; else if(r<0.25)condition='fog'; else if(r<0.31)condition='storm'; else if(r<0.57)condition='cloudy';
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

function agingState(existing={},now=Date.now()){
  const born=Number(existing.bornAt||now);
  const ageDays=Math.max(0,(now-born)/(24*hourMs));
  const rainExposure=Number(existing.rainExposure||0);
  const travel=existing.travel&&typeof existing.travel==='object'?existing.travel:{};
  const routeCells=Object.entries(travel).map(([cell,count])=>({cell,count:Number(count||0)})).sort((a,b)=>b.count-a.count).slice(0,24);
  const totalTravel=routeCells.reduce((s,r)=>s+r.count,0);
  const trailStrength=clamp(totalTravel/140,0,1);
  const structurePatina=clamp(ageDays/45+rainExposure/160,0,1);
  const forestRegrowth=clamp(ageDays/24-Math.min(totalTravel,300)/1200,0,1);
  const deterioration=clamp(ageDays/90+rainExposure/260,0,.72);
  return {...existing,version:1,bornAt:born,ageDays:Math.round(ageDays*100)/100,travel,routeCells,trailStrength,structurePatina,forestRegrowth,deterioration,updatedAt:new Date(now).toISOString()};
}

function npcState(hour,existing={},recent=[],weather={},needs={}){
  const period=hour<6?'night':hour<10?'morning':hour<17?'day':hour<21?'evening':'night';
  const profiles={
    'Mara the Keeper':{role:'Innkeeper',home:'Wayfarer Inn',traits:['social','observant'],plans:{morning:['Wayfarer Inn',2,-4,'preparing the common room'],day:['Wayfarer Inn',2,-4,'serving travelers and collecting rumors'],evening:['storehouse',4,7,'checking settlement supplies'],night:['Wayfarer Inn',2,-4,'resting at the inn']}},
    'Tovan the Smith':{role:'Smith',home:'smithy',traits:['practical','steady'],plans:{morning:['smithy',9,2,'lighting the forge'],day:['smithy',9,2,'working metal and repairing tools'],evening:['council hall',-6,5,'discussing materials and repairs'],night:['smithy',9,2,'banking the forge']}},
    'Edda the Healer':{role:'Healer',home:'healer’s cottage',traits:['careful','curious'],plans:{morning:['healer’s cottage',-4,-4,'sorting herbs and remedies'],day:['herb plots',-10,13,'gathering and studying plants'],evening:['healer’s cottage',-4,-4,'tending patients and recording remedies'],night:['healer’s cottage',-4,-4,'resting at the cottage']}}
  };
  const memoriesByNpc={...(existing.memories||{})},people={...(existing.people||{})};
  for(const [name,profile] of Object.entries(profiles)){
    const old=Array.isArray(memoriesByNpc[name])?memoriesByNpc[name]:[],seen=new Set(old.map(m=>m.event_id));
    const person=people[name]||{name,role:profile.role,home:profile.home,traits:profile.traits,relationships:{},needs:{food:.18,rest:.12,safety:.08,social:.18},knownTravelers:{}};
    person.role=profile.role;person.home=profile.home;person.traits=profile.traits;
    for(const ev of recent){if(seen.has(ev.id))continue;const type=String(ev.event_type||''),p=ev.payload||{};const relevant=name.startsWith('Mara')||(name.startsWith('Tovan')&&['bridge_contribution','western_crossing_completed','stockpile_deposit','world_aging_milestone'].includes(type))||(name.startsWith('Edda')&&['resource_gathered','gather','stockpile_deposit','ecosystem_year_advanced','weather_changed','world_aging_milestone'].includes(type));if(!relevant)continue;
      let text=type.replaceAll('_',' ');if(type==='stockpile_deposit')text=`${ev.display_name||'A traveler'} deposited ${p.amount||1} ${p.resource||'supplies'} into the storehouse.`;else if(type==='western_crossing_completed')text='The Western Crossing was completed by the settlement.';else if(type==='bridge_contribution')text=`${ev.display_name||'A traveler'} helped build the Western Crossing.`;else if(type==='resource_gathered'||type==='gather')text=`${ev.display_name||'A traveler'} gathered ${p.resource||'resources'} nearby.`;else if(type==='ecosystem_year_advanced')text=`The valley ecosystem advanced to Eco Year ${p.simulatedYear||'?'}.`;else if(type==='weather_changed')text=`The weather changed to ${p.condition||'new conditions'}.`;else if(type==='world_aging_milestone')text=`The settlement shows new signs of age: ${p.note||'time has left a mark'}.`;
      old.push({event_id:ev.id,type,text,traveler:ev.display_name||null,at:ev.created_at});seen.add(ev.id);if(ev.display_name){const k=ev.display_name,rel=person.knownTravelers[k]||{familiarity:0,helpfulActs:0};rel.familiarity=Math.min(100,rel.familiarity+8);if(['stockpile_deposit','bridge_contribution','resource_gathered','gather'].includes(type))rel.helpfulActs+=1;person.knownTravelers[k]=rel;}}
    memoriesByNpc[name]=old.slice(-12);
    const n=person.needs||{};n.food=Math.min(1,Number(n.food||0)+.025);n.rest=period==='night'?Math.max(.04,Number(n.rest||0)-.12):Math.min(1,Number(n.rest||0)+.018);n.social=Math.min(1,Number(n.social||0)+(period==='night'?.005:.012));n.safety=Math.max(.04,Number(n.safety||0)-.01);
    const badWeather=['storm'].includes(String(weather.condition||''));if(badWeather)n.safety=Math.min(1,n.safety+.42);if(String(needs.status||'')==='shortage'||String(needs.status||'')==='strained')n.food=Math.min(1,n.food+.16);person.needs=n;
    const base=profile.plans[period];let row=base,reason='routine';if(n.safety>.62){row=[profile.home,base[1],base[2],`sheltering from ${weather.condition||'dangerous conditions'}`];reason='safety';}else if(n.rest>.78){row=[profile.home,base[1],base[2],'resting after a long day'];reason='rest';}else if(n.food>.78){row=['storehouse',4,7,'looking for food and checking supplies'];reason='food';}
    person.current={period,location:row[0],x:row[1],z:row[2],activity:row[3],reason};person.updatedAt=new Date().toISOString();people[name]=person;
  }
  const routines={};for(const [name,p] of Object.entries(people)){const c=p.current;routines[name]={period:c.period,location:c.location,x:c.x,z:c.z,activity:c.activity,reason:c.reason,role:p.role,needs:p.needs,memoryCount:(memoriesByNpc[name]||[]).length};}
  return {version:2,period,updatedAt:new Date().toISOString(),routines,memories:memoriesByNpc,people};
}

export default async req=>{
  const url=dbUrl(); if(!url)return json({ok:false,error:'database_not_configured'},503);
  const sql=neon(url);
  try{
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES
      ('living_weather','{}'::jsonb,now()),
      ('settlement_needs','{"last_tick":-1,"status":"stable","score":50}'::jsonb,now()),
      ('npc_life','{"version":1,"memories":{}}'::jsonb,now()),
      ('world_aging',jsonb_build_object('version',1,'bornAt',extract(epoch from now())*1000,'travel','{}'::jsonb,'rainExposure',0,'milestones','[]'::jsonb),now())
      ON CONFLICT (key) DO NOTHING`;

    if(req.method==='POST'){
      const body=await req.json().catch(()=>({}));
      if(body.action!=='observe_travel')return json({ok:false,error:'invalid_action'},400);
      const x=clamp(Number(body.x||0),-40,40),z=clamp(Number(body.z||0),-40,40);
      const cx=Math.round(x/4),cz=Math.round(z/4),cell=`${cx},${cz}`;
      const rows=await sql`UPDATE world_state SET value=jsonb_set(value,'{travel}',COALESCE(value->'travel','{}'::jsonb) || jsonb_build_object(${cell}::text,COALESCE((value->'travel'->>${cell}::text)::int,0)+1),true),updated_at=now() WHERE key='world_aging' RETURNING value`;
      return json({ok:true,aging:agingState(rows[0]?.value||{})});
    }
    if(req.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);

    const now=Date.now(),weatherBucket=Math.floor(now/(3*hourMs)),needsBucket=Math.floor(now/(6*hourMs)),hour=new Date().getUTCHours();
    let rows=await sql`SELECT key,value FROM world_state WHERE key IN ('living_weather','settlement_needs','npc_life','settlement_stockpile','world_aging')`;
    let world=Object.fromEntries(rows.map(r=>[r.key,r.value]));

    if(Number(world.living_weather?.bucket)!==weatherBucket){
      const next=weatherFor(weatherBucket,world.living_weather||{});
      await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='living_weather'`;
      await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'weather_changed',${JSON.stringify({condition:next.condition,temperatureC:next.temperatureC,windKph:next.windKph})}::jsonb)`;
      if(next.rainfall>0){await sql`UPDATE world_state SET value=jsonb_set(value,'{rainExposure}',to_jsonb(COALESCE((value->>'rainExposure')::numeric,0)+${next.rainfall}::numeric),true),updated_at=now() WHERE key='world_aging'`;}
      world.living_weather=next;
    }

    if(Number(world.settlement_needs?.last_tick)!==needsBucket){
      const result=await sql`WITH n AS (SELECT value FROM world_state WHERE key='settlement_needs' FOR UPDATE),s AS (SELECT value FROM world_state WHERE key='settlement_stockpile' FOR UPDATE),calc AS (SELECT LEAST(4,COALESCE((s.value->>'wood')::int,0)) AS wood_use,LEAST(2,COALESCE((s.value->>'stone')::int,0)) AS stone_use,LEAST(3,COALESCE((s.value->>'herbs')::int,0)) AS herb_use,s.value AS stock,n.value AS needs FROM s,n WHERE COALESCE((n.value->>'last_tick')::bigint,-1)<>${needsBucket}::bigint),us AS (UPDATE world_state ws SET value=jsonb_build_object('wood',GREATEST(0,COALESCE((calc.stock->>'wood')::int,0)-calc.wood_use),'stone',GREATEST(0,COALESCE((calc.stock->>'stone')::int,0)-calc.stone_use),'herbs',GREATEST(0,COALESCE((calc.stock->>'herbs')::int,0)-calc.herb_use)),updated_at=now() FROM calc WHERE ws.key='settlement_stockpile' RETURNING ws.value,calc.wood_use,calc.stone_use,calc.herb_use) SELECT value,wood_use,stone_use,herb_use FROM us`;
      if(result.length){const stock=result[0].value||{},status=needsStatus(stock),next={version:1,last_tick:needsBucket,lastTickAt:new Date().toISOString(),...status,consumed:{wood:Number(result[0].wood_use||0),stone:Number(result[0].stone_use||0),herbs:Number(result[0].herb_use||0)}};await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='settlement_needs'`;await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'settlement_consumption',${JSON.stringify({consumed:next.consumed,status:next.status,score:next.score})}::jsonb)`;world.settlement_stockpile=stock;world.settlement_needs=next;}
    }

    rows=await sql`SELECT key,value FROM world_state WHERE key IN ('world_aging')`; world.world_aging=rows[0]?.value||{};
    let aging=agingState(world.world_aging,now);
    const milestone=Math.floor(aging.ageDays/7);
    const seen=Array.isArray(aging.milestones)?aging.milestones:[];
    if(milestone>0&&!seen.includes(milestone)){
      const note=aging.trailStrength>.25?'frequently traveled ground has begun to form visible trails':aging.forestRegrowth>.15?'young growth is returning at the settlement edges':'wood and stone are beginning to weather';
      aging={...aging,milestones:[...seen,milestone].slice(-20)};
      await sql`UPDATE world_state SET value=${JSON.stringify(aging)}::jsonb,updated_at=now() WHERE key='world_aging'`;
      await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'world_aging_milestone',${JSON.stringify({milestone,note})}::jsonb)`;
    }

    const recent=await sql`SELECT we.id,we.event_type,we.payload,we.created_at,p.display_name FROM world_events we LEFT JOIN players p ON p.id=we.player_id ORDER BY we.created_at DESC LIMIT 40`;
    const nextNpc=npcState(hour,world.npc_life||{},recent.reverse(),world.living_weather||{},world.settlement_needs||{}); await sql`UPDATE world_state SET value=${JSON.stringify(nextNpc)}::jsonb,updated_at=now() WHERE key='npc_life'`; world.npc_life=nextNpc;
    return json({ok:true,weather:world.living_weather,needs:world.settlement_needs,npcs:world.npc_life,aging,stockpile:world.settlement_stockpile||{}});
  }catch(err){console.error('living systems error',err);return json({ok:false,error:'living_systems_failed',detail:String(err?.message||err).slice(0,180)},500)}
};
