import { neon } from '@neondatabase/serverless';
import { initialWeather, advanceWeather } from './_sim-core.mjs';

export default async()=>{
  if(!process.env.DATABASE_URL){console.error('GPTWorld weather tick: database unavailable');return;}
  const sql=neon(process.env.DATABASE_URL);
  try{
    const seed=initialWeather();
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('weather_sim',${JSON.stringify(seed)}::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
    const rows=await sql`SELECT value FROM world_state WHERE key='weather_sim' LIMIT 1`;
    const current=rows[0]?.value||seed;
    const last=current.lastTickAt?Date.parse(current.lastTickAt):NaN;
    const elapsed=Number.isFinite(last)?Math.max(1,Math.min(24,Math.floor((Date.now()-last)/3600000))):1;
    const next=advanceWeather(current,elapsed);
    await sql`UPDATE world_state SET value=${JSON.stringify(next)}::jsonb,updated_at=now() WHERE key='weather_sim'`;
    await sql`INSERT INTO world_events (player_id,event_type,payload) VALUES (NULL,'weather_tick',${JSON.stringify({tick:next.tick,season:next.season,seasonDay:next.seasonDay,worldHour:next.worldHour,temperatureC:next.temperatureC,precipitation:next.precipitation,drought:next.drought})}::jsonb)`;
    console.log('GPTWorld weather tick complete',{tick:next.tick,season:next.season,day:next.seasonDay,hour:next.worldHour});
  }catch(error){console.error('GPTWorld weather tick error',String(error?.message||error));}
};

export const config={schedule:'@hourly'};
