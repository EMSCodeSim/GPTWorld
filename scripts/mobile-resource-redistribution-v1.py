from pathlib import Path

p=Path('netlify/functions/resource-state.mjs')
s=p.read_text()
old="""const RESOURCE_DEFAULTS = {
  wood:{max:6,regrowMinutes:60},
  stone:{max:4,regrowMinutes:90},
  herbs:{max:3,regrowMinutes:20}
};"""
new=old+"""

// Biological resources colonize new habitat after depletion. Stone deposits are finite.
const MOBILE_RESOURCES=new Set(['wood','herbs']);
const habitatSeed=(text)=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295};
function relocatedPosition(nodeId,generation,resource){
  const a=habitatSeed(`${nodeId}:${generation}:a`)*Math.PI*2;
  const r=5+habitatSeed(`${nodeId}:${generation}:r`)*18;
  let x=Math.cos(a)*r+(resource==='herbs'?2:6),z=Math.sin(a)*r;
  if(x>-30&&x<-18)x=-17+habitatSeed(`${nodeId}:${generation}:bank`)*5;
  return{x:Number(Math.max(-31,Math.min(31,x)).toFixed(2)),z:Number(Math.max(-31,Math.min(31,z)).toFixed(2))};
}"""
assert old in s
s=s.replace(old,new)
old2="""    const regrown=regrowAt>0&&regrowAt<=now;
    out[id]={resource:cfg.resource,max:cfg.max,remaining:regrown?cfg.max:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:regrown?null:(s.regrowAt||null)};"""
new2="""    const regrown=regrowAt>0&&regrowAt<=now&&MOBILE_RESOURCES.has(cfg.resource);
    const generation=Number(s.generation||0)+(regrown?1:0);
    const pos=regrown?relocatedPosition(id,generation,cfg.resource):{x:s.x??null,z:s.z??null};
    out[id]={resource:cfg.resource,max:cfg.max,remaining:regrown?cfg.max:Number.isFinite(Number(s.remaining))?Number(s.remaining):cfg.max,regrowAt:regrown?null:(s.regrowAt||null),generation,x:pos.x,z:pos.z};"""
assert old2 in s
s=s.replace(old2,new2)
s=s.replace("'regrowAt',CASE WHEN calc.before_count-${amount}::int<=0 THEN to_jsonb(now()+(${cfg.regrowMinutes}::int||' minutes')::interval) ELSE 'null'::jsonb END", "'regrowAt',CASE WHEN calc.before_count-${amount}::int<=0 AND ${MOBILE_RESOURCES.has(cfg.resource)}::boolean THEN to_jsonb(now()+(${cfg.regrowMinutes}::int||' minutes')::interval) ELSE 'null'::jsonb END")
p.write_text(s)

p=Path('main.js');m=p.read_text()
needle="function registerResource(item){item.collectable=true;interactables.push(item);resourceNodes.push(item);return item}"
replacement=needle+"\nfunction applyResourceRelocations(nodes={}){for(const item of resourceNodes){const n=nodes[item.nodeId];if(!n)continue;if(Number.isFinite(Number(n.x))&&Number.isFinite(Number(n.z))){item.object.position.x=Number(n.x);item.object.position.z=Number(n.z)}}}"
assert needle in m
m=m.replace(needle,replacement,1)
marker="for(const item of resourceNodes){const n=nodes[item.nodeId];"
if marker in m:
    m=m.replace(marker,"applyResourceRelocations(nodes);"+marker,1)
p.write_text(m)

p=Path('index.html');i=p.read_text()
start=i.find('./main.js?v=')
if start>=0:
    end=i.find('"',start)
    if end<0: end=i.find("'",start)
    i=i[:start]+'./main.js?v=resource-redistribution-1'+i[end:]
p.write_text(i)
