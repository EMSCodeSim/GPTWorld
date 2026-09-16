import { neon } from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const CHOICES={
  replant:{label:'Replant disturbed ground',mitigation:18,expansion:0,effect:'New saplings will be favored around exhausted sites.'},
  managed_woodlot:{label:'Create a managed woodlot',mitigation:12,expansion:0,effect:'The settlement accepts planned cutting paired with regrowth.'},
  restrict_harvest:{label:'Restrict forest harvest',mitigation:25,expansion:0,effect:'Residents protect the most pressured forest areas.'},
  continue_expansion:{label:'Continue expansion',mitigation:0,expansion:1,effect:'Building continues, accepting greater habitat pressure.'}
};

const stageFor=(pressure)=>pressure>=70?'critical':pressure>=45?'stressed':pressure>=20?'watched':'stable';

async function ensureState(sql){
  const history=await sql`SELECT count(*)::int AS harvested,count(*) FILTER (WHERE COALESCE((payload->>'remaining')::int,1)<=0)::int AS depleted FROM world_events WHERE event_type='resource_gathered' AND payload->>'resource'='wood'`;
  const harvested=Math.min(12,Number(history[0]?.harvested||0)),depletedSites=Math.min(2,Number(history[0]?.depleted||0)),pressure=Math.min(100,harvested*2+depletedSites*8),stage=stageFor(pressure);
  const initial={version:1,harvested,depletedSites,pressure,stage,response:null,responseVotes:{replant:0,managed_woodlot:0,restrict_harvest:0,continue_expansion:0},mitigation:0,expansion:0,milestone:0,lastEventAt:null,lastNodeId:null};
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('forest_pressure',${JSON.stringify(initial)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
  if(harvested>0){const boot=await sql`UPDATE world_state SET value=${JSON.stringify({...initial,milestone:1,lastEventAt:new Date().toISOString()})}::jsonb,updated_at=now() WHERE key='forest_pressure' AND COALESCE((value->>'harvested')::int,0)=0 AND value->>'lastEventAt' IS NULL RETURNING value`;if(boot.length)await sql`INSERT INTO world_events(player_id,event_type,payload) VALUES (NULL,'forest_pressure_changed',${JSON.stringify({from:'stable',stage,pressure,milestone:1,reason:'historical_harvest_evidence'})}::jsonb)`;}
}

export default async(req)=>{
  if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    await ensureState(sql);
    if(req.method==='GET'){
      const rows=await sql`SELECT value FROM world_state WHERE key='forest_pressure' LIMIT 1`;
      return json({ok:true,forest:rows[0]?.value||null,choices:CHOICES});
    }
    if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
    const body=await req.json(),clientId=String(body.clientId||'').trim().slice(0,80),choice=String(body.choice||'');
    if(!clientId)return json({ok:false,error:'client_id_required'},400);
    if(!CHOICES[choice])return json({ok:false,error:'invalid_forest_response'},400);
    const players=await sql`SELECT id,display_name FROM players WHERE client_id=${clientId} LIMIT 1`;
    if(!players.length)return json({ok:false,error:'player_not_registered'},409);
    const player=players[0],stateRows=await sql`SELECT value FROM world_state WHERE key='forest_pressure' LIMIT 1`,before=stateRows[0]?.value||{};
    const milestone=Number(before.milestone||0);
    if(String(before.stage||'stable')==='stable')return json({ok:false,error:'no_active_forest_pressure'},409);
    const prior=await sql`SELECT id FROM world_events WHERE player_id=${player.id} AND event_type='forest_response_chosen' AND COALESCE((payload->>'milestone')::int,-1)=${milestone} LIMIT 1`;
    if(prior.length)return json({ok:false,error:'already_responded',forest:before},409);
    const spec=CHOICES[choice];
    const harvested=Number(before.harvested||0),depletedSites=Number(before.depletedSites||0);
    const mitigation=Number(before.mitigation||0)+spec.mitigation,expansion=Number(before.expansion||0)+spec.expansion;
    const pressure=Math.max(0,Math.min(100,harvested*2+depletedSites*8-mitigation+expansion*8));
    const stage=stageFor(pressure),votes={replant:0,managed_woodlot:0,restrict_harvest:0,continue_expansion:0,...(before.responseVotes||{})};
    votes[choice]=Number(votes[choice]||0)+1;
    const next={...before,version:1,pressure,stage,response:choice,responseLabel:spec.label,responseVotes:votes,mitigation,expansion,lastResponseAt:new Date().toISOString(),lastResponseBy:player.display_name};
    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='forest_pressure'`;
    await sql`INSERT INTO world_events(player_id,event_type,payload) VALUES (${player.id},'forest_response_chosen',${JSON.stringify({choice,label:spec.label,effect:spec.effect,pressure,stage,milestone})}::jsonb)`;
    return json({ok:true,forest:next,effect:spec.effect});
  }catch(error){
    console.error('GPTWorld forest-response error',error);
    return json({ok:false,error:'forest_response_failed',detail:String(error?.message||error).slice(0,180)},500);
  }
};
