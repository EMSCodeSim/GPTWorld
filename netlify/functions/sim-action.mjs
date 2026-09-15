import { neon } from '@neondatabase/serverless';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default async req=>{
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL);
 try{
  const body=await req.json();const clientId=String(body.clientId||'').trim().slice(0,80);const action=String(body.action||'').trim();if(!clientId)return json({ok:false,error:'client_id_required'},400);
  const players=await sql`SELECT id FROM players WHERE client_id=${clientId} LIMIT 1`;if(!players.length)return json({ok:false,error:'player_not_found'},404);const playerId=players[0].id;
  const recent=await sql`SELECT 1 FROM world_events WHERE player_id=${playerId} AND event_type='sim_interaction' AND created_at>now()-interval '30 seconds' LIMIT 1`;if(recent.length)return json({ok:false,error:'interaction_cooldown'},429);
  if(action==='plant_habitat'){
   const result=await sql`WITH deduct AS (UPDATE player_inventory SET herbs=herbs-1,updated_at=now() WHERE player_id=${playerId} AND herbs>=1 RETURNING herbs), eco AS (UPDATE world_state SET value=jsonb_set(value,'{species}',(SELECT jsonb_agg(CASE WHEN item->>'id'='rivergrass' THEN jsonb_set(item,'{population}',to_jsonb(COALESCE((item->>'population')::int,0)+25)) ELSE item END) FROM jsonb_array_elements(value->'species') item)),updated_at=now() WHERE key='ecosystem' AND EXISTS(SELECT 1 FROM deduct) RETURNING value), logged AS (INSERT INTO world_events(player_id,event_type,payload) SELECT ${playerId},'sim_interaction',jsonb_build_object('sim','ecology','action','plant_habitat','effect','rivergrass +25') FROM eco RETURNING id) SELECT value FROM eco`;
   if(!result.length)return json({ok:false,error:'need_one_herb'},409);return json({ok:true,sim:'ecology',message:'You planted habitat. Rivergrass population increased by 25.'});
  }
  if(action==='clear_brush'){
   const result=await sql`WITH eco AS (UPDATE world_state SET value=jsonb_set(value,'{species}',(SELECT jsonb_agg(CASE WHEN item->>'id'='thornbrush' THEN jsonb_set(item,'{population}',to_jsonb(GREATEST(50,COALESCE((item->>'population')::int,0)-20))) ELSE item END) FROM jsonb_array_elements(value->'species') item)),updated_at=now() WHERE key='ecosystem' RETURNING value), disaster AS (UPDATE world_state SET value=jsonb_set(value,'{mitigation,brushCleared}',to_jsonb(COALESCE((value#>>'{mitigation,brushCleared}')::int,0)+1),true),updated_at=now() WHERE key='disaster_sim' RETURNING value), logged AS (INSERT INTO world_events(player_id,event_type,payload) VALUES(${playerId},'sim_interaction',jsonb_build_object('sim','ecology+disaster','action','clear_brush','effect','thornbrush -20; wildfire mitigation +1')) RETURNING id) SELECT 1 FROM eco`;
   return json({ok:true,sim:'ecology+disaster',message:'You cleared dry brush. Thornbrush fell slightly and wildfire mitigation improved.'});
  }
  if(action==='respond_disaster'){
   const rows=await sql`UPDATE world_state SET value=jsonb_set(value,'{active}',COALESCE((SELECT jsonb_agg(jsonb_set(item,'{response}',to_jsonb(COALESCE((item->>'response')::int,0)+1),true)) FROM jsonb_array_elements(value->'active') item),'[]'::jsonb)),updated_at=now() WHERE key='disaster_sim' AND jsonb_array_length(COALESCE(value->'active','[]'::jsonb))>0 RETURNING value`;
   if(!rows.length)return json({ok:false,error:'no_active_disaster'},409);await sql`INSERT INTO world_events(player_id,event_type,payload) VALUES(${playerId},'sim_interaction',jsonb_build_object('sim','disaster','action','respond_disaster','effect','response +1'))`;return json({ok:true,sim:'disaster',message:'Your response effort is now affecting the active disaster.'});
  }
  return json({ok:false,error:'unknown_action'},400);
 }catch(error){console.error('GPTWorld sim action error',error);return json({ok:false,error:'sim_action_failed'},500);}
};
