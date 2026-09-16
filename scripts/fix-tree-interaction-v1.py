from pathlib import Path
p=Path('main.js');s=p.read_text()
old="function interact(){if(!gameStarted||!nearest)return;showToast(identifyItem(nearest));if(nearest.type==='resource'){setTimeout(()=>gatherResource(nearest),260);return}if(nearest.type==='npc'){setTimeout(()=>talkToNPC(nearest),420);return}if(nearest.message)setTimeout(()=>showToast(nearest.message),650)}"
new="""function interact(){if(!gameStarted||!nearest)return;if(nearest.type==='resource'){const now=performance.now();if(nearest.plantInfo&&(!nearest.inspectedAt||now-nearest.inspectedAt>5000)){nearest.inspectedAt=now;showToast(identifyItem(nearest));promptEl.textContent=`Gather ${nearest.label} · interact again`;return}showToast(identifyItem(nearest));setTimeout(()=>gatherResource(nearest),300);nearest.inspectedAt=0;return}showToast(identifyItem(nearest));if(nearest.type==='npc'){setTimeout(()=>talkToNPC(nearest),420);return}if(nearest.message)setTimeout(()=>showToast(nearest.message),650)}"""
assert old in s,'interact anchor missing';s=s.replace(old,new,1)
old2="if(nearest)promptEl.textContent=nearest.type==='resource'?`Gather ${nearest.label}${Number.isFinite(nearest.remaining)?` · ${nearest.remaining} left`:''}`:nearest.type==='npc'?`Talk to ${nearest.label}`:`Inspect ${nearest.label}`"
new2="if(nearest)promptEl.textContent=nearest.type==='resource'?(nearest.plantInfo?`Inspect ${nearest.label}${Number.isFinite(nearest.remaining)?` · ${nearest.remaining} harvestable`:''}`:`Gather ${nearest.label}${Number.isFinite(nearest.remaining)?` · ${nearest.remaining} left`:''}`):nearest.type==='npc'?`Talk to ${nearest.label}`:`Inspect ${nearest.label}`"
assert old2 in s,'prompt anchor missing';s=s.replace(old2,new2,1)
p.write_text(s)
p=Path('index.html');i=p.read_text();start=i.find('./main.js?v=');
if start>=0:
 end=i.find('"',start)
 if end<0:end=i.find("'",start)
 i=i[:start]+'./main.js?v=tree-interaction-fix-1'+i[end:]
p.write_text(i)
