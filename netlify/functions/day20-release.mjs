import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const DAY=20;
// With no meaningful player action, autonomous ecological loss deepens the existing Empty Meadow instead of creating a new project.
const ENTITIES=[
  {id:'empty-meadow-rewilding-grass-1',type:'vegetation',x:-38.7,z:-14.7,kind:'grass',scale:.95,label:'Tall ungrazed meadow grass'},
  {id:'empty-meadow-rewilding-grass-2',type:'vegetation',x:-39.7,z:-13.8,kind:'grass',scale:1.05,label:'Tall ungrazed meadow grass'},
  {id:'empty-meadow-rewilding-grass-3',type:'vegetation',x:-37.5,z:-13.5,kind:'grass',scale:.9,label:'Tall ungrazed meadow grass'},
  {id:'empty-meadow-rewilding-sapling-1',type:'vegetation',x:-39.4,z:-14.8,kind:'tree',scale:.38,label:'Young meadow sapling'},
  {id:'empty-meadow-rewilding-sapling-2',type:'vegetation',x:-37.9,z:-15.0,kind:'tree',scale:.32,label:'Young meadow sapling'}
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
          WHERE e->>'id'='empty-meadow-rewilding-grass-1'
        ) RETURNING ws.value
      ), day_updated AS (
        UPDATE world_state ws SET value=jsonb_build_object('day',${DAY}::int,'era',COALESCE(day_gate.value->>'era','Founding Era')),updated_at=now()
        FROM day_gate,render_updated WHERE ws.key='current_day' RETURNING ws.value
      ), logged AS (
        INSERT INTO world_events(player_id,event_type,payload)
        SELECT NULL,'day20_meadow_reclamation',jsonb_build_object(
          'day',${DAY}::int,
          'reason','player activity was quiet while autonomous ecology advanced to Year 25 with two additional extinctions',
          'visible_mark','empty-meadow-rewilding-grass-1',
          'ecology','Ungrazed vegetation is visibly reclaiming the existing Empty Meadow without changing the autonomous ecology clock.'
        ) FROM day_updated RETURNING id
      )
      SELECT day_updated.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM day_updated`;
    if(!result.length)return json({ok:false,error:'release_not_applied'},409);
    return json({ok:true,released:true,day:result[0].day,event_id:result[0].event_id,evolution:'meadow_reclamation'});
  }catch(error){
    console.error('GPTWorld Day 20 release failed',error);
    return json({ok:false,error:'day20_release_failed'},500);
  }
};
