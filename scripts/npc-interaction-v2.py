from pathlib import Path
p=Path('netlify/functions/living-systems.mjs');s=p.read_text()
old="""if(req.method==='POST'){
      const body=await req.json().catch(()=>({}));
      if(body.action!=='observe_travel')return json({ok:false,error:'invalid_action'},400);
      const x=clamp(Number(body.x||0),-40,40),z=clamp(Number(body.z||0),-40,40);
      const cx=Math.round(x/4),cz=Math.round(z/4),cell=`${cx},${cz}`;
      const rows=await sql`UPDATE world_state SET value=jsonb_set(value,'{travel}',COALESCE(value->'travel','{}'::jsonb) || jsonb_build_object(${cell}::text,COALESCE((value->'travel'->>${cell}::text)::int,0)+1),true),updated_at=now() WHERE key='world_aging' RETURNING value`;
      return json({ok:true,aging:agingState(rows[0]?.value||{})});
    }"""
new="""if(req.method==='POST'){
      const body=await req.json().catch(()=>({}));
      if(body.action==='npc_interact'){
        const npcName=String(body.npc||'').slice(0,60),traveler=String(body.traveler||'Traveler').slice(0,40);
        const rows=await sql`SELECT value FROM world_state WHERE key='npc_life'`;const life=rows[0]?.value||{};const person=life.people?.[npcName];if(!person)return json({ok:false,error:'npc_not_found'},404);
        const rel=person.knownTravelers?.[traveler]||{familiarity:0,helpfulActs:0};rel.familiarity=Math.min(100,Number(rel.familiarity||0)+4);person.knownTravelers={...(person.knownTravelers||{}),[traveler]:rel};
        const level=rel.familiarity>=55?'trusted':rel.familiarity>=18?'familiar':'stranger',mem=(life.memories?.[npcName]||[]).filter(m=>m.traveler===traveler).slice(-2);
        const needs=person.needs||{};let request=null;if(Number(needs.food||0)>.62)request={resource:'wood',reason:'settlement supplies are running thin'};if(person.role==='Healer'&&Number(needs.food||0)>.48)request={resource:'herbs',reason:'remedies need replenishing'};if(person.role==='Smith'&&Number(needs.food||0)>.48)request={resource:'stone',reason:'repairs need material'};
        const greeting=level==='trusted'?`${npcName} greets you warmly.`:level==='familiar'?`${npcName} recognizes you.`:`${npcName} studies the new face.`;
        const memory=mem.length?` I remember: ${mem[mem.length-1].text}`:'';const requestText=request?` We could use ${request.resource}; ${request.reason}.`:'';
        life.people[npcName]=person;await sql`UPDATE world_state SET value=${JSON.stringify(life)}::jsonb,updated_at=now() WHERE key='npc_life'`;await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'npc_interaction',${JSON.stringify({npc:npcName,traveler,relationship:level})}::jsonb)`;
        return json({ok:true,npc:npcName,role:person.role,relationship:level,familiarity:rel.familiarity,greeting,memory,request,dialogue:`${greeting}${memory}${requestText}`});
      }
      if(body.action!=='observe_travel')return json({ok:false,error:'invalid_action'},400);
      const x=clamp(Number(body.x||0),-40,40),z=clamp(Number(body.z||0),-40,40);
      const cx=Math.round(x/4),cz=Math.round(z/4),cell=`${cx},${cz}`;
      const rows=await sql`UPDATE world_state SET value=jsonb_set(value,'{travel}',COALESCE(value->'travel','{}'::jsonb) || jsonb_build_object(${cell}::text,COALESCE((value->'travel'->>${cell}::text)::int,0)+1),true),updated_at=now() WHERE key='world_aging' RETURNING value`;
      return json({ok:true,aging:agingState(rows[0]?.value||{})});
    }"""
assert old in s;s=s.replace(old,new,1);p.write_text(s)

p=Path('main.js');s=p.read_text()
anchor="function interact(){if(!gameStarted||!nearest)return;"
helper="""async function talkToNPC(npc){try{const r=await fetch('/.netlify/functions/living-systems',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'npc_interact',npc:npc.label,traveler:playerName})});const d=await r.json();if(d.ok){npc.relationship=d.relationship;npc.familiarity=d.familiarity;showToast(`${d.dialogue}${d.relationship?` · ${d.relationship}`:''}`);return}}catch{}const line=npc.lines[npc.lineIndex%npc.lines.length];npc.lineIndex++;showToast(`${npc.label}: ${line}${npc.activity?` · ${npc.activity}`:''}`)}
"""
assert anchor in s;s=s.replace(anchor,helper+anchor,1)
old="if(nearest.type==='npc'){const line=nearest.lines[nearest.lineIndex%nearest.lines.length];nearest.lineIndex++;setTimeout(()=>showToast(`${nearest.label}: ${line}${nearest.activity?` · ${nearest.activity}`:''}`),650);return}"
new="if(nearest.type==='npc'){setTimeout(()=>talkToNPC(nearest),420);return}"
assert old in s;s=s.replace(old,new,1)
old2="function updateNPCs(t,dt){for(const n of npcs){const dx=n.target.x-n.object.position.x,dz=n.target.z-n.object.position.z,dist=Math.hypot(dx,dz);if(dist>.14){const step=Math.min(dist,Math.max(.01,dt)*1.35);n.object.position.x+=dx/dist*step;n.object.position.z+=dz/dist*step;n.object.rotation.y=Math.atan2(dx,dz);}else{n.object.position.x=n.target.x+Math.cos(t*.00035+n.phase)*.12;n.object.position.z=n.target.z+Math.sin(t*.0003+n.phase)*.12;}}}"
new2="function updateNPCs(t,dt){for(const n of npcs){const dx=n.target.x-n.object.position.x,dz=n.target.z-n.object.position.z,dist=Math.hypot(dx,dz),moving=dist>.14;if(moving){const step=Math.min(dist,Math.max(.01,dt)*1.35);n.object.position.x+=dx/dist*step;n.object.position.z+=dz/dist*step;n.object.rotation.y=Math.atan2(dx,dz);}else{n.object.position.x=n.target.x+Math.cos(t*.00035+n.phase)*.12;n.object.position.z=n.target.z+Math.sin(t*.0003+n.phase)*.12;}animateHumanoid(n.object,moving,t,.82);if(!moving&&n.object.userData.rig&&/forge|working metal|herb|sorting|serving|supplies|tending/i.test(n.activity||'')){const r=n.object.userData.rig,a=Math.sin(t*.01+n.phase);r.armR.rotation.x=-.45-a*.72;r.armL.rotation.x=.18+a*.25;}}}"
assert old2 in s;s=s.replace(old2,new2,1);p.write_text(s)

p=Path('index.html');s=p.read_text();import re
s=re.sub(r'\.\/main\.js\?v=[^\"\']+','./main.js?v=npc-interact-2',s,1);p.write_text(s)
