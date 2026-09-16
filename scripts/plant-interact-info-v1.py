from pathlib import Path
p=Path('main.js');s=p.read_text()
# Repair recursion introduced by the resource relocation upgrade.
s=s.replace("function applyResourceRelocations(nodes={}){applyResourceRelocations(nodes);for(const item of resourceNodes){", "function applyResourceRelocations(nodes={}){for(const item of resourceNodes){",1)
old="function identifyItem(item){if(!item)return 'Nothing nearby.';if(item.type==='resource'){const kind=item.resource==='wood'?'Plant':item.resource==='herbs'?'Plant':'Mineral';return `${kind}: ${item.label}${Number.isFinite(item.remaining)?` · ${item.remaining}/${item.max||'?'} available`:''}. Collectable ${item.resource}.`;"
new="function identifyItem(item){if(!item)return 'Nothing nearby.';if(item.type==='resource'){if(item.plantInfo){const p=item.plantInfo;return `Plant: ${item.label} · ${p.type}. Habitat: ${p.habitat}. ${p.ecology} Use: ${p.use}.${Number.isFinite(item.remaining)?` ${item.remaining}/${item.max||'?'} harvestable`:''}`;}const kind=item.resource==='wood'?'Plant':item.resource==='herbs'?'Plant':'Mineral';return `${kind}: ${item.label}${Number.isFinite(item.remaining)?` · ${item.remaining}/${item.max||'?'} available`:''}. Collectable ${item.resource}.`;"
assert old in s
s=s.replace(old,new,1)
s=s.replace("resource:'wood',label:'pine tree',object:g", "resource:'wood',label:'pine tree',plantInfo:{type:'evergreen tree',habitat:'upland and well-drained ground',ecology:'Provides cover and renewable woody biomass; new trees can establish in suitable habitat after harvest.',use:'wood for construction, fuel, and future crafting'},object:g",1)
s=s.replace("resource:'herbs',label:'wild herbs',object:g", "resource:'herbs',label:'wild herbs',plantInfo:{type:'wild herb patch',habitat:'open ground with adequate soil moisture',ecology:'A short-lived plant resource that can spread and recolonize suitable habitat.',use:'herbs for healing and future recipes'},object:g",1)
p.write_text(s)

p=Path('index.html');i=p.read_text();start=i.find('./main.js?v=')
if start>=0:
    q1=i.find(chr(34),start);q2=i.find(chr(39),start);ends=[x for x in (q1,q2) if x>=0];end=min(ends) if ends else -1
    if end>=0:i=i[:start]+'./main.js?v=plant-interact-info-1'+i[end:]
p.write_text(i)
