import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const DAY=17;
// Day 17 turns recent player contributions to the community blacksmith into persistent visible construction evidence.
const ENTITIES=[
  {id:'blacksmith-material-yard',type:'trail',points:[[11.8,4.4],[13.2,4.8],[15.0,4.7],[16.2,4.0]],width:.7,color:'#75654f',label:'Blacksmith material yard'},
  {id:'blacksmith-timber-stack',type:'object',x:15.4,z:4.5,width:2.2,height:.72,depth:1.05,color:'#7d5b3d',label:'Blacksmith timber stack'},
  {id:'blacksmith-stone-pile',type:'object',x:16.25,z:3.45,width:1.35,height:.82,depth:1.25,color:'#6f6b63',label:'Blacksmith stone pile'},
  {id:'blacksmith-supply-crate',type:'object',x:14.2,z:4.9,width:.8,height:.7,depth:.8,color:'#8a6b45',label:'Blacksmith supply crate'}
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
          WHERE e->>'id'='blacksmith-material-yard'
        ) RETURNING ws.value
      ), day_updated AS (
        UPDATE world_state ws SET value=jsonb_build_object('day',${DAY}::int,'era',COALESCE(day_gate.value->>'era','Founding Era')),updated_at=now()
        FROM day_gate,render_updated WHERE ws.key='current_day' RETURNING ws.value
      ), logged AS (
        INSERT INTO world_events(player_id,event_type,payload)
        SELECT NULL,'day17_blacksmith_material_yard_opened',jsonb_build_object(
          'day',${DAY}::int,
          'reason','recent player gathering and repeated contributions to the community blacksmith left enough delivered material to visibly reshape the construction site',
          'project','blacksmith',
          'visible_mark','blacksmith-material-yard'
        )
        FROM day_updated RETURNING id
      )
      SELECT day_updated.value AS day,(SELECT id FROM logged LIMIT 1) AS event_id FROM day_updated`;
    if(!result.length)return json({ok:false,error:'release_not_applied'},409);
    return json({ok:true,released:true,day:result[0].day,event_id:result[0].event_id,evolution:'blacksmith_material_yard'});
  }catch(error){
    console.error('GPTWorld Day 17 release failed',error);
    return json({ok:false,error:'day17_release_failed'},500);
  }
};
