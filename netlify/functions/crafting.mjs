import {neon} from '@neondatabase/serverless';
import {
  CRAFTING_SKILL_KEYS,
  HOUSE_BLUEPRINT,
  craftingRecipe,
  houseMaterialLoss,
  housePreview,
  isValidHomesteadSite,
  qualityDurability,
  recentlyUnlockedRecipes,
  recipesForSkillView,
  resolveCraftAttempt,
  resolveHouseAttempt,
  spentInputs
} from '../lib/crafting-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(value,max=100)=>String(value||'').trim().slice(0,max);

async function context(sql,clientId){
  const rows=await sql`
    SELECT p.id,p.display_name,i.wood,i.stone,i.herbs,w.id AS world_id,s.current_world_type,w.terrain_state
    FROM players p
    LEFT JOIN player_inventory i ON i.player_id=p.id
    LEFT JOIN player_worlds w ON w.owner_player_id=p.id
    LEFT JOIN player_world_sessions s ON s.player_id=p.id
    WHERE p.client_id=${clientId} LIMIT 1
  `;
  return rows[0]||null;
}

async function ensureSkills(sql,playerId){
  for(const key of CRAFTING_SKILL_KEYS){
    await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${playerId},${key}) ON CONFLICT(player_id,skill_key) DO NOTHING`;
  }
}

async function payload(sql,actor){
  await ensureSkills(sql,actor.id);
  const [skills,items,buildings]=await Promise.all([
    sql`SELECT skill_key,skill_value,attempts FROM player_crafting_skills WHERE player_id=${actor.id} ORDER BY skill_key`,
    sql`SELECT item.id,item.item_key,item.display_name,item.profession,item.quality,item.durability,item.max_durability,item.maker_name,item.crafted_at,item.placed_x,item.placed_z,item.placed_rotation,item.placed_at,item.metadata,
      storage.wood AS stored_wood,storage.stone AS stored_stone,storage.herbs AS stored_herbs,storage.capacity
      FROM player_crafted_items item LEFT JOIN crafted_item_storage storage ON storage.item_id=item.id
      WHERE item.player_id=${actor.id} ORDER BY item.crafted_at DESC LIMIT 80`,
    actor.world_id
      ?sql`SELECT id,building_key,building_type,x,z,level,width,depth,metadata,status FROM private_world_buildings WHERE world_id=${actor.world_id} ORDER BY created_at`
      :Promise.resolve([])
  ]);
  const skillRows=skills.map(skill=>({key:skill.skill_key,value:Number(skill.skill_value),attempts:Number(skill.attempts)}));
  const inventory={wood:Number(actor.wood||0),stone:Number(actor.stone||0),herbs:Number(actor.herbs||0)};
  const ownedComponents=items.filter(item=>!item.placed_at).map(item=>item.item_key);
  return{
    ok:true,
    recipes:recipesForSkillView(skillRows),
    skills:skillRows,
    house:housePreview(skillRows,inventory,ownedComponents),
    buildings:buildings.map(row=>({id:String(row.id),key:row.building_key,type:row.building_type,x:Number(row.x),z:Number(row.z),level:Number(row.level||1),width:Number(row.width||HOUSE_BLUEPRINT.width),depth:Number(row.depth||HOUSE_BLUEPRINT.depth),metadata:row.metadata||{},status:row.status||'active'})),
    items:items.map(item=>({id:String(item.id),key:item.item_key,name:item.display_name,profession:item.profession,quality:item.quality,durability:Number(item.durability),maxDurability:Number(item.max_durability),maker:item.maker_name,craftedAt:item.crafted_at,metadata:item.metadata||{},storage:item.item_key==='wooden-crate'?{wood:Number(item.stored_wood||0),stone:Number(item.stored_stone||0),herbs:Number(item.stored_herbs||0),capacity:Number(item.capacity||60)}:null,placed:item.placed_at?{x:Number(item.placed_x),z:Number(item.placed_z),rotation:Number(item.placed_rotation||0),placedAt:item.placed_at}:null})),
    inventory
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
        AND (item.item_key<>'wooden-crate' OR NOT EXISTS (
          SELECT 1 FROM crafted_item_storage stored WHERE stored.item_id=item.id AND stored.wood+stored.stone+stored.herbs>0
        ))
      RETURNING item.id,item.item_key,item.display_name,item.quality
    ), receipt AS (
      INSERT INTO crafted_item_action_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},${action},jsonb_build_object('ok',true,'action',${action}::text,'item',jsonb_build_object('id',id::text,'key',item_key,'name',display_name,'quality',quality,'placed',NULL)) FROM moved
      ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  return rows[0]?.response||{ok:false,error:action==='place_item'?'item_cannot_be_placed':'item_cannot_be_picked_up'};
}

async function campfireAction(sql,actor,itemId,key,action){
  const prior=await sql`SELECT response FROM crafted_item_use_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response;
  const rows=action==='light_campfire'?await sql`
    WITH target AS (
      SELECT item.id,item.world_id
      FROM player_crafted_items item
      JOIN player_world_sessions session ON session.player_id=${actor.id} AND session.private_world_id=item.world_id AND session.current_world_type='private'
      JOIN player_worlds world ON world.id=item.world_id AND world.owner_player_id=${actor.id}
      JOIN player_inventory inventory ON inventory.player_id=${actor.id}
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.item_key='campfire-kit' AND item.placed_at IS NOT NULL
        AND sqrt(power(session.private_x-item.placed_x,2)+power(session.private_z-item.placed_z,2))<=5
        AND inventory.wood>=1 AND COALESCE(world.ecology_state->>'weather','clear')<>'heavy rain'
      FOR UPDATE OF item,inventory
    ), inventory_change AS (
      UPDATE player_inventory inventory SET wood=wood-1,updated_at=now() FROM target
      WHERE inventory.player_id=${actor.id} RETURNING inventory.wood,inventory.stone,inventory.herbs
    ), lit AS (
      UPDATE player_crafted_items item SET metadata=COALESCE(item.metadata,'{}'::jsonb)||jsonb_build_object('campfire',COALESCE(item.metadata->'campfire','{}'::jsonb)||jsonb_build_object('litUntil',(GREATEST(COALESCE(NULLIF(item.metadata#>>'{campfire,litUntil}','')::timestamptz,now()),now())+interval '2 hours'),'fuelHours',2))
      FROM target,inventory_change WHERE item.id=target.id
      RETURNING item.id,item.metadata
    ), receipt AS (
      INSERT INTO crafted_item_use_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},${action},jsonb_build_object('ok',true,'action',${action}::text,'itemId',lit.id::text,'metadata',lit.metadata,'inventory',jsonb_build_object('wood',inventory_change.wood,'stone',inventory_change.stone,'herbs',inventory_change.herbs))
      FROM lit,inventory_change ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `:await sql`
    WITH extinguished AS (
      UPDATE player_crafted_items item SET metadata=COALESCE(item.metadata,'{}'::jsonb)||jsonb_build_object('campfire',COALESCE(item.metadata->'campfire','{}'::jsonb)||jsonb_build_object('litUntil',now(),'fuelHours',0))
      FROM player_world_sessions session
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.item_key='campfire-kit' AND item.placed_at IS NOT NULL
        AND session.player_id=${actor.id} AND session.private_world_id=item.world_id AND session.current_world_type='private'
        AND sqrt(power(session.private_x-item.placed_x,2)+power(session.private_z-item.placed_z,2))<=5
      RETURNING item.id,item.metadata
    ), receipt AS (
      INSERT INTO crafted_item_use_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},${action},jsonb_build_object('ok',true,'action',${action}::text,'itemId',id::text,'metadata',metadata)
      FROM extinguished ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  return rows[0]?.response||{ok:false,error:action==='light_campfire'?'campfire_cannot_be_lit':'campfire_cannot_be_extinguished'};
}

async function crateTransfer(sql,actor,itemId,key,resource,direction,requestedAmount){
  const prior=await sql`SELECT response FROM crafted_item_use_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response;
  if(!['wood','stone','herbs'].includes(resource)||!['deposit','withdraw'].includes(direction))return{ok:false,error:'invalid_crate_transfer'};
  const amount=Math.max(1,Math.min(60,Math.floor(Number(requestedAmount)||1)));
  await sql`INSERT INTO crafted_item_storage(item_id,player_id)
    SELECT item.id,${actor.id} FROM player_crafted_items item WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.item_key='wooden-crate'
    ON CONFLICT(item_id) DO NOTHING`;
  const rows=direction==='deposit'?await sql`
    WITH target AS (
      SELECT item.id
      FROM player_crafted_items item
      JOIN player_world_sessions session ON session.player_id=${actor.id} AND session.private_world_id=item.world_id AND session.current_world_type='private'
      JOIN player_inventory inventory ON inventory.player_id=${actor.id}
      JOIN crafted_item_storage storage ON storage.item_id=item.id AND storage.player_id=${actor.id}
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.item_key='wooden-crate' AND item.placed_at IS NOT NULL
        AND sqrt(power(session.private_x-item.placed_x,2)+power(session.private_z-item.placed_z,2))<=5
        AND CASE ${resource}::text WHEN 'wood' THEN inventory.wood WHEN 'stone' THEN inventory.stone ELSE inventory.herbs END>=${amount}
        AND storage.wood+storage.stone+storage.herbs+${amount}<=storage.capacity
      FOR UPDATE OF item,inventory,storage
    ), inventory_change AS (
      UPDATE player_inventory inventory SET
        wood=wood-CASE WHEN ${resource}::text='wood' THEN ${amount} ELSE 0 END,
        stone=stone-CASE WHEN ${resource}::text='stone' THEN ${amount} ELSE 0 END,
        herbs=herbs-CASE WHEN ${resource}::text='herbs' THEN ${amount} ELSE 0 END,updated_at=now()
      FROM target WHERE inventory.player_id=${actor.id} RETURNING inventory.wood,inventory.stone,inventory.herbs
    ), storage_change AS (
      UPDATE crafted_item_storage storage SET
        wood=wood+CASE WHEN ${resource}::text='wood' THEN ${amount} ELSE 0 END,
        stone=stone+CASE WHEN ${resource}::text='stone' THEN ${amount} ELSE 0 END,
        herbs=herbs+CASE WHEN ${resource}::text='herbs' THEN ${amount} ELSE 0 END,updated_at=now()
      FROM target,inventory_change WHERE storage.item_id=target.id RETURNING storage.item_id,storage.wood,storage.stone,storage.herbs,storage.capacity
    ), receipt AS (
      INSERT INTO crafted_item_use_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},'crate_transfer',jsonb_build_object('ok',true,'action','crate_transfer','itemId',storage_change.item_id::text,'direction',${direction}::text,'resource',${resource}::text,'amount',${amount}::int,'storage',jsonb_build_object('wood',storage_change.wood,'stone',storage_change.stone,'herbs',storage_change.herbs,'capacity',storage_change.capacity),'inventory',jsonb_build_object('wood',inventory_change.wood,'stone',inventory_change.stone,'herbs',inventory_change.herbs))
      FROM storage_change,inventory_change ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `:await sql`
    WITH target AS (
      SELECT item.id
      FROM player_crafted_items item
      JOIN player_world_sessions session ON session.player_id=${actor.id} AND session.private_world_id=item.world_id AND session.current_world_type='private'
      JOIN player_inventory inventory ON inventory.player_id=${actor.id}
      JOIN crafted_item_storage storage ON storage.item_id=item.id AND storage.player_id=${actor.id}
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.item_key='wooden-crate' AND item.placed_at IS NOT NULL
        AND sqrt(power(session.private_x-item.placed_x,2)+power(session.private_z-item.placed_z,2))<=5
        AND CASE ${resource}::text WHEN 'wood' THEN storage.wood WHEN 'stone' THEN storage.stone ELSE storage.herbs END>=${amount}
      FOR UPDATE OF item,inventory,storage
    ), storage_change AS (
      UPDATE crafted_item_storage storage SET
        wood=wood-CASE WHEN ${resource}::text='wood' THEN ${amount} ELSE 0 END,
        stone=stone-CASE WHEN ${resource}::text='stone' THEN ${amount} ELSE 0 END,
        herbs=herbs-CASE WHEN ${resource}::text='herbs' THEN ${amount} ELSE 0 END,updated_at=now()
      FROM target WHERE storage.item_id=target.id RETURNING storage.item_id,storage.wood,storage.stone,storage.herbs,storage.capacity
    ), inventory_change AS (
      UPDATE player_inventory inventory SET
        wood=wood+CASE WHEN ${resource}::text='wood' THEN ${amount} ELSE 0 END,
        stone=stone+CASE WHEN ${resource}::text='stone' THEN ${amount} ELSE 0 END,
        herbs=herbs+CASE WHEN ${resource}::text='herbs' THEN ${amount} ELSE 0 END,updated_at=now()
      FROM storage_change WHERE inventory.player_id=${actor.id} RETURNING inventory.wood,inventory.stone,inventory.herbs
    ), receipt AS (
      INSERT INTO crafted_item_use_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},'crate_transfer',jsonb_build_object('ok',true,'action','crate_transfer','itemId',storage_change.item_id::text,'direction',${direction}::text,'resource',${resource}::text,'amount',${amount}::int,'storage',jsonb_build_object('wood',storage_change.wood,'stone',storage_change.stone,'herbs',storage_change.herbs,'capacity',storage_change.capacity),'inventory',jsonb_build_object('wood',inventory_change.wood,'stone',inventory_change.stone,'herbs',inventory_change.herbs))
      FROM storage_change,inventory_change ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  return rows[0]?.response||{ok:false,error:'crate_transfer_failed'};
}

async function craft(sql,actor,recipe,key){
  const prior=await sql`SELECT response FROM crafting_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  await ensureSkills(sql,actor.id);
  const skillRows=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key=${recipe.skill} LIMIT 1`;
  const skillBefore=Number(skillRows[0]?.skill_value||0);
  if(skillBefore<Number(recipe.minSkill||0))return{ok:false,error:'recipe_locked',requiredSkill:Number(recipe.minSkill||0),currentSkill:skillBefore};
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
  const outcome=resolveCraftAttempt({skillValue:skillBefore,difficulty:recipe.difficulty,key:`${actor.id}:${recipe.key}:${key}`,minSkill:recipe.minSkill});
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
      SELECT ${actor.id},${claimed[0].world_id},${recipe.key},${recipe.name},${recipe.skill},${outcome.quality||'standard'},${durability},${durability},${actor.display_name},${JSON.stringify({recipe:recipe.key,inputs:recipe.inputs,chance:outcome.chance,component:Boolean(recipe.component)})}::jsonb
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
  if(!rows.length){
    const failed={ok:false,error:'inventory_changed'};
    await sql`UPDATE crafting_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;
    return failed;
  }
  const response=rows[0].response;
  const unlocks=recentlyUnlockedRecipes([{key:recipe.skill,value:Number(response.skill?.value||skillBefore)}],[{key:recipe.skill,value:skillBefore}]);
  if(unlocks.length)response.unlocks=unlocks;
  return response;
}

async function buildHouse(sql,actor,key,position={}){
  const prior=await sql`SELECT response FROM private_construction_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  if(actor.current_world_type!=='private'||!actor.world_id)return{ok:false,error:'private_world_required'};
  await ensureSkills(sql,actor.id);
  const skillRows=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key='construction' LIMIT 1`;
  const skillBefore=Number(skillRows[0]?.skill_value||0);
  if(skillBefore<HOUSE_BLUEPRINT.minSkill)return{ok:false,error:'construction_skill_locked',requiredSkill:HOUSE_BLUEPRINT.minSkill,currentSkill:skillBefore};
  const x=Number(position.x),z=Number(position.z);
  const existing=await sql`SELECT id,building_key,x,z,width,depth FROM private_world_buildings WHERE world_id=${actor.world_id}`;
  if(existing.some(row=>row.building_key===HOUSE_BLUEPRINT.buildingKey))return{ok:false,error:'house_already_built'};
  const terrain=actor.terrain_state||{};
  if(!isValidHomesteadSite(x,z,{existing,water:terrain.water}))return{ok:false,error:'invalid_build_site'};
  const materials=HOUSE_BLUEPRINT.materials;
  const components=HOUSE_BLUEPRINT.components;
  const componentRows=await sql`
    SELECT id,item_key FROM player_crafted_items
    WHERE player_id=${actor.id} AND world_id=${actor.world_id} AND placed_at IS NULL
    ORDER BY crafted_at ASC
  `;
  const picked=[];
  const remaining=new Map();
  for(const keyName of components)remaining.set(keyName,(remaining.get(keyName)||0)+1);
  for(const row of componentRows){
    const need=remaining.get(row.item_key)||0;
    if(need<=0)continue;
    picked.push(Number(row.id));
    remaining.set(row.item_key,need-1);
  }
  if([...remaining.values()].some(value=>value>0))return{ok:false,error:'missing_components',needed:components,have:componentRows.map(row=>row.item_key)};
  const claimed=await sql`
    INSERT INTO private_construction_receipts(player_id,world_id,idempotency_key,blueprint_key,response)
    SELECT ${actor.id},w.id,${key},${HOUSE_BLUEPRINT.key},'{"ok":false,"error":"pending"}'::jsonb
    FROM player_worlds w
    JOIN player_world_sessions s ON s.player_id=${actor.id} AND s.private_world_id=w.id AND s.current_world_type='private'
    JOIN player_inventory i ON i.player_id=${actor.id}
    WHERE w.id=${actor.world_id} AND w.owner_player_id=${actor.id}
      AND i.wood>=${materials.wood} AND i.stone>=${materials.stone} AND i.herbs>=${materials.herbs}
      AND NOT EXISTS (SELECT 1 FROM private_world_buildings b WHERE b.world_id=w.id AND b.building_key=${HOUSE_BLUEPRINT.buildingKey})
    ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING world_id
  `;
  if(!claimed.length){
    const raced=await sql`SELECT response FROM private_construction_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
    if(raced.length)return raced[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:raced[0].response;
    return{ok:false,error:'insufficient_materials'};
  }
  const outcome=resolveHouseAttempt({skillValue:skillBefore,key:`${actor.id}:house:${key}`});
  const spent=houseMaterialLoss(HOUSE_BLUEPRINT,outcome.success);
  const consumeComponents=outcome.success||!HOUSE_BLUEPRINT.keepComponentsOnFailure;
  const componentIds=picked.map(String);
  let rows;
  try{
    rows=await sql`
      WITH inventory_change AS (
        UPDATE player_inventory SET wood=wood-${spent.wood},stone=stone-${spent.stone},herbs=herbs-${spent.herbs},updated_at=now()
        WHERE player_id=${actor.id} AND wood>=${spent.wood} AND stone>=${spent.stone} AND herbs>=${spent.herbs}
        RETURNING wood,stone,herbs
      ), consumed AS (
        DELETE FROM player_crafted_items item
        WHERE item.player_id=${actor.id} AND item.id=ANY(${picked}::bigint[])
          AND ${consumeComponents} AND EXISTS(SELECT 1 FROM inventory_change)
        RETURNING item.id
      ), skill_change AS (
        UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${outcome.skillGain}),attempts=attempts+1,updated_at=now()
        WHERE player_id=${actor.id} AND skill_key='construction' AND EXISTS(SELECT 1 FROM inventory_change)
        RETURNING skill_value,attempts
      ), built AS (
        INSERT INTO private_world_buildings(world_id,building_key,building_type,x,z,level,condition,status,width,depth,metadata,construction_history)
        SELECT ${actor.world_id},${HOUSE_BLUEPRINT.buildingKey},${HOUSE_BLUEPRINT.buildingType},${x},${z},2,100,'active',${HOUSE_BLUEPRINT.width},${HOUSE_BLUEPRINT.depth},
          ${JSON.stringify({blueprint:HOUSE_BLUEPRINT.key,name:HOUSE_BLUEPRINT.name,ownerPlayerId:actor.id})}::jsonb,
          ${JSON.stringify([{at:new Date().toISOString(),success:outcome.success,chance:outcome.chance}])}::jsonb
        FROM inventory_change WHERE ${outcome.success}
        RETURNING id,building_key,building_type,x,z,level,width,depth,metadata
      ), history AS (
        INSERT INTO private_world_events(world_id,player_id,event_type,x,z,details)
        SELECT ${actor.world_id},${actor.id},CASE WHEN ${outcome.success} THEN 'house_built' ELSE 'house_build_failed' END,${x},${z},
          jsonb_build_object('blueprint',${HOUSE_BLUEPRINT.key}::text,'chance',${outcome.chance}::numeric,'materialsSpent',${JSON.stringify(spent)}::jsonb,'componentsConsumed',${consumeComponents}::boolean)
        FROM inventory_change,skill_change RETURNING id
      ), finalized AS (
        UPDATE private_construction_receipts receipt SET response=(
          SELECT jsonb_build_object(
            'ok',true,'success',${outcome.success}::boolean,'blueprintKey',${HOUSE_BLUEPRINT.key}::text,'chance',${outcome.chance}::numeric,
            'materialsSpent',${JSON.stringify(spent)}::jsonb,'componentsConsumed',${consumeComponents}::boolean,'componentIds',${JSON.stringify(componentIds)}::jsonb,
            'inventory',jsonb_build_object('wood',inventory_change.wood,'stone',inventory_change.stone,'herbs',inventory_change.herbs),
            'skill',jsonb_build_object('key','construction','before',${skillBefore}::numeric,'value',skill_change.skill_value,'gain',${outcome.skillGain}::numeric,'attempts',skill_change.attempts),
            'building',(SELECT jsonb_build_object('id',id::text,'key',building_key,'type',building_type,'x',x,'z',z,'level',level,'width',width,'depth',depth,'metadata',metadata) FROM built)
          ) FROM inventory_change,skill_change,history
        )
        WHERE receipt.player_id=${actor.id} AND receipt.idempotency_key=${key}
        RETURNING response
      ) SELECT response FROM finalized
    `;
  }catch(error){
    const failed={ok:false,error:'construction_transaction_failed'};
    await sql`UPDATE private_construction_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key} AND response->>'error'='pending'`;
    throw error;
  }
  if(!rows.length){
    const failed={ok:false,error:'inventory_changed'};
    await sql`UPDATE private_construction_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;
    return failed;
  }
  const response=rows[0].response;
  const unlocks=recentlyUnlockedRecipes([{key:'construction',value:Number(response.skill?.value||skillBefore)}],[{key:'construction',value:skillBefore}]);
  if(unlocks.length)response.unlocks=unlocks;
  return response;
}

async function placeInteriorFurniture(sql,actor,itemId,key,buildingId,position={}){
  const prior=await sql`SELECT response FROM crafted_item_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response;
  const x=Math.max(-6,Math.min(6,Number(position.x)||0)),z=Math.max(-5,Math.min(5,Number(position.z)||0)),rotation=Number(position.rotation)||0;
  const rows=await sql`
    WITH target AS (
      SELECT item.id,item.item_key,item.display_name,item.world_id,building.id AS building_id
      FROM player_crafted_items item
      JOIN private_world_buildings building ON building.id=${buildingId} AND building.world_id=item.world_id AND building.building_key=${HOUSE_BLUEPRINT.buildingKey}
      JOIN player_worlds world ON world.id=item.world_id AND world.owner_player_id=${actor.id}
      JOIN player_world_sessions session ON session.player_id=${actor.id} AND session.private_world_id=item.world_id AND session.current_world_type='private'
      WHERE item.id=${itemId} AND item.player_id=${actor.id} AND item.placed_at IS NULL
        AND item.item_key IN ('wooden-crate','stone-hearth','reed-mat','campfire-kit')
      FOR UPDATE OF item
    ), placed AS (
      UPDATE player_crafted_items item SET placed_x=${x},placed_z=${z},placed_rotation=${rotation},placed_at=now(),
        metadata=COALESCE(item.metadata,'{}'::jsonb)||jsonb_build_object('interiorBuildingId',target.building_id::text,'interior',true)
      FROM target WHERE item.id=target.id
      RETURNING item.id,item.item_key,item.display_name,item.quality,item.placed_x,item.placed_z,item.placed_rotation,item.placed_at,target.building_id,target.world_id
    ), furniture AS (
      INSERT INTO private_building_furniture(building_id,world_id,player_id,item_id,item_key,display_name,x,z,rotation,metadata)
      SELECT building_id,world_id,${actor.id},id,item_key,display_name,placed_x,placed_z,placed_rotation,jsonb_build_object('quality',quality)
      FROM placed RETURNING id,building_id,item_id,item_key,display_name,x,z,rotation
    ), receipt AS (
      INSERT INTO crafted_item_action_receipts(player_id,idempotency_key,action,response)
      SELECT ${actor.id},${key},'place_interior_furniture',jsonb_build_object('ok',true,'action','place_interior_furniture','furniture',jsonb_build_object('id',furniture.id::text,'buildingId',furniture.building_id::text,'itemId',furniture.item_id::text,'key',furniture.item_key,'name',furniture.display_name,'x',furniture.x,'z',furniture.z,'rotation',furniture.rotation))
      FROM furniture ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING response
    ) SELECT response FROM receipt
  `;
  return rows[0]?.response||{ok:false,error:'furniture_cannot_be_placed'};
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
    const action=clean(body.action,40),key=clean(body.idempotencyKey,100);
    if((action==='place_item'||action==='pickup_item')&&key){const result=await moveItem(sql,actor,clean(body.itemId,30),key,action,body.position);return reply(result,result.ok?200:409);}
    if(action==='place_interior_furniture'&&key){const result=await placeInteriorFurniture(sql,actor,clean(body.itemId,30),key,clean(body.buildingId,30),body.position);return reply(result,result.ok?200:409);}
    if((action==='light_campfire'||action==='extinguish_campfire')&&key){const result=await campfireAction(sql,actor,clean(body.itemId,30),key,action);return reply(result,result.ok?200:409);}
    if(action==='crate_transfer'&&key){const result=await crateTransfer(sql,actor,clean(body.itemId,30),key,clean(body.resource,12),clean(body.direction,12),body.amount);return reply(result,result.ok?200:409);}
    if(action==='build_house'&&key){const result=await buildHouse(sql,actor,key,body.position||{});return reply(result,result.ok?200:['action_in_progress','inventory_changed','private_world_required','house_already_built'].includes(result.error)?409:400);}
    const recipe=craftingRecipe(body.recipeKey);
    if(!recipe)return reply({ok:false,error:'invalid_recipe'},400);if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
    const result=await craft(sql,actor,recipe,key);return reply(result,result.ok?200:['action_in_progress','inventory_changed','private_world_required','recipe_locked'].includes(result.error)?409:400);
  }catch(error){
    console.error('GPTWorld crafting error',error);
    if(String(error?.message||'').includes('crafting_')||String(error?.message||'').includes('player_crafted_items')||String(error?.message||'').includes('crafted_item_storage')||String(error?.message||'').includes('crafted_item_use_receipts')||String(error?.message||'').includes('private_construction')||String(error?.message||'').includes('private_building_furniture')||String(error?.message||'').includes('private_world_buildings'))return reply({ok:false,error:'crafting_migration_required'},503);
    return reply({ok:false,error:'crafting_failed'},500);
  }
};
