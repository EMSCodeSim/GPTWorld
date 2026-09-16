import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const meaningfulTypes = new Set([
  'resource_gathered','stockpile_deposit','town_building_upgraded','trail_marker_placed',
  'bridge_contribution','western_crossing_completed','sim_interaction','ecosystem_year_advanced',
  'weather_changed','settlement_consumption','world_aging_milestone'
]);

function eventStory(event){
  const type=String(event?.event_type||''),p=event?.payload||{},actor=event?.display_name||'The living world';
  const base={id:Number(event?.id||0),type,actor,occurred_at:event?.created_at||null,location:Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.z))?{x:Number(p.x),z:Number(p.z)}:null};
  if(type==='resource_gathered')return{...base,title:`${p.resource||'Resource'} gathered`,what:`${actor} gathered ${Number(p.amount||1)} ${p.resource||'resource'} at ${p.nodeId||'the valley'}.`,why:'Repeated harvesting changes resource pressure and where renewable resources return.',next:Number(p.remaining||0)<=0?'This site is depleted; renewable life may establish in another suitable habitat.':'The site remains productive for now.'};
  if(type==='stockpile_deposit')return{...base,title:'Supplies entered the settlement',what:`${actor} deposited ${Number(p.amount||1)} ${p.resource||'supplies'}.`,why:'Shared supplies determine which town projects can be completed.',next:'These materials may become part of a permanent building upgrade.'};
  if(type==='town_building_upgraded')return{...base,title:'The settlement physically changed',what:`${actor} upgraded the ${String(p.building||'building').replaceAll('_',' ')} to Level ${Number(p.level||2)}.`,why:'Travelers committed shared storehouse materials to this project.',next:'The improved building is now part of the settlement’s lasting history.'};
  if(type==='trail_marker_placed')return{...base,title:'A new route was marked',what:`${actor} placed a trail marker.`,why:'A traveler spent personal wood and stone to make this route easier to follow.',next:`Weather will age this marker over roughly ${Number(p.decayDays||14)} days.`};
  if(type==='bridge_contribution')return{...base,title:'The Western Crossing gained materials',what:`${actor} contributed wood or stone to the bridge.`,why:'Travelers needed a safe route across the western river.',next:p.complete?'The completed crossing permanently opened the western bank.':'Further contributions are still needed.'};
  if(type==='western_crossing_completed')return{...base,title:'The Western Crossing was completed',what:'The settlement finished its first permanent river crossing.',why:'Multiple traveler contributions accumulated into one shared structure.',next:'Travel, ecology, and future development can now extend west of the river.'};
  if(type==='sim_interaction')return{...base,title:'A traveler changed a living system',what:`${actor} chose to ${String(p.action||'intervene').replaceAll('_',' ')}.`,why:`The action directly affected ${String(p.sim||'the world simulation').replaceAll('_',' ')}.`,next:String(p.effect||'The effect will remain in the simulated world.')};
  if(type==='ecosystem_year_advanced')return{...base,title:`Ecology reached Year ${Number(p.simulatedYear||0)}`,what:`The valley now supports ${Number(p.species||0)} recorded species.`,why:'Plant and animal populations continued living independently of the narrative day.',next:Number(p.extinct||0)>0?`${Number(p.extinct)} species are now part of the extinction record.`:'Population changes will influence later habitats and risks.'};
  if(type==='settlement_consumption')return{...base,title:'The settlement consumed supplies',what:`The settlement used ${Number(p.consumed?.wood||0)} wood, ${Number(p.consumed?.stone||0)} stone, and ${Number(p.consumed?.herbs||0)} herbs.`,why:'Buildings and residents require continuing support.',next:`Settlement condition is ${p.status||'being assessed'} (${Number(p.score||0)}/100).`};
  if(type==='world_aging_milestone')return{...base,title:'Time left a visible mark',what:String(p.note||'The settlement aged.'),why:'The world continues changing even when no traveler is present.',next:'Wear, regrowth, and patina will accumulate instead of resetting.'};
  if(type==='weather_changed')return{...base,title:'Weather changed',what:`Conditions shifted to ${p.condition||'new weather'}.`,why:'The live weather simulation continued advancing.',next:'Moisture, temperature, and wind can affect ecology and disaster risk.'};
  return{...base,title:type.replaceAll('_',' '),what:`${actor} caused a recorded world event.`,why:'The event was preserved in the shared world ledger.',next:'Future evolution can use this event as evidence.'};
}

function worldPressures(events,world){
  const gathered={wood:0,stone:0,herbs:0},depleted={wood:0,stone:0,herbs:0};let upgrades=0,markers=0;
  for(const event of events){const p=event.payload||{};if(event.event_type==='resource_gathered'){const resource=String(p.resource||'');if(resource in gathered){gathered[resource]+=Number(p.amount||1);if(Number(p.remaining||0)<=0)depleted[resource]++;}}else if(event.event_type==='town_building_upgraded')upgrades++;else if(event.event_type==='trail_marker_placed')markers++;}
  const pressures=[];
  if(gathered.wood)pressures.push({id:'forest-use',label:'Forest use',strength:Math.min(100,gathered.wood*12+depleted.wood*22),evidence:`${gathered.wood} wood gathered; ${depleted.wood} recent depletion${depleted.wood===1?'':'s'}.`,possible_consequence:depleted.wood?'New trees may establish away from exhausted sites, shifting habitat.':'Continued cutting could begin changing forest cover.'});
  if(gathered.stone)pressures.push({id:'stone-use',label:'Stone extraction',strength:Math.min(100,gathered.stone*16+depleted.stone*28),evidence:`${gathered.stone} stone gathered; ${depleted.stone} deposit${depleted.stone===1?'':'s'} exhausted.`,possible_consequence:depleted.stone?'Finite deposits may force exploration for new stone sites.':'Known deposits are under increasing pressure.'});
  if(gathered.herbs)pressures.push({id:'herb-use',label:'Medicinal plant use',strength:Math.min(100,gathered.herbs*14+depleted.herbs*20),evidence:`${gathered.herbs} herbs gathered; ${depleted.herbs} patch depletion${depleted.herbs===1?'':'s'}.`,possible_consequence:'Harvest pressure and weather may change where herbs recolonize.'});
  if(upgrades)pressures.push({id:'settlement-growth',label:'Settlement growth',strength:Math.min(100,35+upgrades*25),evidence:`${upgrades} building upgrade${upgrades===1?'':'s'} recorded recently.`,possible_consequence:'A larger settlement will consume more supplies and develop a stronger identity.'});
  if(markers)pressures.push({id:'travel-network',label:'Travel network',strength:Math.min(100,25+markers*18),evidence:`${markers} player-made trail marker${markers===1?'':'s'} entered the world.`,possible_consequence:'Repeated routes can become recognized paths, while unused markers decay.'});
  if(world?.western_crossing?.complete)pressures.push({id:'western-expansion',label:'Western expansion',strength:55,evidence:'The Western Crossing permanently connects the far bank.',possible_consequence:'Travel, settlement projects, and ecological disturbance can now spread west.'});
  return pressures.sort((a,b)=>b.strength-a.strength);
}

export default async (req) => {
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [worldRows, recentEvents, activityRows, populationRows] = await Promise.all([
      sql`SELECT key, value, updated_at FROM world_state ORDER BY key`,
      sql`SELECT we.id, we.event_type, we.payload, we.created_at, p.display_name FROM world_events we LEFT JOIN players p ON p.id = we.player_id ORDER BY we.created_at DESC LIMIT 50`,
      sql`SELECT event_type, count(*)::int AS count, max(created_at) AS last_seen_at FROM world_events WHERE created_at > now() - interval '24 hours' GROUP BY event_type ORDER BY count(*) DESC, event_type ASC`,
      sql`SELECT count(*)::int AS known_players, count(*) FILTER (WHERE last_seen_at > now() - interval '24 hours')::int AS active_24h, count(*) FILTER (WHERE last_seen_at > now() - interval '90 seconds')::int AS online_now FROM players`
    ]);

    const world = Object.fromEntries(worldRows.map((row) => [row.key, row.value]));
    const entities = world.world_entities || {};
    const latestSnapshotRef = world.latest_world_snapshot || null;
    const latestSnapshot = latestSnapshotRef?.key ? world[latestSnapshotRef.key] || null : null;

    const ordinaryState = Object.fromEntries(
      Object.entries(world).filter(([key]) =>
        key !== 'world_entities'
        && key !== 'latest_world_snapshot'
        && !key.startsWith('world_snapshot_')
      )
    );

    const memoryEvents=recentEvents.filter(event=>meaningfulTypes.has(String(event.event_type||'')));
    return json({
      ok: true,
      generated_at: new Date().toISOString(),
      current_day: world.current_day || null,
      world: ordinaryState,
      entities,
      snapshots: {
        latest_ref: latestSnapshotRef,
        latest: latestSnapshot
      },
      population: populationRows[0] || {},
      activity_24h: activityRows,
      recent_events: recentEvents,
      living_memory: {
        promise: 'Player actions become permanent evidence that future world evolution can use.',
        pressures: worldPressures(memoryEvents,ordinaryState),
        stories: memoryEvents.slice(0,24).map(eventStory)
      },
      evolution_context: {
        current_day: world.current_day || null,
        active_projects: Object.entries(ordinaryState)
          .filter(([key, value]) => key !== 'current_day' && value && typeof value === 'object' && value.complete === false)
          .map(([key, value]) => ({ key, value })),
        completed_projects: Object.entries(ordinaryState)
          .filter(([key, value]) => value && typeof value === 'object' && value.complete === true)
          .map(([key, value]) => ({ key, value })),
        persistent_entities: Object.values(entities),
        event_cursor: latestSnapshotRef?.event_cursor || null
      }
    });
  } catch (error) {
    console.error('GPTWorld world-memory error', error);
    return json({ ok: false, error: 'world_memory_failed' }, 500);
  }
};
