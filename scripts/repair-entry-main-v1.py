from pathlib import Path
import subprocess
# Restore the last known working engine, then keep the requested UX changes.
working = subprocess.check_output(['git','show','4dfc69115d5532916dfc17b589d486ee2bd17b18:main.js'], text=True)
# Remove the collection progress UI/state while preserving interaction identification.
working = working.replace("let gatherProgress=null;\n", "")
working = working.replace("function showGatherProgress(item,value,label='Collecting'){gatherProgress={item,value:Math.max(0,Math.min(1,value)),label};}\n", "")
working = working.replace("showGatherProgress(item,.78,'Collecting');", "")
working = working.replace("showGatherProgress(item,.08,'Collecting');", "")
working = working.replace("showGatherProgress(item,.35,'Collecting');", "")
start = "const collectHud=document.createElement('div');collectHud.id='collectHud';collectHud.hidden=true;collectHud.innerHTML='<div class=collectLabel>Collecting</div><div class=collectTrack><div class=collectFill></div></div>';worldEl.appendChild(collectHud);const collectFill=collectHud.querySelector('.collectFill'),collectLabel=collectHud.querySelector('.collectLabel');\nfunction updateCollectHud(){collectHud.hidden=!gatherProgress;if(!gatherProgress)return;collectLabel.textContent=`${gatherProgress.label} ${gatherProgress.item?.label||''}`;collectFill.style.width=`${Math.round(gatherProgress.value*100)}%`;}\n"
working = working.replace(start, "")
working = working.replace("updateNearest();updateCollectHud();elapsedWorldMinutes", "updateNearest();elapsedWorldMinutes")
Path('main.js').write_text(working)
# Remove stale progress CSS and bump client cache.
p=Path('index.html'); s=p.read_text()
import re
s=re.sub(r'#collectHud\{.*?#collectHud\[hidden\]\{display:none\}\\n?', '', s, flags=re.S)
s=s.replace('./main.js?v=compact-info-weather-1','./main.js?v=entry-repair-1').replace('./main.js?v=weather-visuals-1','./main.js?v=entry-repair-1')
p.write_text(s)
