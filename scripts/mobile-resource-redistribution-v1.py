from pathlib import Path

p=Path('netlify/functions/resource-state.mjs')
s=p.read_text()

old="""const RESOURCE_DEFAULTS = {
  wood:{max:6,regrowMinutes:60},
  stone:{max:4,regrowMinutes:90},
  herbs:{max:3,regrowMinutes:20}
};"""
new="""const RESOURCE_DEFAULTS = {
  wood:{max:6,regrowMinutes:60},
  stone:{max:4,regrowMinutes:90},
  herbs:{max:3,regrowMinutes:20}
};

// Depleted biological resources return as new habitat nodes instead of the same fixed node.
// Stone is finite: depleted deposits stay depleted until future geology/exploration systems expose new deposits.
const MOBILE_RESOURCES=new Set(['wood','herbs']);
const habitatSeed=(text)=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295};
function relocatedId(nodeId,generation){return `${String(nodeId).replace(/-r\\d+$/,'')}-r${generation}`.slice(0,40)}
function relocatedPosition(nodeId,generation,resource){
  const a=habitatSeed(`${nodeId}:${generation}:a`)*Math.PI*2;
  const r=5+habitatSeed(`${nodeId}:${generation}:r`)*18;
  // Keep plant resources on land and away from the river strip at x=-24.
  let x=Math.cos(a)*r+(resource==='herbs'?2:6),z=Math.sin(a)*r;
  if(x>-30&&x<-18)x=-17+habitatSeed(`${nodeId}:${generation}:bank`)*5;
  return{x:Number(Math.max(-31,Math.min(31,x)).toFixed(2)),z:Number(Math.max(-31,Math.min(31,z)).toFixed(2))};
}"""
assert old in s
s=s.replace(old,new)

old2="""async function resourceNodes(sql,config){
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('resource_nodes','{}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
  const rows=await sql`SELECT value FROM world_state WHERE key='resource_nodes' LIMIT 1`;
  const stored=rows[0]?.value||{};
  const now=Date.now();
  const out={};
  for(const [id,cfg] of Object.entries(config)){
    const s=stored[id]||{};
    const regrowAt=s.regrowAt?Date.parse(s.regrowAt):0;
    const regrown=regrowAt>0&&regrowAt<=now;
    out[id]={resource:cfg.resource,max:cfg.max,remaining:regrown?cfg.max:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:regrown?null:(s.regrowAt||null)};
  }
  return out;
}"""
new2="""async function resourceNodes(sql,config){
  await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('resource_nodes','{}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
  const rows=await sql`SELECT value FROM world_state WHERE key='resource_nodes' LIMIT 1`;
  const stored=rows[0]?.value||{};
  const now=Date.now();
  const out={};
  for(const [id,cfg] of Object.entries(config)){
    const s=stored[id]||{};
    const regrowAt=s.regrowAt?Date.parse(s.regrowAt):0;
    const generation=Number(s.generation||0);
    if(Number(s.remaining)===0&&MOBILE_RESOURCES.has(cfg.resource)&&regrowAt>0&&regrowAt<=now){
      const nextGeneration=generation+1,nextId=relocatedId(id,nextGeneration),pos=relocatedPosition(id,nextGeneration,cfg.resource);
      out[nextId]={resource:cfg.resource,max:cfg.max,remaining:cfg.max,regrowAt:null,generation:nextGeneration,x:pos.x,z:pos.z,replaces:id};
      continue;
    }
    out[id]={resource:cfg.resource,max:cfg.max,remaining:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:s.regrowAt||null,generation,x:s.x??null,z:s.z??null};
  }
  // Preserve already-relocated nodes that are no longer part of static config.
  for(const [id,s] of Object.entries(stored))if(!out[id]&&!config[id]&&s?.resource){out[id]=s;}
  return out;
}"""
assert old2 in s
s=s.replace(old2,new2)

# On depletion, biological nodes get a colonization time; stone gets no respawn time.
s=s.replace("'regrowAt',CASE WHEN calc.before_count-${amount}::int<=0 THEN to_jsonb(now()+(${cfg.regrowMinutes}::int||' minutes')::interval) ELSE 'null'::jsonb END", "'regrowAt',CASE WHEN calc.before_count-${amount}::int<=0 AND ${MOBILE_RESOURCES.has(cfg.resource)}::boolean THEN to_jsonb(now()+(${cfg.regrowMinutes}::int||' minutes')::interval) ELSE 'null'::jsonb END")

p.write_text(s)

# Client: server-provided x/z become authoritative for relocated resource nodes.
p=Path('main.js');m=p.read_text()
needle="""function registerResource(item){item.collectable=true;interactables.push(item);resourceNodes.push(item);return item}"""
replacement="""function registerResource(item){item.collectable=true;interactables.push(item);resourceNodes.push(item);return item}
function applyResourceRelocations(nodes={}){for(const item of resourceNodes){const n=nodes[item.nodeId];if(!n)continue;if(Number.isFinite(Number(n.x))&&Number.isFinite(Number(n.z))){item.object.position.x=Number(n.x);item.object.position.z=Number(n.z)}}}"""
assert needle in m
m=m.replace(needle,replacement)
# Add relocation call wherever server nodes are applied, if recognizable.
marker="for(const item of resourceNodes){const n=nodes[item.nodeId];"
if marker in m and "applyResourceRelocations(nodes);" not in m:
    m=m.replace(marker,"applyResourceRelocations(nodes);"+marker,1)
p.write_text(m)

# cache bust
p=Path('index.html');i=p.read_text();
import re
i=re.sub(r'\\./main\\.js\\?v=[^\"\\']+', './main.js?v=resource-redistribution-1', i)
p.write_text(i)
