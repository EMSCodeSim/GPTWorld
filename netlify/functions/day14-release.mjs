import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const DAY=14;
const ENTITY={id:'firebreak-workbench',type:'object',x:-28.15,z:12.55,width:1.7,height:.82,depth:.72,color:'#8a6b45',label:'Firebreak workbench'};

export default async req=>{
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const dayRows=await sql`SELECT value FROM world_state WHERE key='current_day' LIMIT 1`;
    const currentDay=Number(dayRows[0]?.value?.day||0);
    if(currentDay===DAY)return json({ok:true,already_released:true,day:DAY});
    if(currentDay!==DAY-1)return json({ok:false,error:'unexpected_world_day',current_day:currentDay,expected:DAY-1},409);
    const payload=JSON.stringify([ENTITY]);
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
          WHERE e->>'id'='firebreak-workbench'
        ) RETURNING ws.value
      ), day_updated AS (
        UPDATE world_state ws SET value=jsonb_build_object('day',${DAY}::int,'era',COALESCE(day_gate.value->>'era','Founding Era')),updated_at=now()
        FROM day_gate,render_updated WHERE ws.key='current_day' RETURNING ws.value
      ), logged AS (
        INSERT INTO world_events(player_id,event_type,payload)
        SELECT NULL,'day14_firebreak_workbench_opened',jsonb_build_object(
          'day',${DAY}::int,
          'reason','critical forest pressure and repeated material gathering kept attention on the unfinished Western Firebreak',
          'workbench','firebreak-workbench',
          'project','firebreak_project'
        )
        FROM day_updated RETURNING id
      )
      SELECT day_updated.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM day_updated`;
    if(!result.length)return json({ok:false,error:'release_not_applied'},409);
    return json({ok:true,released:true,day:result[0].day,event_id:result[0].event_id,evolution:'firebreak_workbench'});
  }catch(error){
    console.error('GPTWorld Day 14 release failed',error);
    return json({ok:false,error:'day14_release_failed'},500);
  }
};
