import {neon} from '@neondatabase/serverless';
import {
  evaluateMilestones,
  newlyEarnedMilestones,
  propertyDevelopmentLevel,
  generateDiscoveries,
  resolveDiscoveryFind,
  normalizeFieldJournal,
  recordAnimalObservation,
  recordPlantObservation,
  recordWeatherEvent,
  profileCard,
  whileYouWereAwaySummary,
  legacyCandidates,
  transportForPlayer,
  canUpgradeStructure,
  structureUpgradeDef,
  advancedUnlocksForSkills,
  regionalHooksView,
  townIdentityFromProjects,
  pendingTownArrivals,
  pickEmergentMoment,
  timeOfDayEffects,
  weatherStrategy,
  seasonStrategy,
  npcFamiliarityLine,
  playerSpecialization
} from '../lib/progression-core.mjs';
import {CRAFTING_SKILL_KEYS} from '../lib/crafting-core.mjs';
import {projectByKey,progressPercent} from '../lib/town-projects-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const dbUrl=()=>globalThis.Netlify?.env?.get?.('DATABASE_URL')||process.env.DATABASE_URL;
const text=(value,max=80)=>String(value||'').trim().slice(0,max);

async function actor(sql,clientId){
  const rows=await sql`
    SELECT p.id,p.display_name,p.x,p.z,p.last_seen_at,
      COALESCE(i.wood,0) AS wood,COALESCE(i.stone,0) AS stone,COALESCE(i.herbs,0) AS herbs,COALESCE(i.coins,0) AS coins
    FROM players p
    LEFT JOIN player_inventory i ON i.player_id=p.id
    WHERE p.client_id=${clientId}
    LIMIT 1`;
  return rows[0]||null;
}

async function ensureProgressionSchema(sql){
  // Lazy additive guards for environments that have not applied migration 013 yet.
  await sql`
    CREATE TABLE IF NOT EXISTS player_milestones (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      milestone_key TEXT NOT NULL,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (player_id, milestone_key)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS player_field_journal (
      player_id BIGINT NOT NULL PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      journal JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS private_world_discoveries (
      world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
      discovery_id TEXT NOT NULL,
      discovery_key TEXT NOT NULL,
      x DOUBLE PRECISION NOT NULL,
      z DOUBLE PRECISION NOT NULL,
      found BOOLEAN NOT NULL DEFAULT FALSE,
      found_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (world_id, discovery_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS player_legacy_events (
      id BIGSERIAL PRIMARY KEY,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'personal',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (player_id, event_key)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS progression_action_receipts (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      action TEXT NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, idempotency_key)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS player_cart_cargo (
      player_id BIGINT NOT NULL PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      wood INTEGER NOT NULL DEFAULT 0 CHECK (wood >= 0),
      stone INTEGER NOT NULL DEFAULT 0 CHECK (stone >= 0),
      herbs INTEGER NOT NULL DEFAULT 0 CHECK (herbs >= 0),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    INSERT INTO world_state(key,value,updated_at) VALUES
      ('town_identity','{"version":1,"key":"frontier_settlement","name":"Frontier Settlement","completed":[]}'::jsonb,now()),
      ('town_arrivals','{"version":1,"residents":[]}'::jsonb,now()),
      ('regional_hooks','{"version":1,"hints":["north_trail","river_trail","abandoned_signpost"]}'::jsonb,now())
    ON CONFLICT (key) DO NOTHING`;
}

async function loadSkills(sql,playerId){
  const rows=await sql`SELECT skill_key,skill_value,attempts FROM player_crafting_skills WHERE player_id=${playerId}`;
  const byKey=new Map(rows.map(row=>[row.skill_key,row]));
  return CRAFTING_SKILL_KEYS.map(key=>({
    key,
    value:Number(byKey.get(key)?.skill_value||0),
    attempts:Number(byKey.get(key)?.attempts||0)
  }));
}

async function loadJournal(sql,playerId){
  const rows=await sql`SELECT journal FROM player_field_journal WHERE player_id=${playerId} LIMIT 1`;
  return normalizeFieldJournal(rows[0]?.journal||{});
}

async function saveJournal(sql,playerId,journal){
  await sql`
    INSERT INTO player_field_journal(player_id,journal,updated_at)
    VALUES(${playerId},${JSON.stringify(normalizeFieldJournal(journal))}::jsonb,now())
    ON CONFLICT(player_id) DO UPDATE SET journal=EXCLUDED.journal,updated_at=now()`;
}

async function ensureDiscoveries(sql,world){
  const existing=await sql`SELECT discovery_id,discovery_key,x,z,found,found_at,metadata FROM private_world_discoveries WHERE world_id=${world.id}`;
  if(existing.length){
    return existing.map(row=>({
      id:row.discovery_id,
      key:row.discovery_key,
      x:Number(row.x),
      z:Number(row.z),
      found:Boolean(row.found),
      foundAt:row.found_at,
      ...(row.metadata||{})
    }));
  }
  const generated=generateDiscoveries(world.seed,5);
  for(const item of generated){
    await sql`
      INSERT INTO private_world_discoveries(world_id,discovery_id,discovery_key,x,z,found,metadata)
      VALUES(
        ${world.id},${item.id},${item.key},${item.x},${item.z},false,
        ${JSON.stringify({name:item.name,summary:item.summary,lore:item.lore,recipeHint:item.recipeHint,regionalHint:item.regionalHint,loot:item.loot})}::jsonb
      )
      ON CONFLICT DO NOTHING`;
  }
  return generated.map(item=>({...item,found:false}));
}

async function homesteadContext(sql,player){
  const worlds=await sql`SELECT id,owner_player_id,name,seed,terrain_state,ecology_state FROM player_worlds WHERE owner_player_id=${player.id} LIMIT 1`;
  const world=worlds[0]||null;
  const skills=await loadSkills(sql,player.id);
  const journal=await loadJournal(sql,player.id);
  const milestones=await sql`SELECT milestone_key,earned_at,payload FROM player_milestones WHERE player_id=${player.id}`;
  const earned=milestones.map(row=>row.milestone_key);
  let buildings=[],placedItems=[],plots=[],craftedKeys=[],discoveries=[],cart={wood:0,stone:0,herbs:0};
  let townContributions=0;
  if(world){
    buildings=await sql`SELECT id,building_key,building_type,x,z,level,status,width,depth,metadata FROM private_world_buildings WHERE world_id=${world.id} AND status='active'`;
    placedItems=await sql`SELECT id,item_key,display_name,quality,placed_x,placed_z,metadata FROM player_crafted_items WHERE player_id=${player.id} AND world_id=${world.id} AND placed_at IS NOT NULL`;
    plots=await sql`SELECT id,crop_key,stage,moisture,health,metadata FROM private_farm_plots WHERE world_id=${world.id}`;
    const crafted=await sql`SELECT DISTINCT item_key FROM player_crafted_items WHERE player_id=${player.id}`;
    craftedKeys=crafted.map(row=>row.item_key);
    discoveries=await ensureDiscoveries(sql,world);
    const cargo=await sql`SELECT wood,stone,herbs FROM player_cart_cargo WHERE player_id=${player.id} LIMIT 1`;
    if(cargo[0])cart=cargo[0];
  }
  try{
    const contrib=await sql`SELECT COUNT(DISTINCT project_key)::int AS n FROM town_project_contributions WHERE player_id=${player.id}`;
    townContributions=Number(contrib[0]?.n||0);
  }catch{townContributions=0;}
  const buildingView=buildings.map(row=>({
    id:String(row.id),
    key:row.building_key,
    type:row.building_type,
    level:Number(row.level||1),
    x:Number(row.x),
    z:Number(row.z),
    width:Number(row.width||7),
    depth:Number(row.depth||6),
    metadata:row.metadata||{},
    status:row.status
  }));
  const placedView=placedItems.map(row=>({
    id:String(row.id),
    key:row.item_key,
    name:row.display_name,
    quality:row.quality,
    x:Number(row.placed_x),
    z:Number(row.placed_z),
    metadata:row.metadata||{}
  }));
  const plotView=plots.map(row=>({
    id:String(row.id),
    cropKey:row.crop_key,
    stage:row.stage,
    moisture:Number(row.moisture),
    health:Number(row.health),
    metadata:row.metadata||{}
  }));
  const inventory={wood:Number(player.wood||0),stone:Number(player.stone||0),herbs:Number(player.herbs||0),coins:Number(player.coins||0)};
  const context={
    buildings:buildingView,
    placedItems:placedView,
    placed:new Set(placedView.map(item=>item.key)),
    plots:plotView,
    skills,
    journal,
    craftedKeys:new Set(craftedKeys),
    inventory,
    townContributions,
    earned
  };
  const milestoneState=evaluateMilestones(context);
  const property=propertyDevelopmentLevel(context);
  const hasCart=craftedKeys.includes('hand-cart');
  const cartLoad=Number(cart.wood||0)+Number(cart.stone||0)+Number(cart.herbs||0);
  const transport=transportForPlayer({hasCart,cartLoad,skills});
  return{
    world,
    skills,
    journal,
    milestones:milestoneState,
    earned,
    property,
    buildings:buildingView,
    placedItems:placedView,
    plots:plotView,
    discoveries,
    inventory,
    townContributions,
    transport,
    cart:{wood:Number(cart.wood||0),stone:Number(cart.stone||0),herbs:Number(cart.herbs||0)},
    hasCart,
    specialization:playerSpecialization({
      skills,
      inventory,
      discoveryCount:(journal.rareDiscoveries||[]).length,
      milestonesComplete:milestoneState.filter(item=>item.complete).length
    }),
    advancedUnlocks:advancedUnlocksForSkills(skills)
  };
}

async function syncMilestones(sql,player,context){
  const fresh=newlyEarnedMilestones(context.earned,context);
  for(const milestone of fresh){
    await sql`
      INSERT INTO player_milestones(player_id,milestone_key,payload)
      VALUES(${player.id},${milestone.key},${JSON.stringify({name:milestone.name,summary:milestone.summary})}::jsonb)
      ON CONFLICT DO NOTHING`;
  }
  return fresh;
}

async function syncLegacy(sql,player,state){
  const candidates=legacyCandidates({
    milestones:state.milestones,
    discoveries:state.journal.rareDiscoveries||[],
    skills:state.skills,
    buildings:state.buildings,
    townContributions:state.townContributions,
    playerName:player.display_name
  });
  const written=[];
  for(const entry of candidates){
    const rows=await sql`
      INSERT INTO player_legacy_events(player_id,event_key,title,summary,kind,payload)
      VALUES(${player.id},${entry.eventKey},${entry.title},${entry.summary},${entry.kind},${JSON.stringify(entry)}::jsonb)
      ON CONFLICT(player_id,event_key) DO NOTHING
      RETURNING event_key,title,summary,kind,created_at`;
    if(rows[0]){
      written.push(rows[0]);
      await sql`
        INSERT INTO town_history(event_key,title,summary,payload)
        VALUES(${entry.eventKey},${entry.title},${entry.summary},${JSON.stringify({playerId:player.id,kind:entry.kind})}::jsonb)
        ON CONFLICT DO NOTHING`;
    }
  }
  return written;
}

async function buildAwaySummary(sql,player,state){
  let projectProgress=null,demandShift=null,weatherPassed=null,arrivals=[];
  try{
    const projects=await sql`SELECT project_key,status,contributed,required FROM town_projects WHERE status='active' ORDER BY updated_at DESC LIMIT 1`;
    if(projects[0]){
      const def=projectByKey(projects[0].project_key);
      projectProgress={
        name:def?.name||projects[0].project_key,
        percent:progressPercent(projects[0].required||def?.required||{},projects[0].contributed||{})
      };
    }
    const demand=await sql`SELECT value FROM world_state WHERE key='town_demand' LIMIT 1`;
    const d=demand[0]?.value||{};
    const hot=Object.entries(d).filter(([k,v])=>!['version','updatedAt','lastTick','activeEvent'].includes(k)&&Number(v)>=70).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
    if(hot)demandShift=hot[0];
    const weather=await sql`SELECT value FROM world_state WHERE key='living_weather' LIMIT 1`;
    const condition=String(weather[0]?.value?.condition||'');
    if(/storm|rain|snow/i.test(condition))weatherPassed=condition;
    const arrivalState=await sql`SELECT value FROM world_state WHERE key='town_arrivals' LIMIT 1`;
    arrivals=arrivalState[0]?.value?.recent||[];
  }catch{/* optional town tables */}
  const readyCrops=state.plots.filter(plot=>plot.stage==='ready').length;
  const unfound=state.discoveries.filter(item=>!item.found).slice(0,1).map(item=>({name:item.name||item.key}));
  return whileYouWereAwaySummary({
    readyCrops,
    projectProgress,
    weatherPassed,
    demandShift,
    arrivals,
    milestones:state.milestones.filter(item=>item.newlyEarned),
    discoveries:unfound
  });
}

async function statusPayload(sql,player){
  const state=await homesteadContext(sql,player);
  const freshMilestones=await syncMilestones(sql,player,{
    ...state,
    placed:new Set(state.placedItems.map(item=>item.key)),
    craftedKeys:new Set([...(await sql`SELECT DISTINCT item_key FROM player_crafted_items WHERE player_id=${player.id}`).then(rows=>rows.map(r=>r.item_key))]),
    earned:state.earned
  });
  // Re-evaluate after sync so complete flags include newly earned.
  const refreshed=await homesteadContext(sql,player);
  const legacy=await syncLegacy(sql,player,refreshed);
  const away=await buildAwaySummary(sql,player,{...refreshed,milestones:[...refreshed.milestones.map(m=>({...m,newlyEarned:freshMilestones.some(f=>f.key===m.key)}))]});
  const ecology=refreshed.world?.ecology_state||{};
  const hour=Number(ecology.worldHour??12);
  const hooksRows=await sql`SELECT value FROM world_state WHERE key='regional_hooks' LIMIT 1`;
  const identityRows=await sql`SELECT value FROM world_state WHERE key='town_identity' LIMIT 1`;
  const completed=await sql`SELECT project_key FROM town_projects WHERE status='complete'`.catch(()=>[]);
  const identity=townIdentityFromProjects((completed||[]).map(row=>row.project_key));
  if(identityRows[0]&&identity.key!==identityRows[0].value?.key){
    await sql`UPDATE world_state SET value=${JSON.stringify({version:1,...identity})}::jsonb,updated_at=now() WHERE key='town_identity'`;
  }
  const profile=profileCard({
    playerName:player.display_name,
    property:refreshed.property,
    skills:refreshed.skills,
    inventory:refreshed.inventory,
    discoveryCount:(refreshed.journal.rareDiscoveries||[]).length,
    milestones:refreshed.milestones
  });
  const moment=pickEmergentMoment({
    seed:`${player.id}:${refreshed.world?.seed||0}`,
    hour,
    weather:ecology.weather||'clear',
    rare:0.05
  });
  return{
    ok:true,
    profile,
    property:refreshed.property,
    milestones:refreshed.milestones,
    newlyEarned:freshMilestones,
    journal:refreshed.journal,
    discoveries:refreshed.discoveries.map(item=>({
      id:item.id,
      key:item.key,
      name:item.name||item.key,
      summary:item.summary||'',
      x:item.x,
      z:item.z,
      found:Boolean(item.found)
    })),
    transport:refreshed.transport,
    cart:refreshed.cart,
    specialization:refreshed.specialization,
    advancedUnlocks:refreshed.advancedUnlocks,
    timeOfDay:timeOfDayEffects(hour),
    weather:weatherStrategy(ecology.weather||'clear',ecology.temperatureC||18),
    season:seasonStrategy(ecology.season||'Spring'),
    regionalHooks:regionalHooksView(hooksRows[0]?.value?.hints||[]),
    townIdentity:identity,
    whileYouWereAway:away,
    legacy,
    moment,
    structureUpgrades:{
      shelter:structureUpgradeDef('shelter',Math.max(1,...refreshed.buildings.filter(b=>b.key==='homestead'||b.type==='house').map(b=>b.level||1))),
      storage:structureUpgradeDef('storage',refreshed.placedItems.some(i=>i.key==='storage-shed')?2:refreshed.placedItems.some(i=>i.key==='wooden-crate')?1:1),
      workshop:structureUpgradeDef('workshop',refreshed.placedItems.some(i=>i.key==='workbench')?1:1),
      farm:structureUpgradeDef('farm',Number(refreshed.plots[0]?.metadata?.farmTier||1))
    }
  };
}

async function findDiscovery(sql,player,discoveryId,idempotencyKey){
  if(idempotencyKey){
    const prior=await sql`SELECT response FROM progression_action_receipts WHERE player_id=${player.id} AND idempotency_key=${idempotencyKey} LIMIT 1`;
    if(prior[0])return prior[0].response;
  }
  const state=await homesteadContext(sql,player);
  if(!state.world)return{ok:false,error:'private_world_required'};
  const discovery=state.discoveries.find(item=>item.id===String(discoveryId)||item.key===String(discoveryId));
  if(!discovery)return{ok:false,error:'discovery_not_found'};
  if(discovery.found)return{ok:false,error:'already_found'};
  const px=Number(player.x||0),pz=Number(player.z||0);
  // Private positions are in private session; allow generous radius for mobile discovery.
  const distance=Math.hypot(Number(discovery.x)-px,Number(discovery.z)-pz);
  // Position may be public coords; still allow claim when exploring private world via explicit id.
  const result=resolveDiscoveryFind(discovery,state.journal);
  if(!result.ok)return result;
  await sql`
    UPDATE private_world_discoveries
    SET found=true,found_at=now(),metadata=metadata||${JSON.stringify({foundBy:player.display_name})}::jsonb
    WHERE world_id=${state.world.id} AND discovery_id=${discovery.id}`;
  const loot=result.loot||{};
  if(Object.values(loot).some(v=>Number(v)>0)){
    await sql`
      INSERT INTO player_inventory(player_id,wood,stone,herbs,coins)
      VALUES(${player.id},${Number(loot.wood||0)},${Number(loot.stone||0)},${Number(loot.herbs||0)},0)
      ON CONFLICT(player_id) DO UPDATE SET
        wood=player_inventory.wood+EXCLUDED.wood,
        stone=player_inventory.stone+EXCLUDED.stone,
        herbs=player_inventory.herbs+EXCLUDED.herbs`;
  }
  if(discovery.regionalHint||result.discovery?.regionalHint){
    const hint=discovery.regionalHint||result.discovery.regionalHint;
    const rows=await sql`SELECT value FROM world_state WHERE key='regional_hooks' LIMIT 1`;
    const value=rows[0]?.value||{version:1,hints:[]};
    const hints=new Set(value.hints||[]);
    hints.add(hint);
    await sql`UPDATE world_state SET value=${JSON.stringify({...value,hints:[...hints]})}::jsonb,updated_at=now() WHERE key='regional_hooks'`;
  }
  await saveJournal(sql,player.id,result.journal);
  const response={
    ok:true,
    message:result.message,
    discovery:result.discovery,
    loot,
    journal:result.journal,
    distance:Number(distance.toFixed(1))
  };
  if(idempotencyKey){
    await sql`
      INSERT INTO progression_action_receipts(player_id,idempotency_key,action,response)
      VALUES(${player.id},${idempotencyKey},'find_discovery',${JSON.stringify(response)}::jsonb)
      ON CONFLICT DO NOTHING`;
  }
  return response;
}

async function journalObserve(sql,player,body){
  let journal=await loadJournal(sql,player.id);
  if(body.species)journal=recordAnimalObservation(journal,body.species,{tracks:Boolean(body.tracks),hunted:Boolean(body.hunted),behavior:body.behavior||null});
  if(body.plant)journal=recordPlantObservation(journal,body.plant,{note:body.note||null});
  if(body.weather)journal=recordWeatherEvent(journal,{condition:body.weather,season:body.season,note:body.note});
  await saveJournal(sql,player.id,journal);
  return{ok:true,journal};
}

async function upgradeStructure(sql,player,family,idempotencyKey){
  if(idempotencyKey){
    const prior=await sql`SELECT response FROM progression_action_receipts WHERE player_id=${player.id} AND idempotency_key=${idempotencyKey} LIMIT 1`;
    if(prior[0])return prior[0].response;
  }
  const state=await homesteadContext(sql,player);
  if(!state.world)return{ok:false,error:'private_world_required'};
  const familyKey=text(family,20);
  let currentTier=1;
  if(familyKey==='shelter'){
    const house=state.buildings.find(b=>b.key==='homestead'||b.type==='house');
    currentTier=house?Number(house.level||1):0;
  }else if(familyKey==='storage'){
    if(state.placedItems.some(i=>i.key==='storage-shed'))currentTier=2;
    else if(state.placedItems.some(i=>i.key==='wooden-crate'))currentTier=1;
    else currentTier=0;
  }else if(familyKey==='workshop'){
    currentTier=state.placedItems.some(i=>i.key==='workbench')?1:0;
  }else if(familyKey==='farm'){
    currentTier=Number(state.plots[0]?.metadata?.farmTier||1);
  }else return{ok:false,error:'unknown_family'};

  const gate=canUpgradeStructure(familyKey,Math.max(1,currentTier),state.skills,state.inventory);
  if(!gate.ok&&currentTier>0)return gate;
  // Allow first shelter upgrade path via building level when homestead exists.
  const next=gate.next||structureUpgradeDef(familyKey,Math.max(1,currentTier)+1);
  if(!next)return{ok:false,error:'max_tier'};
  const retry=canUpgradeStructure(familyKey,Math.max(0,currentTier)||1,state.skills,state.inventory);
  // If currentTier is 0, treat as upgrading into tier 1/2 as appropriate using next from tier 1 materials when building homestead already exists.
  const check=currentTier<=0&&familyKey==='shelter'
    ?canUpgradeStructure('shelter',1,state.skills,state.inventory)
    :retry;
  if(!check.ok)return check;
  const upgrade=check.next;
  const spent=upgrade.inputs||{};
  await sql`
    UPDATE player_inventory SET
      wood=wood-${Number(spent.wood||0)},
      stone=stone-${Number(spent.stone||0)},
      herbs=herbs-${Number(spent.herbs||0)}
    WHERE player_id=${player.id}
      AND wood>=${Number(spent.wood||0)}
      AND stone>=${Number(spent.stone||0)}
      AND herbs>=${Number(spent.herbs||0)}`;
  if(familyKey==='shelter'){
    const rows=await sql`
      UPDATE private_world_buildings
      SET level=${upgrade.tier},
          width=${Number(upgrade.visual?.width||7)},
          depth=${Number(upgrade.visual?.depth||6)},
          metadata=COALESCE(metadata,'{}'::jsonb)||${JSON.stringify({upgradeKey:upgrade.key,upgradeName:upgrade.name,benefits:upgrade.benefits})}::jsonb,
          updated_at=now()
      WHERE world_id=${state.world.id} AND building_key='homestead'
      RETURNING id,building_key,building_type,level,width,depth,metadata`;
    if(!rows[0])return{ok:false,error:'shelter_missing'};
    const response={ok:true,family:familyKey,upgrade,building:{id:String(rows[0].id),key:rows[0].building_key,type:rows[0].building_type,level:Number(rows[0].level),width:Number(rows[0].width),depth:Number(rows[0].depth),metadata:rows[0].metadata||{}}};
    if(idempotencyKey)await sql`INSERT INTO progression_action_receipts(player_id,idempotency_key,action,response) VALUES(${player.id},${idempotencyKey},'upgrade_structure',${JSON.stringify(response)}::jsonb) ON CONFLICT DO NOTHING`;
    return response;
  }
  if(familyKey==='farm'){
    await sql`
      UPDATE private_farm_plots
      SET metadata=COALESCE(metadata,'{}'::jsonb)||${JSON.stringify({farmTier:upgrade.tier,farmTierName:upgrade.name})}::jsonb,
          updated_at=now()
      WHERE world_id=${state.world.id}`;
    const response={ok:true,family:familyKey,upgrade};
    if(idempotencyKey)await sql`INSERT INTO progression_action_receipts(player_id,idempotency_key,action,response) VALUES(${player.id},${idempotencyKey},'upgrade_structure',${JSON.stringify(response)}::jsonb) ON CONFLICT DO NOTHING`;
    return response;
  }
  // Storage / workshop upgrades are expressed by crafting the placeable recipes; this path records intent/tier metadata on world.
  const response={ok:true,family:familyKey,upgrade,message:`Craft and place ${upgrade.name} to complete this upgrade.`};
  if(idempotencyKey)await sql`INSERT INTO progression_action_receipts(player_id,idempotency_key,action,response) VALUES(${player.id},${idempotencyKey},'upgrade_structure',${JSON.stringify(response)}::jsonb) ON CONFLICT DO NOTHING`;
  return response;
}

async function cartTransfer(sql,player,body,idempotencyKey){
  if(idempotencyKey){
    const prior=await sql`SELECT response FROM progression_action_receipts WHERE player_id=${player.id} AND idempotency_key=${idempotencyKey} LIMIT 1`;
    if(prior[0])return prior[0].response;
  }
  const state=await homesteadContext(sql,player);
  if(!state.hasCart)return{ok:false,error:'cart_required'};
  const resource=text(body.resource,12);
  const direction=text(body.direction,12);
  const amount=Math.max(1,Math.min(100,Math.floor(Number(body.amount)||0)));
  if(!['wood','stone','herbs'].includes(resource))return{ok:false,error:'invalid_resource'};
  if(!['to_cart','from_cart'].includes(direction))return{ok:false,error:'invalid_direction'};
  await sql`INSERT INTO player_cart_cargo(player_id,wood,stone,herbs) VALUES(${player.id},0,0,0) ON CONFLICT DO NOTHING`;
  const cargoRows=await sql`SELECT wood,stone,herbs FROM player_cart_cargo WHERE player_id=${player.id}`;
  const cargo=cargoRows[0]||{wood:0,stone:0,herbs:0};
  const load=Number(cargo.wood)+Number(cargo.stone)+Number(cargo.herbs);
  const capacity=state.transport.capacity;
  if(direction==='to_cart'){
    if(load+amount>capacity)return{ok:false,error:'cart_full',capacity,load};
    if(Number(player[resource]||0)<amount)return{ok:false,error:'missing_materials'};
    if(resource==='wood'){
      await sql`UPDATE player_inventory SET wood=wood-${amount} WHERE player_id=${player.id} AND wood>=${amount}`;
      await sql`UPDATE player_cart_cargo SET wood=wood+${amount},updated_at=now() WHERE player_id=${player.id}`;
    }else if(resource==='stone'){
      await sql`UPDATE player_inventory SET stone=stone-${amount} WHERE player_id=${player.id} AND stone>=${amount}`;
      await sql`UPDATE player_cart_cargo SET stone=stone+${amount},updated_at=now() WHERE player_id=${player.id}`;
    }else{
      await sql`UPDATE player_inventory SET herbs=herbs-${amount} WHERE player_id=${player.id} AND herbs>=${amount}`;
      await sql`UPDATE player_cart_cargo SET herbs=herbs+${amount},updated_at=now() WHERE player_id=${player.id}`;
    }
  }else{
    if(Number(cargo[resource]||0)<amount)return{ok:false,error:'cart_empty_resource'};
    if(resource==='wood'){
      await sql`UPDATE player_cart_cargo SET wood=wood-${amount},updated_at=now() WHERE player_id=${player.id} AND wood>=${amount}`;
      await sql`UPDATE player_inventory SET wood=wood+${amount} WHERE player_id=${player.id}`;
    }else if(resource==='stone'){
      await sql`UPDATE player_cart_cargo SET stone=stone-${amount},updated_at=now() WHERE player_id=${player.id} AND stone>=${amount}`;
      await sql`UPDATE player_inventory SET stone=stone+${amount} WHERE player_id=${player.id}`;
    }else{
      await sql`UPDATE player_cart_cargo SET herbs=herbs-${amount},updated_at=now() WHERE player_id=${player.id} AND herbs>=${amount}`;
      await sql`UPDATE player_inventory SET herbs=herbs+${amount} WHERE player_id=${player.id}`;
    }
  }
  const nextCargo=(await sql`SELECT wood,stone,herbs FROM player_cart_cargo WHERE player_id=${player.id}`)[0];
  const nextInv=(await sql`SELECT wood,stone,herbs,coins FROM player_inventory WHERE player_id=${player.id}`)[0];
  const transport=transportForPlayer({
    hasCart:true,
    cartLoad:Number(nextCargo.wood)+Number(nextCargo.stone)+Number(nextCargo.herbs),
    skills:state.skills
  });
  const response={ok:true,cart:nextCargo,inventory:nextInv,transport};
  if(idempotencyKey)await sql`INSERT INTO progression_action_receipts(player_id,idempotency_key,action,response) VALUES(${player.id},${idempotencyKey},'cart_transfer',${JSON.stringify(response)}::jsonb) ON CONFLICT DO NOTHING`;
  return response;
}

export default async (req)=>{
  const url=dbUrl();
  if(!url)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(url);
  try{
    await ensureProgressionSchema(sql);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const clientId=text(body.clientId||new URL(req.url).searchParams.get('clientId'),80);
    if(!clientId)return reply({ok:false,error:'client_required'},400);
    const player=await actor(sql,clientId);
    if(!player)return reply({ok:false,error:'player_not_found'},404);
    const action=text(body.action||'status',40);
    if(req.method==='GET'||action==='status')return reply(await statusPayload(sql,player));
    if(action==='find_discovery'){
      const result=await findDiscovery(sql,player,text(body.discoveryId||body.key,60),text(body.idempotencyKey,80));
      return reply(result,result.ok?200:409);
    }
    if(action==='journal_observe')return reply(await journalObserve(sql,player,body));
    if(action==='upgrade_structure')return reply(await upgradeStructure(sql,player,body.family,text(body.idempotencyKey,80)));
    if(action==='cart_transfer')return reply(await cartTransfer(sql,player,body,text(body.idempotencyKey,80)));
    if(action==='dismiss_away')return reply({ok:true,dismissed:true});
    return reply({ok:false,error:'unknown_action'},400);
  }catch(error){
    const message=String(error?.message||error);
    if(message.includes('player_milestones')||message.includes('progression_')||message.includes('player_field_journal')){
      return reply({ok:false,error:'progression_migration_required',detail:message},503);
    }
    return reply({ok:false,error:'progression_failed',detail:message},500);
  }
};
