import {neon} from '@neondatabase/serverless';
import {advancePrivateEcology,generatePrivateWorld,initialPrivateEcology,normalizePosition,seedFromPlayerId} from '../lib/private-world-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const text=(value,max=80)=>String(value||'').trim().slice(0,max);

async function actor(sql,clientId){
  const rows=await sql`SELECT p.id,p.display_name,p.x,p.z,i.wood,i.stone,i.herbs FROM players p LEFT JOIN player_inventory i ON i.player_id=p.id WHERE p.client_id=${clientId} LIMIT 1`;
  return rows[0]||null;
}

async function ensureWorld(sql,player){
  const seed=seedFromPlayerId(player.id),terrain=generatePrivateWorld(seed),ecology=initialPrivateEcology(seed);
  const inserted=await sql`
    INSERT INTO player_worlds(owner_player_id,name,seed,terrain_state,ecology_state,last_simulated_at)
    VALUES(${player.id},${`${player.display_name}'s World`},${seed},${JSON.stringify(terrain)}::jsonb,${JSON.stringify(ecology)}::jsonb,now())
    ON CONFLICT(owner_player_id) DO NOTHING RETURNING id
  `;
  if(inserted.length){
    await sql`INSERT INTO private_world_events(world_id,player_id,event_type,x,z,details) VALUES(${inserted[0].id},${player.id},'world_founded',0,3,${JSON.stringify({seed})}::jsonb)`;
  }
  const rows=await sql`SELECT id,owner_player_id,name,seed,terrain_state,ecology_state,last_simulated_at,created_at,updated_at FROM player_worlds WHERE owner_player_id=${player.id} LIMIT 1`;
  return rows[0];
}

async function advanceWorld(sql,world){
  const advanced=advancePrivateEcology(world.ecology_state,world.last_simulated_at,new Date());
  if(advanced.steps>0){
    const rows=await sql`UPDATE player_worlds SET ecology_state=${JSON.stringify(advanced.state)}::jsonb,last_simulated_at=${advanced.simulatedUntil}::timestamptz,updated_at=now() WHERE id=${world.id} AND owner_player_id=${world.owner_player_id} RETURNING ecology_state,last_simulated_at,updated_at`;
    Object.assign(world,rows[0]||{});
  }
  return advanced;
}

async function worldPayload(sql,player,world,catchUp){
  const sessions=await sql`SELECT current_world_type,private_x,private_z FROM player_world_sessions WHERE player_id=${player.id} LIMIT 1`;
  const session=sessions[0]||{current_world_type:'public',private_x:world.terrain_state?.spawn?.x||0,private_z:world.terrain_state?.spawn?.z||8};
  return{ok:true,world:{id:world.id,name:world.name,seed:Number(world.seed),terrain:world.terrain_state,ecology:world.ecology_state,lastSimulatedAt:world.last_simulated_at},session:{worldType:session.current_world_type,position:{x:Number(session.private_x),z:Number(session.private_z)}},inventory:{wood:Number(player.wood||0),stone:Number(player.stone||0),herbs:Number(player.herbs||0)},catchUp:{steps:catchUp?.steps||0,capped:Boolean(catchUp?.capped)}};
}

async function enterPrivate(sql,player,world,key,position){
  const existing=await sql`SELECT response FROM world_travel_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  if(existing.length)return existing[0].response;
  const publicPosition=normalizePosition(position?.x,position?.z,{x:player.x,z:player.z});
  const response={ok:true,worldType:'private',worldId:world.id,position:world.terrain_state?.spawn||{x:0,z:8}};
  const rows=await sql`
    WITH session_change AS (
      INSERT INTO player_world_sessions(player_id,current_world_type,private_world_id,saved_public_x,saved_public_z,private_x,private_z,updated_at)
      VALUES(${player.id},'private',${world.id},${publicPosition.x},${publicPosition.z},${response.position.x},${response.position.z},now())
      ON CONFLICT(player_id) DO UPDATE SET current_world_type='private',private_world_id=EXCLUDED.private_world_id,saved_public_x=EXCLUDED.saved_public_x,saved_public_z=EXCLUDED.saved_public_z,updated_at=now()
      RETURNING player_id
    ), receipt AS (
      INSERT INTO world_travel_receipts(player_id,idempotency_key,action,response)
      SELECT player_id,${key},'enter_private',${JSON.stringify(response)}::jsonb FROM session_change
      ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  if(rows.length)return rows[0].response;
  const raced=await sql`SELECT response FROM world_travel_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  return raced[0]?.response||response;
}

async function returnPublic(sql,player,key,position){
  const existing=await sql`SELECT response FROM world_travel_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  if(existing.length)return existing[0].response;
  const privatePosition=normalizePosition(position?.x,position?.z,{x:0,z:8}),gateway={x:-29.2,z:0};
  const response={ok:true,worldType:'public',position:gateway};
  const rows=await sql`
    WITH session_change AS (
      UPDATE player_world_sessions SET current_world_type='public',private_x=${privatePosition.x},private_z=${privatePosition.z},updated_at=now()
      WHERE player_id=${player.id} RETURNING player_id
    ), player_move AS (
      UPDATE players SET x=${gateway.x},z=${gateway.z},last_seen_at=now() WHERE id=${player.id} AND EXISTS(SELECT 1 FROM session_change) RETURNING id
    ), receipt AS (
      INSERT INTO world_travel_receipts(player_id,idempotency_key,action,response)
      SELECT id,${key},'return_public',${JSON.stringify(response)}::jsonb FROM player_move
      ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  if(rows.length)return rows[0].response;
  const raced=await sql`SELECT response FROM world_travel_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  return raced[0]?.response||reply({ok:false,error:'private_session_required'},409);
}

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const url=new URL(req.url),body=req.method==='POST'?await req.json():{};
    const clientId=text(req.method==='GET'?url.searchParams.get('clientId'):body.clientId);
    if(!clientId)return reply({ok:false,error:'client_id_required'},400);
    const player=await actor(sql,clientId);
    if(!player)return reply({ok:false,error:'player_not_registered'},409);
    const world=await ensureWorld(sql,player);
    const catchUp=await advanceWorld(sql,world);
    if(req.method==='GET')return reply(await worldPayload(sql,player,world,catchUp));
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    const action=text(body.action,30),key=text(body.idempotencyKey,100);
    if(action==='save_position'){
      const position=normalizePosition(body.position?.x,body.position?.z,world.terrain_state?.spawn);
      const rows=await sql`UPDATE player_world_sessions SET private_x=${position.x},private_z=${position.z},updated_at=now() WHERE player_id=${player.id} AND private_world_id=${world.id} AND current_world_type='private' RETURNING player_id`;
      if(!rows.length)return reply({ok:false,error:'private_session_required'},409);
      return reply({ok:true,position});
    }
    if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
    if(action==='enter_private')return reply(await enterPrivate(sql,player,world,key,body.position));
    if(action==='return_public'){
      const result=await returnPublic(sql,player,key,body.position);
      return result instanceof Response?result:reply(result);
    }
    return reply({ok:false,error:'unknown_action'},400);
  }catch(error){
    console.error('GPTWorld private-world error',error);
    if(String(error?.message||'').includes('player_worlds'))return reply({ok:false,error:'living_worlds_migration_required'},503);
    return reply({ok:false,error:'private_world_failed'},500);
  }
};
