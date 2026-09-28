import {neon} from '@neondatabase/serverless';
import {
  TOWN_PROJECTS,
  projectByKey,
  normalizeContribution,
  acceptContribution,
  activeProjectQueue,
  unlockedCapabilities,
  completedStructures,
  normalizeDemand,
  historyEntryFromProject,
  structureRenderEntity,
  progressPercent,
  demandTier,
  CRAFTED_MATERIALS,
  scaleProjectRequirements
} from '../lib/town-projects-core.mjs';
import {ensureTownProjectsSchema,townProjectsSchemaReady} from '../lib/town-projects-schema.mjs';
import {townIdentityFromProjects} from '../lib/progression-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
const clean=(value,max=100)=>String(value||'').trim().slice(0,max);

let schemaReady=false;
async function ensureSchema(sql){
  if(schemaReady)return;
  if(await townProjectsSchemaReady(sql)){schemaReady=true;return;}
  await ensureTownProjectsSchema(sql);
  schemaReady=true;
}

async function actor(sql,clientId){
  const rows=await sql`
    SELECT p.id,p.display_name,
      COALESCE(i.wood,0) AS wood,COALESCE(i.stone,0) AS stone,
      COALESCE(i.herbs,0) AS herbs,COALESCE(i.coins,0) AS coins
    FROM players p
    LEFT JOIN player_inventory i ON i.player_id=p.id
    WHERE p.client_id=${clientId}
    LIMIT 1
  `;
  return rows[0]||null;
}

async function ensureProjects(sql){
  const activePlayers=await sql`
    SELECT COUNT(DISTINCT player_id)::int AS n
    FROM town_project_contributions
    WHERE created_at > now() - interval '7 days'
  `.catch(()=>[{n:1}]);
  const contributors=Math.max(1,Number(activePlayers[0]?.n||1));
  for(const project of TOWN_PROJECTS){
    const required=scaleProjectRequirements(project.required,contributors);
    await sql`
      INSERT INTO town_projects(project_key,status,contributed,required,unlocks)
      VALUES(
        ${project.key},
        'active',
        '{}'::jsonb,
        ${JSON.stringify(required)}::jsonb,
        ${JSON.stringify(project.unlocks)}::jsonb
      )
      ON CONFLICT(project_key) DO UPDATE SET
        required=EXCLUDED.required,
        unlocks=EXCLUDED.unlocks,
        updated_at=now()
      WHERE town_projects.status='active'
        AND COALESCE((town_projects.metadata->>'lockedRequirements')::boolean,false)=false
    `;
  }
}

async function projectRows(sql){
  const rows=await sql`
    SELECT project_key,status,contributed,required,unlocks,completed_at,metadata
    FROM town_projects
  `;
  return Object.fromEntries(rows.map(row=>[row.project_key,row]));
}

async function playerTotals(sql,playerId){
  if(!playerId)return{};
  const rows=await sql`
    SELECT project_key,resource,SUM(amount)::int AS total
    FROM town_project_contributions
    WHERE player_id=${playerId}
    GROUP BY project_key,resource
  `;
  const byProject={};
  for(const row of rows){
    byProject[row.project_key]=byProject[row.project_key]||{};
    byProject[row.project_key][row.resource]=Number(row.total||0);
  }
  return byProject;
}

async function readDemand(sql){
  const rows=await sql`SELECT value FROM world_state WHERE key='town_demand' LIMIT 1`;
  return normalizeDemand(rows[0]?.value||{});
}

async function readDay(sql){
  const rows=await sql`SELECT value FROM world_state WHERE key='current_day' LIMIT 1`;
  const day=Number(rows[0]?.value?.day);
  return Number.isFinite(day)?day:null;
}

async function readHistory(sql,limit=40){
  const rows=await sql`
    SELECT id,event_key,title,summary,game_day,payload,created_at
    FROM town_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(row=>({
    id:String(row.id),
    eventKey:row.event_key,
    title:row.title,
    summary:row.summary,
    gameDay:row.game_day,
    payload:row.payload||{},
    createdAt:row.created_at
  }));
}

async function seedFoundingHistory(sql){
  await sql`
    INSERT INTO town_history(event_key,title,summary,game_day,payload)
    VALUES(
      'founding:settlement',
      'The First Settlement was founded',
      'Five buildings stood along the dirt road: inn, smithy, storehouse, healer’s cottage, and council hall.',
      1,
      '{"source":"chronicle"}'::jsonb
    )
    ON CONFLICT (event_key) DO NOTHING
  `;
  await sql`
    INSERT INTO town_history(event_key,title,summary,game_day,payload)
    SELECT
      'project_complete:western_crossing',
      'The Western Crossing was completed',
      'Travelers finished the first permanent river crossing, opening the western bank.',
      2,
      jsonb_build_object('projectKey','western_crossing','legacy',true,'unlocks',jsonb_build_array('western_bank'))
    WHERE EXISTS (
      SELECT 1 FROM world_state
      WHERE key='western_crossing' AND COALESCE((value->>'complete')::boolean,false)=true
    )
    ON CONFLICT (event_key) DO NOTHING
  `;
}

function inventoryPayload(player,crafted={}){
  return{
    wood:Number(player.wood||0),
    stone:Number(player.stone||0),
    herbs:Number(player.herbs||0),
    coins:Number(player.coins||0),
    // Crafted specialty materials for contribution UI gating (server still debits authoritatively).
    iron:Number(crafted.iron||crafted['iron-fittings']||0),
    tools:Number(crafted.tools||crafted['stone-hammer']||0),
    furniture:Number(crafted.furniture||crafted['rough-stool']||0),
    rations:Number(crafted.rations||crafted['trail-rations']||0),
    'iron-fittings':Number(crafted['iron-fittings']||crafted.iron||0),
    'stone-hammer':Number(crafted['stone-hammer']||crafted.tools||0),
    'rough-stool':Number(crafted['rough-stool']||crafted.furniture||0),
    'trail-rations':Number(crafted['trail-rations']||crafted.rations||0)
  };
}

async function craftedCounts(sql,playerId){
  if(!playerId)return{};
  try{
    const rows=await sql`
      SELECT item_key,SUM(COALESCE(quantity,1))::int AS total
      FROM player_crafted_items
      WHERE player_id=${playerId} AND placed_at IS NULL AND COALESCE(quantity,1)>0
      GROUP BY item_key
    `;
    const byItem=Object.fromEntries(rows.map(row=>[row.item_key,Number(row.total||0)]));
    const byAlias={};
    for(const [alias,itemKey] of Object.entries(CRAFTED_MATERIALS)){
      byAlias[alias]=Number(byItem[itemKey]||0);
      byAlias[itemKey]=Number(byItem[itemKey]||0);
    }
    return byAlias;
  }catch{
    return{};
  }
}

function demandView(demand={}){
  const next={...normalizeDemand(demand),tiers:{}};
  for(const key of Object.keys(normalizeDemand({}))){
    if(['version','updatedAt','lastTick','activeEvent'].includes(key))continue;
    next.tiers[key]=demandTier(next[key]);
  }
  return next;
}

async function statusPayload(sql,player=null){
  await ensureProjects(sql);
  await seedFoundingHistory(sql);
  const [rows,demand,history,day,stockpileRows,playerContrib,crafted]=await Promise.all([
    projectRows(sql),
    readDemand(sql),
    readHistory(sql),
    readDay(sql),
    sql`SELECT value FROM world_state WHERE key='settlement_stockpile' LIMIT 1`,
    player?playerTotals(sql,player.id):Promise.resolve({}),
    player?craftedCounts(sql,player.id):Promise.resolve({})
  ]);
  const queue=activeProjectQueue(rows);
  const views=queue.all.map(view=>{
    const contrib=playerContrib[view.key]||{};
    return{
      ...view,
      playerContribution:contrib,
      playerTotal:Object.values(contrib).reduce((sum,n)=>sum+Number(n||0),0),
      constructionStage:structureRenderEntity(projectByKey(view.key),view.percent,{completed:view.status==='complete'})?.constructionStage||null
    };
  });
  const active=views.find(view=>view.status!=='complete')||null;
  const completed=views.filter(view=>view.status==='complete');
  const stock=stockpileRows[0]?.value||{};
  const townIdentity=townIdentityFromProjects(completed.map(view=>view.key));
  return{
    ok:true,
    activeProject:active,
    projects:views,
    completedProjects:completed,
    townIdentity,
    structures:completedStructures(rows),
    unlocks:unlockedCapabilities(rows),
    demand:demandView(demand),
    history,
    gameDay:day,
    stockpile:{wood:Number(stock.wood||0),stone:Number(stock.stone||0),herbs:Number(stock.herbs||0)},
    inventory:player?inventoryPayload(player,crafted):null,
    catalog:TOWN_PROJECTS.map(project=>({
      key:project.key,
      name:project.name,
      order:project.order,
      required:{...project.required},
      unlocks:[...project.unlocks]
    }))
  };
}

async function claimReceipt(sql,playerId,key,action){
  const prior=await sql`
    SELECT response FROM town_project_receipts
    WHERE player_id=${playerId} AND idempotency_key=${key}
    LIMIT 1
  `;
  if(prior.length)return{prior:prior[0].response};
  const made=await sql`
    INSERT INTO town_project_receipts(player_id,idempotency_key,action,response)
    VALUES(${playerId},${key},${action},'{"ok":false,"error":"pending"}'::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING player_id
  `;
  return made.length?{}:{prior:{ok:false,error:'action_in_progress'}};
}

async function finishReceipt(sql,playerId,key,response){
  await sql`
    UPDATE town_project_receipts
    SET response=${JSON.stringify(response)}::jsonb
    WHERE player_id=${playerId} AND idempotency_key=${key}
  `;
  return response;
}

async function debitInventory(sql,playerId,resource,amount){
  if(resource==='wood'){
    const rows=await sql`
      UPDATE player_inventory SET wood=wood-${amount},updated_at=now()
      WHERE player_id=${playerId} AND wood>=${amount}
      RETURNING wood,stone,herbs,coins
    `;
    return rows[0]||null;
  }
  if(resource==='stone'){
    const rows=await sql`
      UPDATE player_inventory SET stone=stone-${amount},updated_at=now()
      WHERE player_id=${playerId} AND stone>=${amount}
      RETURNING wood,stone,herbs,coins
    `;
    return rows[0]||null;
  }
  if(resource==='herbs'){
    const rows=await sql`
      UPDATE player_inventory SET herbs=herbs-${amount},updated_at=now()
      WHERE player_id=${playerId} AND herbs>=${amount}
      RETURNING wood,stone,herbs,coins
    `;
    return rows[0]||null;
  }
  if(resource==='coins'){
    const rows=await sql`
      UPDATE player_inventory SET coins=coins-${amount},updated_at=now()
      WHERE player_id=${playerId} AND coins>=${amount}
      RETURNING wood,stone,herbs,coins
    `;
    return rows[0]||null;
  }
  return null;
}

async function debitCrafted(sql,playerId,itemKey,amount){
  let remaining=amount;
  const stacks=await sql`
    SELECT id,COALESCE(quantity,1) AS quantity
    FROM player_crafted_items
    WHERE player_id=${playerId} AND item_key=${itemKey} AND placed_at IS NULL AND COALESCE(quantity,1)>0
    ORDER BY crafted_at ASC
    FOR UPDATE
  `;
  const available=stacks.reduce((sum,row)=>sum+Number(row.quantity||0),0);
  if(available<amount)return null;
  for(const stack of stacks){
    if(remaining<=0)break;
    const have=Number(stack.quantity||0);
    const take=Math.min(have,remaining);
    if(take>=have)await sql`DELETE FROM player_crafted_items WHERE id=${stack.id} AND player_id=${playerId}`;
    else await sql`UPDATE player_crafted_items SET quantity=quantity-${take} WHERE id=${stack.id} AND player_id=${playerId}`;
    remaining-=take;
  }
  return remaining===0?{itemKey,amount}:null;
}

async function readRenderEntities(sql){
  const renderRows=await sql`SELECT value FROM world_state WHERE key='render_entities' LIMIT 1`;
  const raw=renderRows[0]?.value;
  if(Array.isArray(raw))return[...raw];
  if(Array.isArray(raw?.entities))return[...raw.entities];
  if(raw&&typeof raw==='object')return Object.values(raw).filter(item=>item&&typeof item==='object');
  return[];
}

async function writeRenderEntities(sql,list){
  await sql`
    INSERT INTO world_state(key,value,updated_at)
    VALUES('render_entities',${JSON.stringify(list)}::jsonb,now())
    ON CONFLICT(key) DO UPDATE SET value=${JSON.stringify(list)}::jsonb,updated_at=now()
  `;
}

async function upsertStructureEntity(sql,entity){
  if(!entity?.id)return;
  const list=await readRenderEntities(sql);
  const index=list.findIndex(item=>String(item.id||item.key)===String(entity.id));
  if(index>=0)list[index]={...list[index],...entity};
  else list.push(entity);
  await writeRenderEntities(sql,list);
}

async function persistStructure(sql,project,{percent=100,completed=true}={}){
  const entity=structureRenderEntity(project,percent,{completed});
  if(!entity)return;
  await upsertStructureEntity(sql,entity);
}

async function markComplete(sql,project,player,contributed){
  const gameDay=await readDay(sql);
  await sql`
    UPDATE town_projects
    SET status='complete',
        contributed=${JSON.stringify(contributed)}::jsonb,
        completed_at=now(),
        updated_at=now()
    WHERE project_key=${project.key} AND status='active'
  `;
  const entry=historyEntryFromProject(project,{gameDay,playerName:player.display_name});
  await sql`
    INSERT INTO town_history(event_key,title,summary,game_day,payload)
    VALUES(
      ${entry.eventKey},
      ${entry.title},
      ${entry.summary},
      ${entry.gameDay},
      ${JSON.stringify(entry.payload)}::jsonb
    )
    ON CONFLICT (event_key) DO NOTHING
  `;
  await sql`
    INSERT INTO world_events(player_id,event_type,payload)
    VALUES(
      ${player.id},
      'town_project_completed',
      ${JSON.stringify({
        projectKey:project.key,
        unlocks:project.unlocks,
        structure:project.structure,
        gameDay
      })}::jsonb
    )
  `;
  await persistStructure(sql,project,{percent:100,completed:true});
}

async function contribute(sql,player,body){
  await ensureProjects(sql);
  const projectKey=clean(body.projectKey,40);
  const project=projectByKey(projectKey);
  if(!project)return{ok:false,error:'unknown_project'};

  const parsed=normalizeContribution(body.resource,body.amount,{max:100});
  if(!parsed.ok)return parsed;

  const locked=await sql`
    SELECT project_key,status,contributed,required
    FROM town_projects
    WHERE project_key=${project.key}
    FOR UPDATE
  `;
  if(!locked.length)return{ok:false,error:'project_missing'};
  const row=locked[0];
  if(row.status==='complete')return{ok:false,error:'project_already_complete'};

  const plan=acceptContribution(project.required,row.contributed||{},parsed.key,parsed.amount);
  if(!plan.ok)return plan;

  let inventory=inventoryPayload(player);
  if(parsed.kind==='inventory'){
    const debited=await debitInventory(sql,player.id,parsed.key,plan.accepted);
    if(!debited)return{ok:false,error:'not_enough_materials'};
    const crafted=await craftedCounts(sql,player.id);
    inventory=inventoryPayload({
      wood:Number(debited.wood||0),
      stone:Number(debited.stone||0),
      herbs:Number(debited.herbs||0),
      coins:Number(debited.coins||0)
    },crafted);
  }else{
    const itemKey=parsed.itemKey||CRAFTED_MATERIALS[parsed.key];
    const debited=await debitCrafted(sql,player.id,itemKey,plan.accepted);
    if(!debited)return{ok:false,error:'not_enough_materials'};
    const fresh=await sql`
      SELECT wood,stone,herbs,COALESCE(coins,0) AS coins
      FROM player_inventory WHERE player_id=${player.id} LIMIT 1
    `;
    const crafted=await craftedCounts(sql,player.id);
    inventory=inventoryPayload(fresh[0]||player,crafted);
  }

  await sql`
    UPDATE town_projects
    SET contributed=${JSON.stringify(plan.contributed)}::jsonb,updated_at=now()
    WHERE project_key=${project.key} AND status='active'
  `;
  await sql`
    INSERT INTO town_project_contributions(project_key,player_id,resource,amount)
    VALUES(${project.key},${player.id},${parsed.key},${plan.accepted})
  `;
  await sql`
    INSERT INTO world_events(player_id,event_type,payload)
    VALUES(
      ${player.id},
      'town_project_contribution',
      ${JSON.stringify({
        projectKey:project.key,
        resource:parsed.key,
        amount:plan.accepted,
        complete:plan.complete
      })}::jsonb
    )
  `;

  const percent=progressPercent(project.required,plan.contributed);
  if(plan.complete)await markComplete(sql,project,player,plan.contributed);
  else await persistStructure(sql,project,{percent,completed:false});

  const status=await statusPayload(sql,{...player,...inventory});
  return{
    ok:true,
    action:'contribute',
    projectKey:project.key,
    resource:parsed.key,
    amount:plan.accepted,
    complete:plan.complete,
    inventory,
    activeProject:status.activeProject,
    projects:status.projects,
    completedProjects:status.completedProjects,
    structures:status.structures,
    unlocks:status.unlocks,
    history:status.history,
    demand:status.demand
  };
}

export default async function handler(req){
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    await ensureSchema(sql);
    const url=new URL(req.url);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);
    const player=clientId?await actor(sql,clientId):null;

    if(req.method==='GET'){
      return reply(await statusPayload(sql,player));
    }
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    if(!clientId)return reply({ok:false,error:'client_id_required'},400);
    if(!player)return reply({ok:false,error:'player_not_registered'},409);

    const action=clean(body.action,40)||'contribute';
    const key=clean(body.idempotencyKey,100);
    if(!key)return reply({ok:false,error:'idempotency_key_required'},400);

    const claimed=await claimReceipt(sql,player.id,key,action);
    if(claimed.prior){
      const prior=claimed.prior;
      return reply(prior,prior?.ok?200:409);
    }

    let result;
    if(action==='contribute')result=await contribute(sql,player,body);
    else if(action==='status')result=await statusPayload(sql,player);
    else result={ok:false,error:'unknown_action'};

    await finishReceipt(sql,player.id,key,result);
    return reply(result,result.ok?200:409);
  }catch(error){
    console.error('GPTWorld town-projects error',error);
    const msg=String(error?.message||error||'');
    if(/town_projects|town_history|town_project_/.test(msg)){
      return reply({ok:false,error:'town_projects_migration_required'},500);
    }
    return reply({ok:false,error:'town_projects_failed',detail:msg.slice(0,180)},500);
  }
}
