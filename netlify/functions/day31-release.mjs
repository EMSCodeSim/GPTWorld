import {neon} from '@neondatabase/serverless';
import {DAY31,DAY31_EVENT,DAY31_ENTITIES} from '../../lib/day31-burn-scar-rainwash.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default async request=>{
 if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 const token=process.env.GPTWORLD_RELEASE_TOKEN;
 if(!token||request.headers.get('authorization')!==`Bearer ${token}`)return json({ok:false,error:'unauthorized'},401);
 if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL);
 try{
  const rows=await sql`SELECT value FROM world_state WHERE key='current_day' LIMIT 1`;
  const current=Number(rows[0]?.value?.day||0);
  const ids=DAY31_ENTITIES.map(e=>e.id);
  if(current===DAY31){
   const verified=await sql`
    SELECT (SELECT count(*)::int FROM world_state ws,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value
       WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities'
       ELSE '[]'::jsonb END) e
      WHERE ws.key='render_entities' AND e->>'id'=ANY(${ids}::text[])) AS marks,
      (SELECT count(*)::int FROM world_events WHERE event_type=${DAY31_EVENT}) AS events`;
   if(verified[0]?.marks===ids.length&&verified[0]?.events===1)return json({ok:true,already_released:true,day:DAY31});
   return json({ok:false,error:'partial_day31_release_requires_repair',...verified[0]},409);
  }
  if(current!==DAY31-1)return json({ok:false,error:'unexpected_world_day',current_day:current,expected:DAY31-1},409);
  const additions=JSON.stringify(DAY31_ENTITIES);
  const result=await sql`
   WITH gate AS (
    SELECT value FROM world_state WHERE key='current_day'
     AND (value->>'day')::int=${DAY31-1}::int FOR UPDATE
   ), existing AS (
    SELECT value FROM world_state WHERE key='render_entities' FOR UPDATE
   ), rendered AS (
    UPDATE world_state ws SET value=CASE
     WHEN jsonb_typeof(ws.value)='array' THEN ws.value||${additions}::jsonb
     WHEN jsonb_typeof(ws.value->'entities')='array' THEN jsonb_set(ws.value,'{entities}',ws.value->'entities'||${additions}::jsonb,true)
     ELSE jsonb_build_object('entities',${additions}::jsonb)
    END,updated_at=now()
    FROM gate,existing WHERE ws.key='render_entities'
     AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE
       WHEN jsonb_typeof(ws.value)='array' THEN ws.value
       WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities'
       ELSE '[]'::jsonb END) e WHERE e->>'id'=ANY(${ids}::text[])
     )
     AND NOT EXISTS (SELECT 1 FROM world_events WHERE event_type=${DAY31_EVENT})
    RETURNING ws.value
   ), advanced AS (
    UPDATE world_state ws SET value=jsonb_build_object('day',${DAY31}::int,
     'era',COALESCE(gate.value->>'era','Founding Era')),updated_at=now()
    FROM gate,rendered WHERE ws.key='current_day' RETURNING ws.value
   ), logged AS (
    INSERT INTO world_events(player_id,event_type,payload)
    SELECT NULL,${DAY31_EVENT},jsonb_build_object('day',${DAY31}::int,
      'visible_marks',${ids}::text[],
      'reason','wildfire-1008 ended after spring rain while drought remained high, forest pressure critical, and the unfinished firebreak unfunded')
    FROM advanced RETURNING id
   )
   SELECT advanced.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM advanced`;
  if(!result.length)return json({ok:false,error:'release_not_applied'},409);
  return json({ok:true,released:true,day:DAY31,event_id:result[0].event_id});
 }catch(error){console.error('GPTWorld Day 31 release failed',error);return json({ok:false,error:'day31_release_failed'},500);}
};
