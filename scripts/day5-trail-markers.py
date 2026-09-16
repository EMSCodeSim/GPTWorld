from pathlib import Path

# Server-authoritative placement action: costs 2 wood + 1 stone and appends a persistent render entity atomically.
p=Path('netlify/functions/world-v2.mjs'); s=p.read_text()
anchor="      if (body.action === 'contribute_bridge') {"
assert anchor in s, 'world-v2 action anchor missing'
block="""      if (body.action === 'place_trail_marker') {
        const result = await sql`
          WITH current AS (
            SELECT value FROM world_state WHERE key = 'render_entities' FOR UPDATE
          ), deduct AS (
            UPDATE player_inventory
            SET wood = wood - 2, stone = stone - 1, updated_at = now()
            WHERE player_id = ${playerId} AND wood >= 2 AND stone >= 1
            RETURNING wood, stone, herbs
          ), updated AS (
            UPDATE world_state ws
            SET value = jsonb_set(
              COALESCE(ws.value, '{\"entities\":[]}'::jsonb),
              '{entities}',
              COALESCE(ws.value->'entities','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                'id', 'trail-marker-' || ${playerId}::text || '-' || floor(extract(epoch from clock_timestamp())*1000)::bigint::text,
                'type','object','x',${x},'z',${z},'width',0.22,'height',2.1,'depth',0.22,'color','#765236',
                'label','Traveler trail marker','createdDay',5,'createdBy',${name}
              )), updated_at = now()
            FROM current, deduct WHERE ws.key = 'render_entities'
            RETURNING ws.value, deduct.wood, deduct.stone, deduct.herbs
          ), logged AS (
            INSERT INTO world_events(player_id,event_type,payload)
            SELECT ${playerId}, 'trail_marker_placed', jsonb_build_object('x',${x},'z',${z},'day',5,'cost',jsonb_build_object('wood',2,'stone',1)) FROM updated
            RETURNING id
          ) SELECT value,wood,stone,herbs FROM updated
        `;
        if (!result.length) return json({ ok:false, error:'not_enough_materials' },409);
        return json({ ok:true, inventory:{wood:Number(result[0].wood||0),stone:Number(result[0].stone||0),herbs:Number(result[0].herbs||0)}, render_entities:result[0].value });
      }

"""
s=s.replace(anchor,block+anchor,1); p.write_text(s)

# Client action and UI. Keep valuable state server-authoritative; client only requests placement and refreshes.
p=Path('index.html'); i=p.read_text()
old='<section class="panel inventory" aria-label="Inventory"><h2>Pack</h2><div class="inventory-row">'
new='<section class="panel inventory" aria-label="Inventory"><h2>Pack</h2><button id="trailMarkerBtn" type="button" title="Place a persistent trail marker for 2 wood + 1 stone">Place Trail Marker · 2 🪵 + 1 🪨</button><div class="inventory-row">'
assert old in i, 'inventory anchor missing'; i=i.replace(old,new,1)
i=i.replace('GPTWORLD · DAY 4','GPTWORLD · DAY 5',1)
p.write_text(i)

p=Path('main.js'); s=p.read_text()
anchor="actionButton.addEventListener('click',interact);"
assert anchor in s, 'action button anchor missing'
code="""const trailMarkerBtn=document.getElementById('trailMarkerBtn');
async function placeTrailMarker(){if(!gameStarted)return;const clientId=localStorage.getItem(CLIENT_KEY);if(!clientId)return showToast('The shared world is still connecting.');if((state.inventory.wood||0)<2||(state.inventory.stone||0)<1)return showToast('A trail marker needs 2 wood and 1 stone.');trailMarkerBtn.disabled=true;try{const r=await fetch(WORLD_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,name:playerName,x:Number(player.position.x.toFixed(3)),z:Number(player.position.z.toFixed(3)),action:'place_trail_marker'})});const d=await r.json();if(!d.ok){showToast(d.error==='not_enough_materials'?'You need 2 wood and 1 stone.':'The marker could not be placed.');return}state.inventory={...state.inventory,...d.inventory};renderInventory();saveState();showToast('Trail marker placed. It is now part of the shared world.');setTimeout(refreshSharedState,250)}catch{showToast('The marker could not reach the shared world.')}finally{trailMarkerBtn.disabled=false}}
trailMarkerBtn?.addEventListener('click',placeTrailMarker);
"""
s=s.replace(anchor,anchor+code,1); p.write_text(s)
