from pathlib import Path
p=Path('netlify/functions/disaster-tick.mjs');s=p.read_text()
insert=r'''
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,Number(v)||0));}
function applyDisasterEcology(ecosystem,disasters,weather){
  if(!ecosystem||!Array.isArray(ecosystem.species))return ecosystem;
  const eco=structuredClone(ecosystem), active=Array.isArray(disasters?.active)?disasters.active:[];
  eco.disturbance ||= {version:1,history:[]};
  for(const d of active){
    const stamp=`${d.id}:${d.remainingTicks}`;if(eco.disturbance.lastStamp===stamp)continue;
    const sev=clamp(d.severity,.1,1);let summary='';
    if(d.type==='wildfire'){
      let lost=0;for(const sp of eco.species){if(sp.kind==='plant'){const n=Math.round(Number(sp.population||0)*sev*.09);sp.population=Math.max(25,Number(sp.population||0)-n);lost+=n;sp.disturbance='burned';}else{sp.needs ||= {};sp.needs.fear=clamp(Number(sp.needs.fear||0)+sev*.3);sp.goal='flee fire';}}
      for(const h of Object.values(eco.habitats||{})){h.status='burned';h.fireScar=sev;}summary=`Wildfire burned ${lost} vegetation units and displaced wildlife.`;
    }else if(d.type==='flood'){
      let lost=0;for(const sp of eco.species){if(String(sp.habitat||'').includes('river')){if(sp.kind==='plant'){const n=Math.round(Number(sp.population||0)*sev*.05);sp.population=Math.max(25,Number(sp.population||0)-n);lost+=n;}else{sp.goal='move to high ground';}}}
      if(eco.habitats?.riverbank){eco.habitats.riverbank.status='flooded';eco.habitats.riverbank.floodLevel=sev;}summary=`Flooding reshaped the riverbank and removed ${lost} vegetation units.`;
    }else if(d.type==='severeStorm'){
      for(const sp of eco.species.filter(x=>x.kind!=='plant')){sp.needs ||= {};sp.needs.energy=clamp(Number(sp.needs.energy??.5)-sev*.12);sp.goal='seek shelter';}summary='Severe weather drove wildlife into shelter and reduced foraging.';
    }else if(d.type==='disease'){
      let deaths=0;for(const sp of eco.species.filter(x=>x.kind!=='plant')){const n=Math.round(Number(sp.population||0)*sev*.025);sp.population=Math.max(0,Number(sp.population||0)-n);deaths+=n;sp.diseasePressure=sev;}summary=`Disease caused ${deaths} wildlife deaths.`;
    }
    if(summary)eco.disturbance.history=[...(eco.disturbance.history||[]),{id:d.id,type:d.type,severity:sev,summary,at:new Date().toISOString()}].slice(-20);
    eco.disturbance.lastStamp=stamp;
  }
  const drought=clamp(weather?.drought);if(drought>.55){for(const sp of eco.species.filter(x=>x.kind==='plant')){sp.lifeCycle ||= {};sp.lifeCycle.waterStress=Math.max(Number(sp.lifeCycle.waterStress||0),drought);sp.disturbance='drought stressed';}for(const h of Object.values(eco.habitats||{}))if(h.status==='stable'||h.status==='lush')h.status='dry';}
  return eco;
}
'''
s=s.replace("import { initialWeather, initialDisasters, advanceDisasters } from './_sim-core.mjs';", "import { initialWeather, initialDisasters, advanceDisasters } from './_sim-core.mjs';"+insert)
old="    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='disaster_sim'`;"
new="    const impacted=applyDisasterEcology(world.ecosystem||null,next,world.weather_sim||initialWeather());\n    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='disaster_sim'`;\n    if(impacted)await sql`UPDATE world_state SET value=${JSON.stringify(impacted)}::jsonb,updated_at=now() WHERE key='ecosystem'`;"
assert old in s;s=s.replace(old,new,1);p.write_text(s)

p=Path('netlify/functions/_sim-core.mjs');s=p.read_text()
old="export function ecologyRenderEntities(ecosystem,now=Date.now(),weather=null,observer=null){\n const species="
new="export function ecologyRenderEntities(ecosystem,now=Date.now(),weather=null,observer=null){\n const disturbance=ecosystem?.disturbance||{};const last=(disturbance.history||[]).slice(-1)[0]||null;\n const species="
assert old in s;s=s.replace(old,new,1)
old=" const season=String(weather?.season||'Spring');"
new=" if(last?.type==='wildfire'){for(let i=0;i<8;i++)part(out,`eco-burn-scar-${i}`,-2+i*2.1,10+(i%2)*1.2,1.8,.03,1.3,'#3f392f',{part:'burn-scar',disaster:last.id});}\n if(last?.type==='flood'){for(let i=0;i<6;i++)part(out,`eco-flood-mark-${i}`,-20+i*.8,-5+i*2.3,.7,.04,1.4,'#526f73',{part:'flood-mark',disaster:last.id});}\n const season=String(weather?.season||'Spring');"
assert old in s;s=s.replace(old,new,1);p.write_text(s)
