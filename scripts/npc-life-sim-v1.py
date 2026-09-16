from pathlib import Path
p=Path('netlify/functions/living-systems.mjs');s=p.read_text()
start=s.index('function npcState(');end=s.index('\n\nexport default async req=>',start)
new=r'''function npcState(hour,existing={},recent=[],weather={},needs={}){
  const period=hour<6?'night':hour<10?'morning':hour<17?'day':hour<21?'evening':'night';
  const profiles={
    'Mara the Keeper':{role:'Innkeeper',home:'Wayfarer Inn',traits:['social','observant'],plans:{morning:['Wayfarer Inn',2,-4,'preparing the common room'],day:['Wayfarer Inn',2,-4,'serving travelers and collecting rumors'],evening:['storehouse',4,7,'checking settlement supplies'],night:['Wayfarer Inn',2,-4,'resting at the inn']}},
    'Tovan the Smith':{role:'Smith',home:'smithy',traits:['practical','steady'],plans:{morning:['smithy',9,2,'lighting the forge'],day:['smithy',9,2,'working metal and repairing tools'],evening:['council hall',-6,5,'discussing materials and repairs'],night:['smithy',9,2,'banking the forge']}},
    'Edda the Healer':{role:'Healer',home:'healer’s cottage',traits:['careful','curious'],plans:{morning:['healer’s cottage',-4,-4,'sorting herbs and remedies'],day:['herb plots',-10,13,'gathering and studying plants'],evening:['healer’s cottage',-4,-4,'tending patients and recording remedies'],night:['healer’s cottage',-4,-4,'resting at the cottage']}}
  };
  const memoriesByNpc={...(existing.memories||{})},people={...(existing.people||{})};
  for(const [name,profile] of Object.entries(profiles)){
    const old=Array.isArray(memoriesByNpc[name])?memoriesByNpc[name]:[],seen=new Set(old.map(m=>m.event_id));
    const person=people[name]||{name,role:profile.role,home:profile.home,traits:profile.traits,relationships:{},needs:{food:.18,rest:.12,safety:.08,social:.18},knownTravelers:{}};
    person.role=profile.role;person.home=profile.home;person.traits=profile.traits;
    for(const ev of recent){if(seen.has(ev.id))continue;const type=String(ev.event_type||''),p=ev.payload||{};const relevant=name.startsWith('Mara')||(name.startsWith('Tovan')&&['bridge_contribution','western_crossing_completed','stockpile_deposit','world_aging_milestone'].includes(type))||(name.startsWith('Edda')&&['resource_gathered','gather','stockpile_deposit','ecosystem_year_advanced','weather_changed','world_aging_milestone'].includes(type));if(!relevant)continue;
      let text=type.replaceAll('_',' ');if(type==='stockpile_deposit')text=`${ev.display_name||'A traveler'} deposited ${p.amount||1} ${p.resource||'supplies'} into the storehouse.`;else if(type==='western_crossing_completed')text='The Western Crossing was completed by the settlement.';else if(type==='bridge_contribution')text=`${ev.display_name||'A traveler'} helped build the Western Crossing.`;else if(type==='resource_gathered'||type==='gather')text=`${ev.display_name||'A traveler'} gathered ${p.resource||'resources'} nearby.`;else if(type==='ecosystem_year_advanced')text=`The valley ecosystem advanced to Eco Year ${p.simulatedYear||'?'}.`;else if(type==='weather_changed')text=`The weather changed to ${p.condition||'new conditions'}.`;else if(type==='world_aging_milestone')text=`The settlement shows new signs of age: ${p.note||'time has left a mark'}.`;
      old.push({event_id:ev.id,type,text,traveler:ev.display_name||null,at:ev.created_at});seen.add(ev.id);if(ev.display_name){const k=ev.display_name,rel=person.knownTravelers[k]||{familiarity:0,helpfulActs:0};rel.familiarity=Math.min(100,rel.familiarity+8);if(['stockpile_deposit','bridge_contribution','resource_gathered','gather'].includes(type))rel.helpfulActs+=1;person.knownTravelers[k]=rel;}}
    memoriesByNpc[name]=old.slice(-12);
    const n=person.needs||{};n.food=Math.min(1,Number(n.food||0)+.025);n.rest=period==='night'?Math.max(.04,Number(n.rest||0)-.12):Math.min(1,Number(n.rest||0)+.018);n.social=Math.min(1,Number(n.social||0)+(period==='night'?.005:.012));n.safety=Math.max(.04,Number(n.safety||0)-.01);
    const badWeather=['storm'].includes(String(weather.condition||''));if(badWeather)n.safety=Math.min(1,n.safety+.42);if(String(needs.status||'')==='shortage'||String(needs.status||'')==='strained')n.food=Math.min(1,n.food+.16);person.needs=n;
    const base=profile.plans[period];let row=base,reason='routine';if(n.safety>.62){row=[profile.home,base[1],base[2],`sheltering from ${weather.condition||'dangerous conditions'}`];reason='safety';}else if(n.rest>.78){row=[profile.home,base[1],base[2],'resting after a long day'];reason='rest';}else if(n.food>.78){row=['storehouse',4,7,'looking for food and checking supplies'];reason='food';}
    person.current={period,location:row[0],x:row[1],z:row[2],activity:row[3],reason};person.updatedAt=new Date().toISOString();people[name]=person;
  }
  const routines={};for(const [name,p] of Object.entries(people)){const c=p.current;routines[name]={period:c.period,location:c.location,x:c.x,z:c.z,activity:c.activity,reason:c.reason,role:p.role,needs:p.needs,memoryCount:(memoriesByNpc[name]||[]).length};}
  return {version:2,period,updatedAt:new Date().toISOString(),routines,memories:memoriesByNpc,people};
}'''
s=s[:start]+new+s[end:]
s=s.replace("const nextNpc=npcState(hour,world.npc_life||{},recent.reverse());", "const nextNpc=npcState(hour,world.npc_life||{},recent.reverse(),world.living_weather||{},world.settlement_needs||{});")
p.write_text(s)

p=Path('main.js');s=p.read_text()
s=s.replace("if(item.type==='npc')return `Person: ${item.label}${item.activity?` · ${item.activity}`:''}.`;", "if(item.type==='npc'){const role=item.role?` · ${item.role}`:'';const reason=item.reason&&item.reason!=='routine'?` · ${item.reason}`:'';return `Person: ${item.label}${role}${item.activity?` · ${item.activity}`:''}${reason}.`;}")
old="n.activity=String(r.activity||'');n.location=String(r.location||'');"
new="n.activity=String(r.activity||'');n.location=String(r.location||'');n.role=String(r.role||'Resident');n.reason=String(r.reason||'routine');n.needs=r.needs||{};"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

p=Path('index.html');s=p.read_text();import re
s=re.sub(r'\.\/main\.js\?v=[^\"\']+','./main.js?v=npc-life-1',s,1);p.write_text(s)
