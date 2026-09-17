import {neon} from '@neondatabase/serverless';
import {CRAFTING_RECIPES,craftingChance,craftingRecipe,qualityDurability,resolveCraftAttempt,spentInputs} from '../lib/crafting-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(value,max=100)=>String(value||'').trim().slice(0,max);

async function context(sql,clientId){
  const rows=await sql`
    SELECT p.id,p.display_name,i.wood,i.stone,i.herbs,w.id AS world_id,s.current_world_type
    FROM players p
    LEFT JOIN player_inventory i ON i.player_id=p.id
    LEFT JOIN player_worlds w ON w.owner_player_id=p.id
    LEFT JOIN player_world_sessions s ON s.player_id=p.id
    WHERE p.client_id=${clientId} LIMIT 1
  `;
  return rows[0]||null;
}

async function ensureSkills(sql,playerId){
  await sql`
    INSERT INTO player_crafting_skills(player_id,skill_key)
    SELECT ${playerId},skill_key FROM (VALUES ('carpentry'),('masonry'),('herbalism')) AS skills(skill_key)
    ON CONFLICT(player_id,skill_key) DO NOTHING
  `;
}

async function payload(sql,actor){
  await ensureSkills(sql,actor.id);
  const [skills,items]=await Promise.all([
    sql`SELECT skill_key,skill_value,attempts FROM player_crafting_skills WHERE player_id=${actor.id} ORDER BY skill_key`,
    sql`SELECT id,item_key,display_name,profession,quality,durability,max_durability,maker_name,crafted_at,placed_x,placed_z,placed_rotation,placed_at FROM player_crafted_items WHERE player_id=${actor.id} ORDER BY crafted_at DESC LIMIT 60`
  ]);
  const skillMap=new Map(skills.map(skill=>[skill.skill_key,Number(skill.skill_value)]));
  return{
    ok:true,
    recipes:CRAFTING_RECIPES.map(recipe=>({...recipe,chance:craftingChance(skillMap.get(recipe.skill)||0,recipe.difficulty)})),
    skills:skills.map(skill=>({key:skill.skill_key,value:Number(skill.skill_value),attempts:Number(skill.attempts)})),
    items:items.map(item=>({id:String(item.id),key:item.item_key,name:item.display_name,profession:item.profession,quality:item.quality,durability:Number(item.durability),maxDurability:Number(item.max_durability),maker:item.maker_name,craftedAt:item.crafted_at,placed:item.placed_at?{x:Number(item.placed_x),z:Number(item.placed_z),rotation:Number(item.placed_rotation||0),placedAt:item.placed_at}:null})),
    inventory:{wood:Number(actor.wood||0),stone:Number(actor.stone||0),herbs:Number(actor.herbs||0)}
  };
}

async function moveItem(sql,actor,itemId,key,action,position={}){
  const prior=await sql`SELECT response FROM crafted_item_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response;
  const x=Math.max(-32,Math.min(32,Number(position.x)||0)),z=Math.max(-32,Math.min(32,Number(position.z)||0)),rotation=Number(position.rotation)||0;
  const rows=action==='place_item'?await sql`
    WITH moved AS (
      UPDATE player_crafted_items item SET placed_x=${x},placed_z=${z},placed_rotation=${rotation},placed_at=now()
      FROM player_world_sessions session
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.world_id=session.private_world_id
        AND session.player_id=${actor.id} AND session.current_world_type='private' AND item.placed_at IS NULL
        AND sqrt(power(session.private_x-${x},2)+power(session.private_z-${z},2))<=7
      RETURNING item.id,item.item_key,item.display_name,item.quality,item.placed_x,item.placed_z,item.placed_rotation,item.placed_at
    ), receipt AS (
      INSERT INTO crafted_item_action_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},${action},jsonb_build_object('ok',true,'action',${action}::text,'item',jsonb_build_object('id',id::text,'key',item_key,'name',display_name,'quality',quality,'placed',jsonb_build_object('x',placed_x,'z',placed_z,'rotation',placed_rotation,'placedAt',placed_at))) FROM moved
      ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `:await sql`
    WITH moved AS (
      UPDATE player_crafted_items item SET placed_x=NULL,placed_z=NULL,placed_rotation=NULL,placed_at=NULL
      FROM player_world_sessions session
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.world_id=session.private_world_id
        AND session.player_id=${actor.id} AND session.current_world_type='private' AND item.placed_at IS NOT NULL
        AND sqrt(power(session.private_x-item.placed_x,2)+power(session.private_z-item.placed_z,2))<=5
      RETURNING item.id,item.item_key,item.display_name,item.quality
    ), receipt AS (
      INSERT INTO crafted_item_action_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},${action},jsonb_build_object('ok',true,'action',${action}::text,'item',jsonb_build_object('id',id::text,'key',item_key,'name',display_name,'quality',quality,'placed',NULL)) FROM moved
      ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  return rows[0]?.response||{ok:false,error:action==='place_item'?'item_cannot_be_placed':'item_cannot_be_picked_up'};
}

async function craft(sql,actor,recipe,key){
  const prior=await sql`SELECT response FROM crafting_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  const input=recipe.inputs;
  const claimed=await sql`
    INSERT INTO crafting_action_receipts(player_id,world_id,idempotency_key,recipe_key,response)
    SELECT ${actor.id},w.id,${key},${recipe.key},'{"ok":false,"error":"pending"}'::jsonb
    FROM player_worlds w
    JOIN player_world_sessions s ON s.player_id=${actor.id} AND s.private_world_id=w.id AND s.current_world_type='private'
    JOIN player_inventory i ON i.player_id=${actor.id}
    WHERE w.owner_player_id=${actor.id} AND i.wood>=${input.wood} AND i.stone>=${input.stone} AND i.herbs>=${input.herbs}
    ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING world_id
  `;
  if(!claimed.length){
    const raced=await sql`SELECT response FROM crafting_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
    if(raced.length)return raced[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:raced[0].response;
    return{ok:false,error:actor.current_world_type==='private'?'insufficient_materials':'private_world_required'};
  }
  await ensureSkills(sql,actor.id);
  const skillRows=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key=${recipe.skill} LIMIT 1`;
  const skillBefore=Number(skillRows[0]?.skill_value||0),outcome=resolveCraftAttempt({skillValue:skillBefore,difficulty:recipe.difficulty,key:`${actor.id}:${recipe.key}:${key}`});
  const spent=spentInputs(recipe,outcome.success),durability=qualityDurability(recipe.durability,outcome.quality);
  let rows;
  try{rows=await sql`
    WITH inventory_change AS (
      UPDATE player_inventory SET wood=wood-${spent.wood},stone=stone-${spent.stone},herbs=herbs-${spent.herbs},updated_at=now()
      WHERE player_id=${actor.id} AND wood>=${spent.wood} AND stone>=${spent.stone} AND herbs>=${spent.herbs}
      RETURNING wood,stone,herbs
    ), skill_change AS (
      UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${outcome.skillGain}),attempts=attempts+1,updated_at=now()
      WHERE player_id=${actor.id} AND skill_key=${recipe.skill} AND EXISTS(SELECT 1 FROM inventory_change)
      RETURNING skill_value,attempts
    ), made_item AS (
      INSERT INTO player_crafted_items(player_id,world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata)
      SELECT ${actor.id},${claimed[0].world_id},${recipe.key},${recipe.name},${recipe.skill},${outcome.quality||'standard'},${durability},${durability},${actor.display_name},${JSON.stringify({recipe:recipe.key,inputs:recipe.inputs,chance:outcome.chance})}::jsonb
      FROM inventory_change WHERE ${outcome.success}
      RETURNING id,item_key,display_name,profession,quality,durability,max_durability,maker_name,crafted_at
    ), history AS (
      INSERT INTO private_world_events(world_id,player_id,event_type,x,z,details)
      SELECT ${claimed[0].world_id},${actor.id},CASE WHEN ${outcome.success} THEN 'item_crafted' ELSE 'craft_failed' END,NULL,NULL,
        jsonb_build_object('recipeKey',${recipe.key}::text,'item',${recipe.name}::text,'profession',${recipe.skill}::text,'quality',${outcome.quality}::text,'chance',${outcome.chance}::numeric,'materialsSpent',${JSON.stringify(spent)}::jsonb)
      FROM inventory_change,skill_change RETURNING id
    ), finalized AS (
      UPDATE crafting_action_receipts receipt SET response=(
        SELECT jsonb_build_object(
          'ok',true,'success',${outcome.success}::boolean,'recipeKey',${recipe.key}::text,'quality',${outcome.quality}::text,'chance',${outcome.chance}::numeric,
          'materialsSpent',${JSON.stringify(spent)}::jsonb,
          'inventory',jsonb_build_object('wood',inventory_change.wood,'stone',inventory_change.stone,'herbs',inventory_change.herbs),
          'skill',jsonb_build_object('key',${recipe.skill}::text,'before',${skillBefore}::numeric,'value',skill_change.skill_value,'gain',${outcome.skillGain}::numeric,'attempts',skill_change.attempts),
          'item',(SELECT jsonb_build_object('id',id::text,'key',item_key,'name',display_name,'profession',profession,'quality',quality,'durability',durability,'maxDurability',max_durability,'maker',maker_name,'craftedAt',crafted_at) FROM made_item)
        ) FROM inventory_change,skill_change,history
      )
      WHERE receipt.player_id=${actor.id} AND receipt.idempotency_key=${key}
      RETURNING response
    ) SELECT response FROM finalized
  `;}catch(error){
    const failed={ok:false,error:'crafting_transaction_failed'};
    await sql`UPDATE crafting_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key} AND response->>'error'='pending'`;
    throw error;
  }
  if(rows.length)return rows[0].response;
  const failed={ok:false,error:'inventory_changed'};
  await sql`UPDATE crafting_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;
  return failed;
}

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const url=new URL(req.url),body=req.method==='POST'?await req.json():{},clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);
    if(!clientId)return reply({ok:false,error:'client_id_required'},400);
    const actor=await context(sql,clientId);if(!actor)return reply({ok:false,error:'player_not_registered'},409);
    if(req.method==='GET')return reply(await payload(sql,actor));
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    const action=clean(body.action,30),key=clean(body.idempotencyKey,100);
    if((action==='place_item'||action==='pickup_item')&&key){const result=await moveItem(sql,actor,clean(body.itemId,30),key,action,body.position);return reply(result,result.ok?200:409);}
    const recipe=craftingRecipe(body.recipeKey);
    if(!recipe)return reply({ok:false,error:'invalid_recipe'},400);if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
    const result=await craft(sql,actor,recipe,key);return reply(result,result.ok?200:['action_in_progress','inventory_changed','private_world_required'].includes(result.error)?409:400);
  }catch(error){
    console.error('GPTWorld crafting error',error);
    if(String(error?.message||'').includes('crafting_')||String(error?.message||'').includes('player_crafted_items'))return reply({ok:false,error:'crafting_migration_required'},503);
    return reply({ok:false,error:'crafting_failed'},500);
  }
};
