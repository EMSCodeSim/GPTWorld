import {neon} from '@neondatabase/serverless';
import {DAY51,DAY51_EVENT,DAY51_ENTITIES} from '../../lib/day51-rain-gauge.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default async request=>{
 if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 const token=process.env.GPTWORLD_RELEASE_TOKEN;
 if(!token||request.headers.get('authorization')!==`Bearer ${token}`)return json({ok:false,error:'unauthorized'},401);
 if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL),ids=DAY51_ENTITIES.map(e=>e.id);
 try{
  const rows=await sql`SELECT value FROM world_state WHERE key='current_day' LIMIT 1`;
  const current=Number(rows[0]?.value?.day||0);
  if(current===DAY51){
   const check=await sql`SELECT (SELECT count(*)::int FROM world_state ws,LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities' ELSE '[]'::jsonb END) e WHERE ws.key='render_entities' AND e->>'id'=ANY(${ids}::text[])) AS marks,(SELECT count(*)::int FROM world_events WHERE event_type=${DAY51_EVENT}) AS events`;
   if(Number(check[0]?.marks)===ids.length&&Number(check[0]?.events)===1)return json({ok:true,already_released:true,day:DAY51});
   return json({ok:false,error:'partial_day51_release_requires_repair',...check[0]},409);
  }
  if(current!==DAY51-1)return json({ok:false,error:'unexpected_world_day',current_day:current,expected:DAY51-1},409);
  const additions=JSON.stringify(DAY51_ENTITIES);
  const result=await sql`
   WITH gate AS (SELECT value FROM world_state WHERE key='current_day' AND (value->>'day')::int=${DAY51-1}::int FOR UPDATE),
   finished AS (SELECT 1 FROM world_state WHERE key='firebreak_project' AND value->>'complete'='true' AND EXISTS (SELECT 1 FROM world_state watch WHERE watch.key='firebreak_watch' AND (watch.value->>'patrols')::int>=7)),
   rendered AS (UPDATE world_state ws SET value=CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value||${additions}::jsonb WHEN jsonb_typeof(ws.value->'entities')='array' THEN jsonb_set(ws.value,'{entities}',ws.value->'entities'||${additions}::jsonb,true) ELSE ws.value END,updated_at=now() FROM gate,finished WHERE ws.key='render_entities' AND (jsonb_typeof(ws.value)='array' OR jsonb_typeof(ws.value->'entities')='array') AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities' ELSE '[]'::jsonb END) e WHERE e->>'id'=ANY(${ids}::text[])) AND EXISTS (SELECT 1 FROM world_events WHERE event_type='day50_recovery_monitoring_plot_recorded') AND NOT EXISTS (SELECT 1 FROM world_events WHERE event_type=${DAY51_EVENT}) RETURNING ws.value),
   advanced AS (UPDATE world_state ws SET value=jsonb_build_object('day',${DAY51}::int,'era',COALESCE(gate.value->>'era','Founding Era')),updated_at=now() FROM gate,rendered WHERE ws.key='current_day' RETURNING ws.value),
   logged AS (INSERT INTO world_events(player_id,event_type,payload) SELECT NULL::bigint,${DAY51_EVENT}::text,jsonb_build_object('day',${DAY51}::int,'visible_marks',${ids}::text[],'reason','autumn rainfall returns to the player-influenced recovery plot') FROM advanced RETURNING id)
   SELECT advanced.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM advanced`;
  if(!result.length)return json({ok:false,error:'release_not_applied'},409);
  return json({ok:true,released:true,day:DAY51,event_id:result[0].event_id});
 }catch(error){console.error('GPTWorld Day 51 release failed',error);return json({ok:false,error:'day51_release_failed'},500);}
};
