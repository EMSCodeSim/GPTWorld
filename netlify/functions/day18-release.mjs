import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const DAY=18;
// Continued player contributions deepen the existing blacksmith build without completing it for players.
const ENTITIES=[
  {id:'blacksmith-framing-bench',type:'object',x:12.7,z:4.15,width:1.9,height:.82,depth:.72,color:'#8a6b45',label:'Blacksmith framing bench'},
  {id:'blacksmith-frame-post-1',type:'object',x:12.15,z:2.0,width:.22,height:2.35,depth:.22,color:'#795f42',label:'Blacksmith frame post'},
  {id:'blacksmith-frame-post-2',type:'object',x:14.85,z:2.0,width:.22,height:2.35,depth:.22,color:'#795f42',label:'Blacksmith frame post'},
  {id:'blacksmith-frame-beam',type:'object',x:13.5,z:2.0,width:3.0,height:.24,depth:.24,color:'#795f42',label:'Blacksmith framing beam'}
];

export default async req=>{
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const dayRows=await sql`SELECT value FROM world_state WHERE key='current_day' LIMIT 1`;
    const currentDay=Number(dayRows[0]?.value?.day||0);
    if(currentDay===DAY)return json({ok:true,already_released:true,day:DAY});
    if(currentDay!==DAY-1)return json({ok:false,error:'unexpected_world_day',current_day:currentDay,expected:DAY-1},409);
    const payload=JSON.stringify(ENTITIES);
    const result=await sql`
      WITH day_gate AS (
        SELECT value FROM world_state WHERE key='current_day' AND COALESCE((value->>'day')::int,0)=${DAY-1}::int FOR UPDATE
      ), render_locked AS (
        SELECT value FROM world_state WHERE key='render_entities' FOR UPDATE
      ), render_updated AS (
        UPDATE world_state ws SET value=CASE
          WHEN jsonb_typeof(ws.value)='array' THEN ws.value||${payload}::jsonb
          WHEN jsonb_typeof(ws.value->'entities')='array' THEN jsonb_set(ws.value,'{entities}',(ws.value->'entities')||${payload}::jsonb,true)
          ELSE jsonb_build_object('entities',${payload}::jsonb)
        END,updated_at=now()
        FROM day_gate,render_locked
        WHERE ws.key='render_entities' AND NOT EXISTS(
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities' ELSE '[]'::jsonb END) e
          WHERE e->>'id'='blacksmith-framing-bench'
        ) RETURNING ws.value
      ), day_updated AS (
        UPDATE world_state ws SET value=jsonb_build_object('day',${DAY}::int,'era',COALESCE(day_gate.value->>'era','Founding Era')),updated_at=now()
        FROM day_gate,render_updated WHERE ws.key='current_day' RETURNING ws.value
      ), logged AS (
        INSERT INTO world_events(player_id,event_type,payload)
        SELECT NULL,'day18_blacksmith_framing_started',jsonb_build_object(
          'day',${DAY}::int,
          'reason','two active travelers continued feeding wood, stone, coins, herbs, and shared supplies into the settlement while the blacksmith remained under construction',
          'project','blacksmith',
          'visible_mark','blacksmith-framing-bench'
        ) FROM day_updated RETURNING id
      )
      SELECT day_updated.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM day_updated`;
    if(!result.length)return json({ok:false,error:'release_not_applied'},409);
    return json({ok:true,released:true,day:result[0].day,event_id:result[0].event_id,evolution:'blacksmith_framing_started'});
  }catch(error){
    console.error('GPTWorld Day 18 release failed',error);
    return json({ok:false,error:'day18_release_failed'},500);
  }
};
