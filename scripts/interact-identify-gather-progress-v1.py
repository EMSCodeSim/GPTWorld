from pathlib import Path
p=Path('main.js');s=p.read_text()
old="const interactables=[],blockers=[],npcs=[],resourceNodes=[];"
new="""const interactables=[],blockers=[],npcs=[],resourceNodes=[];
let gatherProgress=null;
function identifyItem(item){if(!item)return 'Nothing nearby.';if(item.type==='resource'){const kind=item.resource==='wood'?'Plant':item.resource==='herbs'?'Plant':'Mineral';return `${kind}: ${item.label}${Number.isFinite(item.remaining)?` · ${item.remaining}/${item.max||'?'} available`:''}. Collectable ${item.resource}.`;}if(item.type==='npc')return `Person: ${item.label}${item.activity?` · ${item.activity}`:''}.`;if(item.object?.userData?.creature){const u=item.object.userData;return `Animal: ${item.label||u.species||u.kind||'wild animal'} · ${u.behavior||'roaming'}.`;}return `Object: ${item.label||'world feature'}.`;}
function showGatherProgress(item,value,label='Collecting'){gatherProgress={item,value:Math.max(0,Math.min(1,value)),label};}
"""
assert old in s;s=s.replace(old,new,1)
old="function registerResource(item){interactables.push(item);resourceNodes.push(item);return item}"
new="function registerResource(item){item.collectable=true;interactables.push(item);resourceNodes.push(item);return item}"
s=s.replace(old,new,1)
old="function interact(){if(!gameStarted||!nearest)return;if(nearest.type==='resource'){gatherResource(nearest);return}if(nearest.type==='npc'){const line=nearest.lines[nearest.lineIndex%nearest.lines.length];nearest.lineIndex++;showToast(`${nearest.label}: ${line}${nearest.activity?` · ${nearest.activity}`:''}`);return}showToast(nearest.message)}"
new="""function interact(){if(!gameStarted||!nearest)return;showToast(identifyItem(nearest));if(nearest.type==='resource'){setTimeout(()=>gatherResource(nearest),260);return}if(nearest.type==='npc'){const line=nearest.lines[nearest.lineIndex%nearest.lines.length];nearest.lineIndex++;setTimeout(()=>showToast(`${nearest.label}: ${line}${nearest.activity?` · ${nearest.activity}`:''}`),650);return}if(nearest.message)setTimeout(()=>showToast(nearest.message),650)}"""
assert old in s;s=s.replace(old,new,1)
old="async function gatherResource(item){if(gathering||item.depleted)return;"
new="async function gatherResource(item){if(gathering||item.depleted)return;showGatherProgress(item,.08,'Collecting');"
assert old in s;s=s.replace(old,new,1)
s=s.replace("gathering=true;try{const response=await fetch(RESOURCE_API", "gathering=true;showGatherProgress(item,.35,'Collecting');try{const response=await fetch(RESOURCE_API",1)
s=s.replace("const data=await response.json();if(!data.ok)","const data=await response.json();showGatherProgress(item,.78,'Collecting');if(!data.ok)",1)
s=s.replace("}catch{}finally{gathering=false}}", "}catch{showToast('Gathering failed to reach the shared world.')}finally{showGatherProgress(item,1,'Collected');setTimeout(()=>{if(gatherProgress?.item===item)gatherProgress=null},700);gathering=false}}",1)
# Add creatures to interactable system when renderer creates them.
needle="if(record?.object?.userData?.creature&&e.animalId&&String(e.part||'')==='creature')"
# Existing creature creation happens in renderPersistentEntity path; easiest is registration after apply list.
old="function applyRenderEntities(input){const list=Array.isArray(input)?input:Array.isArray(input?.entities)?input.entities:[];"
new="function applyRenderEntities(input){const list=Array.isArray(input)?input:Array.isArray(input?.entities)?input.entities:[];"
# append registration after rendering each new entity by modifying renderPersistentEntity end
old2="renderedEntities.set(id,{object,resourceNode,signature:JSON.stringify(e)})}"
new2="""renderedEntities.set(id,{object,resourceNode,signature:JSON.stringify(e)});if(object?.userData?.creature){const animal={type:'animal',label:String(e.speciesName||e.name||e.species||e.animalId||'wild animal'),object,radius:3.2};object.userData.interactableRef=animal;interactables.push(animal);}}"""
assert old2 in s;s=s.replace(old2,new2,1)
# remove animal refs on entity removal
old3="scene.remove(record.object);record.object.traverse?.(o=>"
new3="const ai=record.object?.userData?.interactableRef;if(ai){const k=interactables.indexOf(ai);if(k>=0)interactables.splice(k,1);}scene.remove(record.object);record.object.traverse?.(o=>"
assert old3 in s;s=s.replace(old3,new3,1)
# draw collection progress above player using canvas overlay in 3d renderer DOM parent
anchor="function resize(){const w=worldEl.clientWidth,h=worldEl.clientHeight;"
helper="""const collectHud=document.createElement('div');collectHud.id='collectHud';collectHud.hidden=true;collectHud.innerHTML='<div class=collectLabel>Collecting</div><div class=collectTrack><div class=collectFill></div></div>';worldEl.appendChild(collectHud);const collectFill=collectHud.querySelector('.collectFill'),collectLabel=collectHud.querySelector('.collectLabel');
function updateCollectHud(){collectHud.hidden=!gatherProgress;if(!gatherProgress)return;collectLabel.textContent=`${gatherProgress.label} ${gatherProgress.item?.label||''}`;collectFill.style.width=`${Math.round(gatherProgress.value*100)}%`;}
"""
s=s.replace(anchor,helper+anchor,1)
s=s.replace("updateNearest();elapsedWorldMinutes", "updateNearest();updateCollectHud();elapsedWorldMinutes",1)
p.write_text(s)

p=Path('index.html');s=p.read_text();
# Insert CSS before closing style.
css="""#collectHud{position:absolute;left:50%;bottom:112px;transform:translateX(-50%);width:min(260px,68%);z-index:12;padding:8px 10px;border-radius:10px;background:rgba(15,22,18,.82);color:#f4f0df;font:600 12px system-ui;pointer-events:none}.collectLabel{margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.collectTrack{height:8px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}.collectFill{height:100%;width:0;background:#d8bd67;transition:width .18s ease}#collectHud[hidden]{display:none}\n"""
idx=s.rfind('</style>');assert idx!=-1;s=s[:idx]+css+s[idx:];p.write_text(s)
