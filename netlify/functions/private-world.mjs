import {neon} from '@neondatabase/serverless';
import {advancePrivateEcology,generatePrivateWorld,initialPrivateEcology,normalizePosition,privateResourceSeeds,privateResourceView,seedFromPlayerId} from '../lib/private-world-core.mjs';

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
  if(advanced.steps>0||advanced.upgraded){
    const nextSimulatedAt=advanced.steps>0?advanced.simulatedUntil:world.last_simulated_at;
    const rows=await sql`UPDATE player_worlds SET ecology_state=${JSON.stringify(advanced.state)}::jsonb,last_simulated_at=${nextSimulatedAt}::timestamptz,updated_at=now() WHERE id=${world.id} AND owner_player_id=${world.owner_player_id} RETURNING ecology_state,last_simulated_at,updated_at`;
    Object.assign(world,rows[0]||{});
  }
  return advanced;
}

async function ensureResources(sql,world){
  const seeds=privateResourceSeeds(world.terrain_state);
  if(seeds.length)await sql`
    INSERT INTO private_world_resources(world_id,node_id,resource_type,x,z,max_amount,remaining,generation,metadata,updated_at)
    SELECT ${world.id},node->>'nodeId',node->>'resourceType',(node->>'x')::double precision,(node->>'z')::double precision,
      (node->>'maxAmount')::int,(node->>'remaining')::int,(node->>'generation')::int,node->'metadata',now()
    FROM jsonb_array_elements(${JSON.stringify(seeds)}::jsonb) AS node
    ON CONFLICT(world_id,node_id) DO NOTHING
  `;
  await sql`
    UPDATE private_world_resources SET remaining=max_amount,regrow_at=NULL,generation=generation+1,updated_at=now()
    WHERE world_id=${world.id} AND remaining=0 AND regrow_at IS NOT NULL AND regrow_at<=now()
  `;
  const rows=await sql`
    SELECT node_id,resource_type,x,z,max_amount,remaining,regrow_at,generation
    FROM private_world_resources WHERE world_id=${world.id} ORDER BY node_id
  `;
  return privateResourceView(rows);
}

async function worldPayload(sql,player,world,catchUp,resources){
  const [sessions,placedItems]=await Promise.all([
    sql`SELECT current_world_type,private_x,private_z FROM player_world_sessions WHERE player_id=${player.id} LIMIT 1`,
    sql`SELECT item.id,item.item_key,item.display_name,item.quality,item.placed_x,item.placed_z,item.placed_rotation,item.placed_at,item.metadata,
      storage.wood AS stored_wood,storage.stone AS stored_stone,storage.herbs AS stored_herbs,storage.capacity
      FROM player_crafted_items item LEFT JOIN crafted_item_storage storage ON storage.item_id=item.id
      WHERE item.player_id=${player.id} AND item.world_id=${world.id} AND item.placed_at IS NOT NULL ORDER BY item.placed_at`
  ]);
  const session=sessions[0]||{current_world_type:'public',private_x:world.terrain_state?.spawn?.x||0,private_z:world.terrain_state?.spawn?.z||8};
  return{ok:true,world:{id:world.id,name:world.name,seed:Number(world.seed),terrain:world.terrain_state,ecology:world.ecology_state,resources,placedItems:placedItems.map(item=>({id:String(item.id),key:item.item_key,name:item.display_name,quality:item.quality,x:Number(item.placed_x),z:Number(item.placed_z),rotation:Number(item.placed_rotation||0),placedAt:item.placed_at,metadata:item.metadata||{},storage:item.item_key==='wooden-crate'?{wood:Number(item.stored_wood||0),stone:Number(item.stored_stone||0),herbs:Number(item.stored_herbs||0),capacity:Number(item.capacity||60)}:null})),lastSimulatedAt:world.last_simulated_at},session:{worldType:session.current_world_type,position:{x:Number(session.private_x),z:Number(session.private_z)}},inventory:{wood:Number(player.wood||0),stone:Number(player.stone||0),herbs:Number(player.herbs||0)},catchUp:{steps:catchUp?.steps||0,capped:Boolean(catchUp?.capped)}};
}

async function gatherResource(sql,player,world,key,nodeId){
  const prior=await sql`SELECT response FROM private_world_action_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  const claim=await sql`
    INSERT INTO private_world_action_receipts(player_id,world_id,idempotency_key,action,response)
    SELECT ${player.id},r.world_id,${key},'gather_resource','{"ok":false,"error":"pending"}'::jsonb
    FROM private_world_resources r
    JOIN player_worlds w ON w.id=r.world_id AND w.owner_player_id=${player.id}
    JOIN player_world_sessions s ON s.player_id=${player.id} AND s.private_world_id=w.id AND s.current_world_type='private'
    WHERE r.world_id=${world.id} AND r.node_id=${nodeId} AND r.remaining>0
    ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING player_id
  `;
  if(!claim.length){
    const raced=await sql`SELECT response FROM private_world_action_receipts WHERE player_id=${player.id} AND idempotency_key=${key} LIMIT 1`;
    if(raced.length)return raced[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:raced[0].response;
    const nodes=await sql`SELECT node_id,resource_type,x,z,max_amount,remaining,regrow_at,generation FROM private_world_resources WHERE world_id=${world.id} AND node_id=${nodeId} LIMIT 1`;
    return{ok:false,error:nodes.length?'resource_depleted':'invalid_resource_node',node:nodes.length?privateResourceView(nodes)[0]:null};
  }
  const rows=await sql`
    WITH target AS (
      SELECT r.id,r.world_id,r.node_id,r.resource_type,r.remaining,r.max_amount,r.regrow_at,r.generation,r.x,r.z,
        NULLIF(r.metadata->>'regrowHours','')::int AS regrow_hours
      FROM private_world_resources r
      JOIN player_worlds w ON w.id=r.world_id AND w.owner_player_id=${player.id}
      JOIN player_world_sessions s ON s.player_id=${player.id} AND s.private_world_id=w.id AND s.current_world_type='private'
      WHERE r.world_id=${world.id} AND r.node_id=${nodeId}
      FOR UPDATE OF r
    ), gathered AS (
      UPDATE private_world_resources r SET
        remaining=r.remaining-1,
        regrow_at=CASE WHEN r.remaining-1=0 AND target.regrow_hours IS NOT NULL THEN now()+(target.regrow_hours||' hours')::interval ELSE r.regrow_at END,
        updated_at=now()
      FROM target WHERE r.id=target.id AND r.remaining>0
      RETURNING r.world_id,r.node_id,r.resource_type,r.remaining,r.max_amount,r.regrow_at,r.generation,r.x,r.z
    ), inventory AS (
      INSERT INTO player_inventory(player_id,wood,stone,herbs,updated_at)
      SELECT ${player.id},CASE WHEN resource_type='wood' THEN 1 ELSE 0 END,CASE WHEN resource_type='stone' THEN 1 ELSE 0 END,CASE WHEN resource_type='herbs' THEN 1 ELSE 0 END,now() FROM gathered
      ON CONFLICT(player_id) DO UPDATE SET wood=player_inventory.wood+EXCLUDED.wood,stone=player_inventory.stone+EXCLUDED.stone,herbs=player_inventory.herbs+EXCLUDED.herbs,updated_at=now()
      RETURNING wood,stone,herbs
    ), event_record AS (
      INSERT INTO private_world_events(world_id,player_id,event_type,x,z,details)
      SELECT world_id,${player.id},'resource_gathered',x,z,jsonb_build_object('nodeId',node_id,'resource',resource_type,'amount',1,'remaining',remaining,'generation',generation) FROM gathered
      RETURNING id
    ), finalized AS (
      UPDATE private_world_action_receipts receipt SET response=CASE WHEN EXISTS(SELECT 1 FROM gathered) THEN (
        SELECT jsonb_build_object(
          'ok',true,'gathered',jsonb_build_object('resource',g.resource_type,'amount',1,'nodeId',g.node_id),
          'node',jsonb_build_object('nodeId',g.node_id,'resource',g.resource_type,'x',g.x,'z',g.z,'maxAmount',g.max_amount,'remaining',g.remaining,'regrowAt',g.regrow_at,'generation',g.generation),
          'inventory',jsonb_build_object('wood',i.wood,'stone',i.stone,'herbs',i.herbs)
        ) FROM gathered g,inventory i,event_record e
      ) ELSE (
        SELECT jsonb_build_object('ok',false,'error','resource_depleted','node',jsonb_build_object('nodeId',t.node_id,'resource',t.resource_type,'x',t.x,'z',t.z,'maxAmount',t.max_amount,'remaining',t.remaining,'regrowAt',t.regrow_at,'generation',t.generation)) FROM target t
      ) END
      WHERE receipt.player_id=${player.id} AND receipt.idempotency_key=${key}
      RETURNING receipt.response
    ) SELECT response FROM finalized
  `;
  if(rows.length)return rows[0].response;
  const failed={ok:false,error:'private_session_required'};
  await sql`UPDATE private_world_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${player.id} AND idempotency_key=${key}`;
  return failed;
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
    const resources=await ensureResources(sql,world);
    if(req.method==='GET')return reply(await worldPayload(sql,player,world,catchUp,resources));
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    const action=text(body.action,30),key=text(body.idempotencyKey,100);
    if(action==='save_position'){
      const position=normalizePosition(body.position?.x,body.position?.z,world.terrain_state?.spawn);
      const rows=await sql`UPDATE player_world_sessions SET private_x=${position.x},private_z=${position.z},updated_at=now() WHERE player_id=${player.id} AND private_world_id=${world.id} AND current_world_type='private' RETURNING player_id`;
      if(!rows.length)return reply({ok:false,error:'private_session_required'},409);
      return reply({ok:true,position});
    }
    if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
    if(action==='gather_resource'){
      const result=await gatherResource(sql,player,world,key,text(body.nodeId,80));
      return reply(result,result.ok?200:['resource_depleted','action_in_progress','private_session_required'].includes(result.error)?409:400);
    }
    if(action==='enter_private')return reply(await enterPrivate(sql,player,world,key,body.position));
    if(action==='return_public'){
      const result=await returnPublic(sql,player,key,body.position);
      return result instanceof Response?result:reply(result);
    }
    return reply({ok:false,error:'unknown_action'},400);
  }catch(error){
    console.error('GPTWorld private-world error',error);
    if(String(error?.message||'').includes('player_worlds')||String(error?.message||'').includes('private_world_')||String(error?.message||'').includes('crafted_item_storage'))return reply({ok:false,error:'living_worlds_migration_required'},503);
    return reply({ok:false,error:'private_world_failed'},500);
  }
};
