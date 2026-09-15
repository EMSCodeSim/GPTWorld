import { neon } from '@neondatabase/serverless';
import { initialWeather, initialDisasters, advanceDisasters } from './_sim-core.mjs';
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


export default async()=>{
  if(!process.env.DATABASE_URL){console.error('GPTWorld disaster tick: database unavailable');return;}
  const sql=neon(process.env.DATABASE_URL);
  try{
    const seed=initialDisasters();
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('disaster_sim',${JSON.stringify(seed)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
    const rows=await sql`SELECT key,value FROM world_state WHERE key IN ('disaster_sim','weather_sim','ecosystem')`;
    const world=Object.fromEntries(rows.map(r=>[r.key,r.value]));
    const next=advanceDisasters(world.disaster_sim||seed,world.weather_sim||initialWeather(),world.ecosystem||null);
    const impacted=applyDisasterEcology(world.ecosystem||null,next,world.weather_sim||initialWeather());
    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='disaster_sim'`;
    if(impacted)await sql`UPDATE world_state SET value=${JSON.stringify(impacted)}::jsonb,updated_at=now() WHERE key='ecosystem'`;
    await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'disaster_tick',${JSON.stringify({tick:next.tick,risks:next.risks,active:next.active.map(x=>({id:x.id,type:x.type,severity:x.severity}))})}::jsonb)`;
    console.log('GPTWorld disaster tick complete',{tick:next.tick,active:next.active.length,risks:next.risks});
  }catch(error){console.error('GPTWorld disaster tick error',String(error?.message||error));}
};

export const config={schedule:'@hourly'};
