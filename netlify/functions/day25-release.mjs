import {neon} from '@neondatabase/serverless';
import {DAY25,DAY25_EVENT,DAY25_ENTITIES} from '../../lib/day25-winter-firewatch.mjs';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async request=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 const token=process.env.GPTWORLD_RELEASE_TOKEN;
 if(!token||request.headers.get('authorization')!==`Bearer ${token}`)return reply({ok:false,error:'unauthorized'},401);
 if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL);
 try{
  const rows=await sql`SELECT value FROM world_state WHERE key='current_day'`;
  const current=Number(rows[0]?.value?.day||0);
  if(current===DAY25)return reply({ok:true,already_released:true,day:DAY25});
  if(current!==DAY25-1)return reply({ok:false,error:'unexpected_day',current,expected:DAY25-1},409);
  const additions=JSON.stringify(DAY25_ENTITIES);
  const ids=DAY25_ENTITIES.map(entity=>entity.id);
  const result=await sql`
   WITH gate AS (SELECT value FROM world_state WHERE key='current_day' AND (value->>'day')::int=${DAY25-1}::int FOR UPDATE),
   existing AS (SELECT value FROM world_state WHERE key='render_entities' FOR UPDATE),
   rendered AS (
    UPDATE world_state ws SET value=CASE
     WHEN jsonb_typeof(ws.value)='array' THEN ws.value||${additions}::jsonb
     WHEN jsonb_typeof(ws.value->'entities')='array' THEN jsonb_set(ws.value,'{entities}',ws.value->'entities'||${additions}::jsonb,true)
     ELSE jsonb_build_object('entities',${additions}::jsonb) END,updated_at=now()
    FROM gate,existing WHERE ws.key='render_entities'
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities' ELSE '[]'::jsonb END) e WHERE e->>'id'=ANY(${ids}::text[]))
    RETURNING ws.value
   ),
   advanced AS (UPDATE world_state ws SET value=jsonb_build_object('day',${DAY25}::int,'era',COALESCE(gate.value->>'era','Founding Era')),updated_at=now() FROM gate,rendered WHERE ws.key='current_day' RETURNING ws.value),
   logged AS (INSERT INTO world_events(player_id,event_type,payload) SELECT NULL,${DAY25_EVENT},jsonb_build_object('day',${DAY25}::int,'visible_marks',${ids}::text[],'reason','winter snowfall, dry soil and continuing wildfire risk at the existing firewatch post') FROM advanced RETURNING id)
   SELECT advanced.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM advanced`;
  if(!result.length)return reply({ok:false,error:'release_not_applied'},409);
  return reply({ok:true,released:true,day:DAY25,event_id:result[0].event_id});
 }catch(error){console.error('Day25 release failed',error);return reply({ok:false,error:'release_failed'},500);}
};
