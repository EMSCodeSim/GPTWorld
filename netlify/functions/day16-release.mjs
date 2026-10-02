import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const DAY=16;
const ENTITIES=[
  {id:'western-firewatch-post',type:'object',x:-24.55,z:15.15,width:1.15,height:2.6,depth:1.15,color:'#795f42',label:'Western firewatch post'},
  {id:'western-firewatch-bell',type:'object',x:-24.2,z:15.05,width:.32,height:.42,depth:.32,color:'#8d7652',label:'Firewatch bell'},
  {id:'western-firewatch-path',type:'trail',points:[[-25.2,14.2],[-24.85,14.65],[-24.55,15.15]],width:.58,color:'#7c6b50',label:'Firewatch path'}
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
          WHERE e->>'id'='western-firewatch-post'
        ) RETURNING ws.value
      ), day_updated AS (
        UPDATE world_state ws SET value=jsonb_build_object('day',${DAY}::int,'era',COALESCE(day_gate.value->>'era','Founding Era')),updated_at=now()
        FROM day_gate,render_updated WHERE ws.key='current_day' RETURNING ws.value
      ), logged AS (
        INSERT INTO world_events(player_id,event_type,payload)
        SELECT NULL,'day16_western_firewatch_post_opened',jsonb_build_object(
          'day',${DAY}::int,
          'reason','the surveyed firebreak line remained unfinished while recurring wildfire risk kept the western worksite exposed',
          'project','firebreak_project',
          'visible_mark','western-firewatch-post'
        )
        FROM day_updated RETURNING id
      )
      SELECT day_updated.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM day_updated`;
    if(!result.length)return json({ok:false,error:'release_not_applied'},409);
    return json({ok:true,released:true,day:result[0].day,event_id:result[0].event_id,evolution:'western_firewatch_post'});
  }catch(error){
    console.error('GPTWorld Day 16 release failed',error);
    return json({ok:false,error:'day16_release_failed'},500);
  }
};
