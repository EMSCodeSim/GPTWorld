import {neon} from '@neondatabase/serverless';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const day=21;
const entities=[{id:'day21-blacksmith-stone-yard',type:'resource',resource:'stone',x:10.5,z:12.5,max:5,scale:.85,regrowMinutes:90},{id:'day21-blacksmith-salvage-marker',type:'object',x:9.8,z:12.5,width:.35,height:1.5,depth:.35,color:'#806a51'}];
export default async req=>{
 if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 const secret=process.env.GPTWORLD_RELEASE_TOKEN;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return reply({ok:false,error:'unauthorized'},401);
 if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL);
 try{
  const rows=await sql`SELECT value FROM world_state WHERE key='current_day'`;
  const current=Number(rows[0]?.value?.day||0);
  if(current===day)return reply({ok:true,already_released:true,day});
  if(current!==day-1)return reply({ok:false,error:'unexpected_day',current,expected:day-1},409);
  const additions=JSON.stringify(entities);
  const result=await sql`WITH gate AS (SELECT value FROM world_state WHERE key='current_day' AND (value->>'day')::int=${day-1}::int FOR UPDATE), existing AS (SELECT value FROM world_state WHERE key='render_entities' FOR UPDATE), rendered AS (UPDATE world_state ws SET value=CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value||${additions}::jsonb WHEN jsonb_typeof(ws.value->'entities')='array' THEN jsonb_set(ws.value,'{entities}',ws.value->'entities'||${additions}::jsonb,true) ELSE jsonb_build_object('entities',${additions}::jsonb) END,updated_at=now() FROM gate,existing WHERE ws.key='render_entities' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ws.value)='array' THEN ws.value WHEN jsonb_typeof(ws.value->'entities')='array' THEN ws.value->'entities' ELSE '[]'::jsonb END) e WHERE e->>'id'='day21-blacksmith-stone-yard') RETURNING ws.value), advanced AS (UPDATE world_state ws SET value=jsonb_build_object('day',${day}::int,'era',COALESCE(gate.value->>'era','Founding Era')),updated_at=now() FROM gate,rendered WHERE ws.key='current_day' RETURNING ws.value), logged AS (INSERT INTO world_events(player_id,event_type,payload) SELECT NULL,'day21_blacksmith_stone_salvage',jsonb_build_object('day',${day}::int,'visible_mark','day21-blacksmith-stone-yard','reason','recent stone gathering and construction contributions') FROM advanced RETURNING id) SELECT advanced.value AS day FROM advanced`;
  if(!result.length)return reply({ok:false,error:'release_not_applied'},409);
  return reply({ok:true,released:true,day:21,evolution:'blacksmith_stone_salvage'});
 }catch(error){console.error('Day21 release',error);return reply({ok:false,error:'release_failed'},500);}
};
