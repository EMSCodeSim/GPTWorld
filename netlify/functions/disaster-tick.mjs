import { neon } from '@neondatabase/serverless';
import { initialWeather, initialDisasters, advanceDisasters } from './_sim-core.mjs';

export default async()=>{
  if(!process.env.DATABASE_URL){console.error('GPTWorld disaster tick: database unavailable');return;}
  const sql=neon(process.env.DATABASE_URL);
  try{
    const seed=initialDisasters();
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('disaster_sim',${JSON.stringify(seed)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
    const rows=await sql`SELECT key,value FROM world_state WHERE key IN ('disaster_sim','weather_sim','ecosystem')`;
    const world=Object.fromEntries(rows.map(r=>[r.key,r.value]));
    const next=advanceDisasters(world.disaster_sim||seed,world.weather_sim||initialWeather(),world.ecosystem||null);
    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='disaster_sim'`;
    await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'disaster_tick',${JSON.stringify({tick:next.tick,risks:next.risks,active:next.active.map(x=>({id:x.id,type:x.type,severity:x.severity}))})}::jsonb)`;
    console.log('GPTWorld disaster tick complete',{tick:next.tick,active:next.active.length,risks:next.risks});
  }catch(error){console.error('GPTWorld disaster tick error',String(error?.message||error));}
};

export const config={schedule:'@hourly'};
