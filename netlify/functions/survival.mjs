import {neon} from '@neondatabase/serverless';
import {ecologyRenderEntities} from './_sim-core.mjs';
import {privateLivingEntityView,privateObserverForLivingRenderer,synchronizePrivateLivingState} from '../lib/private-world-core.mjs';
import {CRAFTING_SKILL_KEYS} from '../lib/crafting-core.mjs';
import {CROPS,HUNT_UNLOCKS,advanceCrop,cropByKey,cropHarvest,cropUnlocked,resolveHunt} from '../lib/survival-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(value,max=100)=>String(value||'').trim().slice(0,max);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

async function context(sql,clientId){
  const rows=await sql`SELECT p.id,p.display_name,w.id AS world_id,w.seed,w.terrain_state,w.ecology_state,s.current_world_type,s.private_x,s.private_z
    FROM players p JOIN player_worlds w ON w.owner_player_id=p.id JOIN player_world_sessions s ON s.player_id=p.id AND s.private_world_id=w.id
    WHERE p.client_id=${clientId} LIMIT 1`;
  return rows[0]||null;
}
async function ensureSkills(sql,playerId){for(const key of CRAFTING_SKILL_KEYS)await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${playerId},${key}) ON CONFLICT(player_id,skill_key) DO NOTHING`;}
async function livingAnimals(sql,actor){
  const rows=await sql`SELECT key,value FROM world_state WHERE key IN ('weather_sim','ecosystem','forest_pressure')`;
  const living=Object.fromEntries(rows.map(row=>[row.key,row.value]));
  const ecology=synchronizePrivateLivingState(actor.ecology_state,living.weather_sim,living.ecosystem);
  const observer=privateObserverForLivingRenderer({x:Number(actor.private_x),z:Number(actor.private_z)},actor.seed);
  const rendered=ecologyRenderEntities(living.ecosystem,Date.now(),living.weather_sim,observer,living.forest_pressure);
  const animals=privateLivingEntityView(rendered,{worldId:actor.world_id,seed:actor.seed,terrain:actor.terrain_state}).filter(entity=>entity.part==='creature');
  return{animals,ecology};
}
function plotView(row,ecology){const advanced=advanceCrop(row,{weather:ecology?.weather,temperature:ecology?.temperature,now:new Date()});return{id:String(row.id),x:Number(row.x),z:Number(row.z),cropKey:row.crop_key,stage:advanced.stage,progress:advanced.progress,moisture:advanced.moisture,health:advanced.health,plantedAt:row.planted_at,wateredAt:row.watered_at,harvestCount:Number(row.harvest_count||0)};}
async function payload(sql,actor){
  await ensureSkills(sql,actor.id);const [{animals,ecology},plots,skills,items,hunted]=await Promise.all([
    livingAnimals(sql,actor),
    sql`SELECT * FROM private_farm_plots WHERE world_id=${actor.world_id} AND player_id=${actor.id} ORDER BY created_at`,
    sql`SELECT skill_key,skill_value,attempts FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key IN ('farming','hunting') ORDER BY skill_key`,
    sql`SELECT item_key,COALESCE(quantity,1) AS quantity FROM player_crafted_items WHERE player_id=${actor.id} AND placed_at IS NULL`,
    sql`SELECT animal_id,status,respawn_after FROM private_hunting_state WHERE world_id=${actor.world_id} AND player_id=${actor.id}`
  ]);
  const advancedPlots=[];for(const row of plots){const view=plotView(row,ecology);advancedPlots.push(view);if(view.stage!==row.stage||Math.abs(view.moisture-Number(row.moisture))>.05||Math.abs(view.health-Number(row.health))>.05)await sql`UPDATE private_farm_plots SET stage=${view.stage},moisture=${view.moisture},health=${view.health},updated_at=now() WHERE id=${row.id} AND world_id=${actor.world_id}`;}
  const blocked=new Set(hunted.filter(row=>row.status==='harvested'&&(!row.respawn_after||new Date(row.respawn_after)>new Date())).map(row=>row.animal_id));
  const skillMap=Object.fromEntries(skills.map(row=>[row.skill_key,Number(row.skill_value)]));
  const equipment=[...new Set(items.filter(row=>['basic-bow','reinforced-bow','composite-bow','hunting-trap'].includes(row.item_key)&&Number(row.quantity)>0).map(row=>row.item_key))];
  const bag={};
  for(const row of items)bag[row.item_key]=(bag[row.item_key]||0)+Number(row.quantity||0);
  return{ok:true,skills:skills.map(row=>({key:row.skill_key,value:Number(row.skill_value),attempts:Number(row.attempts)})),crops:CROPS.map(crop=>({...crop,unlocked:cropUnlocked(crop.key,skillMap.farming||0)})),huntUnlocks:HUNT_UNLOCKS.map(unlock=>({...unlock,unlocked:(skillMap.hunting||0)>=unlock.level})),plots:advancedPlots,animals:animals.filter(animal=>!blocked.has(String(animal.id))).map(animal=>({id:String(animal.id),species:String(animal.speciesName||animal.species||'wildlife'),kind:String(animal.kind||'herbivore'),x:Number(animal.x),z:Number(animal.z),behavior:animal.behavior||'roaming',injury:Number(animal.injury||0)})),equipment,bag,ecology:{weather:ecology.weather,temperature:ecology.temperatureC??ecology.temperature}};
}
async function claim(sql,actor,key,action){const prior=await sql`SELECT response FROM survival_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key}`;if(prior.length)return{prior:prior[0].response};const made=await sql`INSERT INTO survival_action_receipts(player_id,idempotency_key,action,response) VALUES(${actor.id},${key},${action},'{"ok":false,"error":"pending"}'::jsonb) ON CONFLICT DO NOTHING RETURNING player_id`;return made.length?{}:{prior:{ok:false,error:'action_in_progress'}};}
async function finish(sql,actor,key,response){await sql`UPDATE survival_action_receipts SET response=${JSON.stringify(response)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;return response;}
async function preparePlot(sql,actor,key,position){
  const x=clamp(position?.x,-30,30),z=clamp(position?.z,-30,30);if(actor.current_world_type!=='private')return{ok:false,error:'private_world_required'};
  if(Math.hypot(Number(actor.private_x)-x,Number(actor.private_z)-z)>4)return{ok:false,error:'out_of_range'};
  const lake=actor.terrain_state?.water;if(lake&&Math.hypot(x-Number(lake.x),z-Number(lake.z))<Number(lake.radius||0)+1.4)return{ok:false,error:'invalid_plot_site'};
  const near=await sql`SELECT id FROM private_farm_plots WHERE world_id=${actor.world_id} AND sqrt(power(x-${x},2)+power(z-${z},2))<2.2 LIMIT 1`;if(near.length)return{ok:false,error:'plot_too_close'};
  const rows=await sql`INSERT INTO private_farm_plots(world_id,player_id,x,z) VALUES(${actor.world_id},${actor.id},${x},${z}) RETURNING *`;
  return{ok:true,action:'prepare_plot',plot:plotView(rows[0],actor.ecology_state)};
}
async function plant(sql,actor,plotId,cropKey){
  const crop=cropByKey(cropKey);if(!crop)return{ok:false,error:'unknown_crop'};
  const skills=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key='farming'`;if(!cropUnlocked(cropKey,skills[0]?.skill_value))return{ok:false,error:'crop_locked',requiredSkill:crop.unlock};
  const rows=await sql`WITH target AS (
      SELECT id FROM private_farm_plots WHERE id=${plotId} AND world_id=${actor.world_id} AND player_id=${actor.id} AND crop_key IS NULL AND sqrt(power(x-${actor.private_x},2)+power(z-${actor.private_z},2))<=4 FOR UPDATE
    ), seed AS (
      SELECT id,COALESCE(quantity,1) quantity FROM player_crafted_items WHERE player_id=${actor.id} AND item_key='seed-pouch' AND placed_at IS NULL ORDER BY crafted_at LIMIT 1 FOR UPDATE
    ), used AS (UPDATE player_crafted_items SET quantity=quantity-1 WHERE id=(SELECT id FROM seed) AND (SELECT quantity FROM seed)>1 AND EXISTS(SELECT 1 FROM target) RETURNING id), removed AS (DELETE FROM player_crafted_items WHERE id=(SELECT id FROM seed) AND (SELECT quantity FROM seed)=1 AND EXISTS(SELECT 1 FROM target) RETURNING id), planted AS (
      UPDATE private_farm_plots SET crop_key=${cropKey},stage='seed',moisture=72,health=100,planted_at=now(),watered_at=now(),updated_at=now()
      WHERE id=(SELECT id FROM target) AND EXISTS(SELECT 1 FROM seed) RETURNING *
    ) SELECT * FROM planted`;
  return rows.length?{ok:true,action:'plant',plot:plotView(rows[0],actor.ecology_state)}:{ok:false,error:'plant_failed'};
}
async function water(sql,actor,plotId){const rows=await sql`UPDATE private_farm_plots SET moisture=100,watered_at=now(),updated_at=now() WHERE id=${plotId} AND world_id=${actor.world_id} AND player_id=${actor.id} AND crop_key IS NOT NULL AND sqrt(power(x-${actor.private_x},2)+power(z-${actor.private_z},2))<=4 RETURNING *`;return rows.length?{ok:true,action:'water',plot:plotView(rows[0],actor.ecology_state)}:{ok:false,error:'water_failed'};}
async function addStack(sql,actor,item,quantity,profession){
  const updated=await sql`UPDATE player_crafted_items SET quantity=LEAST(999,quantity+${quantity}) WHERE id=(SELECT id FROM player_crafted_items WHERE player_id=${actor.id} AND world_id=${actor.world_id} AND item_key=${item.key} AND quality='standard' AND durability=1 AND max_durability=1 AND placed_at IS NULL ORDER BY crafted_at LIMIT 1) RETURNING id,quantity`;
  if(!updated.length)await sql`INSERT INTO player_crafted_items(player_id,world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata,quantity) VALUES(${actor.id},${actor.world_id},${item.key},${item.name},${profession},'standard',1,1,${actor.display_name},'{}'::jsonb,${quantity})`;
}
async function harvestCrop(sql,actor,plotId,ecology){
  const rows=await sql`SELECT * FROM private_farm_plots WHERE id=${plotId} AND world_id=${actor.world_id} AND player_id=${actor.id} AND sqrt(power(x-${actor.private_x},2)+power(z-${actor.private_z},2))<=4 FOR UPDATE`;if(!rows.length)return{ok:false,error:'plot_not_found'};
  const plot=advanceCrop(rows[0],{weather:ecology.weather,temperature:ecology.temperature});if(plot.stage!=='ready')return{ok:false,error:'crop_not_ready',plot:plotView(rows[0],ecology)};
  const skillRows=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key='farming'`,reward=cropHarvest(plot.crop_key,skillRows[0]?.skill_value,plot.health);
  const cleared=await sql`UPDATE private_farm_plots SET crop_key=NULL,stage='prepared',moisture=0,health=100,planted_at=NULL,watered_at=NULL,harvested_at=now(),harvest_count=harvest_count+1,updated_at=now() WHERE id=${plotId} AND world_id=${actor.world_id} AND player_id=${actor.id} AND crop_key=${plot.crop_key} RETURNING *`;
  if(!cleared.length)return{ok:false,error:'crop_already_harvested'};
  await addStack(sql,actor,{key:reward.itemKey,name:reward.name},reward.quantity,'farming');await addStack(sql,actor,{key:'seed-pouch',name:'Seed Pouch'},1,'farming');
  const skill=await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${reward.xp}),attempts=attempts+1,updated_at=now() WHERE player_id=${actor.id} AND skill_key='farming' RETURNING skill_value`;
  return{ok:true,action:'harvest_crop',reward,skillValue:Number(skill[0]?.skill_value||0),plot:plotView(cleared[0],ecology)};
}
async function hunt(sql,actor,key,animalId,equipment){
  const {animals}=await livingAnimals(sql,actor),animal=animals.find(row=>String(row.id)===animalId);if(!animal)return{ok:false,error:'animal_not_found'};
  const distance=Math.hypot(Number(actor.private_x)-Number(animal.x),Number(actor.private_z)-Number(animal.z));if(distance>5)return{ok:false,error:'animal_out_of_range'};
  const gear=await sql`SELECT id FROM player_crafted_items WHERE player_id=${actor.id} AND item_key=${equipment} AND placed_at IS NULL AND quantity>0 LIMIT 1`;if(!gear.length)return{ok:false,error:'equipment_required'};
  const old=await sql`SELECT status,respawn_after,updated_at FROM private_hunting_state WHERE world_id=${actor.world_id} AND animal_id=${animalId}`;if(old[0]?.status==='harvested'&&(!old[0].respawn_after||new Date(old[0].respawn_after)>new Date()))return{ok:false,error:'animal_already_harvested'};if(old[0]?.status==='active'&&Date.now()-new Date(old[0].updated_at).getTime()<15000)return{ok:false,error:'hunt_cooldown'};
  const skillRows=await sql`SELECT skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key='hunting'`,outcome=resolveHunt({key:`${actor.id}:${animalId}:${key}`,species:animal.speciesName||animal.species,kind:animal.kind,skill:skillRows[0]?.skill_value,equipment,distance,injury:animal.injury});
  if(outcome.success){const claimed=await sql`INSERT INTO private_hunting_state(world_id,animal_id,player_id,species,status,harvested_at,respawn_after,metadata) VALUES(${actor.world_id},${animalId},${actor.id},${outcome.species},'harvested',now(),now()+interval '24 hours',${JSON.stringify({equipment})}::jsonb) ON CONFLICT(world_id,animal_id) DO UPDATE SET status='harvested',harvested_at=now(),respawn_after=now()+interval '24 hours',metadata=EXCLUDED.metadata,updated_at=now() WHERE private_hunting_state.status='active' OR private_hunting_state.respawn_after<=now() RETURNING animal_id`;if(!claimed.length)return{ok:false,error:'animal_already_harvested'};for(const reward of outcome.rewards)await addStack(sql,actor,reward,reward.quantity,'hunting');}else await sql`INSERT INTO private_hunting_state(world_id,animal_id,player_id,species,status,metadata) VALUES(${actor.world_id},${animalId},${actor.id},${outcome.species},'active',${JSON.stringify({equipment,lastOutcome:'escaped'})}::jsonb) ON CONFLICT(world_id,animal_id) DO UPDATE SET status='active',metadata=EXCLUDED.metadata,updated_at=now()`;
  const skill=await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${outcome.xp}),attempts=attempts+1,updated_at=now() WHERE player_id=${actor.id} AND skill_key='hunting' RETURNING skill_value`;
  return{ok:true,action:'hunt',...outcome,animalId,skillValue:Number(skill[0]?.skill_value||0)};
}
async function cookStew(sql,actor){
  const rows=await sql`WITH candidates AS (
      SELECT id,item_key,quantity FROM player_crafted_items WHERE player_id=${actor.id} AND world_id=${actor.world_id} AND item_key IN ('raw-meat','carrot') AND placed_at IS NULL AND quantity>0 FOR UPDATE
    ), target AS (
      SELECT (array_agg(id ORDER BY crafted_at) FILTER(WHERE item_key='raw-meat'))[1] meat_id,(array_agg(id ORDER BY crafted_at) FILTER(WHERE item_key='carrot'))[1] carrot_id FROM player_crafted_items WHERE id IN (SELECT id FROM candidates) HAVING count(DISTINCT item_key)=2
    ), reduced AS (
      UPDATE player_crafted_items item SET quantity=quantity-1 FROM target WHERE item.id IN (target.meat_id,target.carrot_id) AND item.quantity>1 RETURNING item.id
    ), removed AS (
      DELETE FROM player_crafted_items item USING target WHERE item.id IN (target.meat_id,target.carrot_id) AND item.quantity=1 RETURNING item.id
    ) SELECT (SELECT count(*) FROM reduced)+(SELECT count(*) FROM removed) AS consumed`;
  if(Number(rows[0]?.consumed)!==2)return{ok:false,error:'cooking_ingredients_required'};
  await addStack(sql,actor,{key:'trail-rations',name:'Trail Rations'},2,'cooking');
  const skill=await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+.75),attempts=attempts+1,updated_at=now() WHERE player_id=${actor.id} AND skill_key='cooking' RETURNING skill_value`;
  return{ok:true,action:'cook_stew',reward:{itemKey:'trail-rations',name:'Trail Rations',quantity:2},skillValue:Number(skill[0]?.skill_value||0)};
}

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);const sql=neon(process.env.DATABASE_URL);
  try{const url=new URL(req.url),body=req.method==='POST'?await req.json().catch(()=>({})):{},clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);if(!clientId)return reply({ok:false,error:'client_id_required'},400);const actor=await context(sql,clientId);if(!actor)return reply({ok:false,error:'private_world_not_found'},409);await ensureSkills(sql,actor.id);if(req.method==='GET')return reply(await payload(sql,actor));if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);if(actor.current_world_type!=='private')return reply({ok:false,error:'private_world_required'},409);
    const action=clean(body.action,40),key=clean(body.idempotencyKey,100);if(!key)return reply({ok:false,error:'idempotency_key_required'},400);const claimed=await claim(sql,actor,key,action);if(claimed.prior)return reply(claimed.prior,claimed.prior.ok?200:409);let result;
    if(action==='prepare_plot')result=await preparePlot(sql,actor,key,body.position);else if(action==='plant')result=await plant(sql,actor,clean(body.plotId,30),clean(body.cropKey,30));else if(action==='water')result=await water(sql,actor,clean(body.plotId,30));else if(action==='harvest_crop'){const {ecology}=await livingAnimals(sql,actor);result=await harvestCrop(sql,actor,clean(body.plotId,30),ecology);}else if(action==='track'){const {animals}=await livingAnimals(sql,actor),animal=animals.find(row=>String(row.id)===clean(body.animalId,100));result=animal?{ok:true,action:'track',animal:{id:String(animal.id),species:animal.speciesName||animal.species,behavior:animal.behavior,distance:Number(Math.hypot(Number(actor.private_x)-Number(animal.x),Number(actor.private_z)-Number(animal.z)).toFixed(1))}}:{ok:false,error:'animal_not_found'};}else if(action==='hunt')result=await hunt(sql,actor,key,clean(body.animalId,100),clean(body.equipment,30)||'basic-bow');else if(action==='cook_stew')result=await cookStew(sql,actor);else result={ok:false,error:'unknown_action'};
    await finish(sql,actor,key,result);return reply(result,result.ok?200:409);
  }catch(error){console.error('GPTWorld survival error',error);return reply({ok:false,error:/private_farm_plots|private_hunting_state|survival_action_receipts/.test(String(error?.message))?'survival_migration_required':'survival_failed'},500);}
};
