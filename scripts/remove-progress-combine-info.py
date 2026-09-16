from pathlib import Path
# main.js was accidentally replaced in the immediately preceding commit; restore it from parent.
import subprocess
subprocess.run(['git','checkout','HEAD^','--','main.js'],check=True)
p=Path('main.js');s=p.read_text()
# Remove all collection-progress state/UI while retaining immediate gather behavior.
s=s.replace("let gatherProgress=null;\n","")
s=s.replace("function showGatherProgress(item,value,label='Collecting'){gatherProgress={item,value:Math.max(0,Math.min(1,value)),label};}\n","")
s=s.replace("showGatherProgress(item,.78,'Collecting');","")
s=s.replace("showGatherProgress(item,.08,'Collecting');","")
s=s.replace("showGatherProgress(item,.35,'Collecting');","")
start=s.find("const collectHud=document.createElement('div');")
end=s.find("function resize(){",start)
if start!=-1 and end!=-1:s=s[:start]+s[end:]
s=s.replace("updateNearest();updateCollectHud();elapsedWorldMinutes","updateNearest();elapsedWorldMinutes")
p.write_text(s)
# Remove progress-bar CSS and cache-bust main.
p=Path('index.html');s=p.read_text()
a=s.find('#collectHud{');b=s.find('\n</style>',a)
if a!=-1 and b!=-1:s=s[:a]+s[b:]
s=s.replace('./main.js?v=weather-visuals-1','./main.js?v=interact-info-2')
p.write_text(s)
# Combine weather status into Info Center button/header. Keep detailed World Sims panel accessible through Info.
p=Path('info-center.js');s=p.read_text()
s=s.replace("btn.id='infoCenterButton';btn.type='button';btn.textContent='ⓘ Info';", "btn.id='infoCenterButton';btn.type='button';btn.textContent='ⓘ Info · Weather';")
s=s.replace("b.textContent=v?'Close info':'ⓘ Info';", "b.textContent=v?'Close info':infoButtonLabel();")
insert="""
function infoButtonLabel(){const w=living?.weather||{};const condition=String(w.condition||w.precipitation||'Weather');const temp=Number(w.temperatureC);return `ⓘ Info · ${condition}${Number.isFinite(temp)?` · ${temp.toFixed(0)}°C`:''}`;}
function syncCombinedStatus(){const b=document.getElementById('infoCenterButton');if(b&&!infoOpen)b.textContent=infoButtonLabel();const legacy=document.getElementById('worldSimsButton');if(legacy)legacy.style.display='none';}
"""
pos=s.find('function setOpen(');s=s[:pos]+insert+s[pos:]
s=s.replace("if(d.ok)living=d;", "if(d.ok)living=d;syncCombinedStatus();")
s=s.replace("setInterval(()=>{hideLegacyMenus();manageBridge();", "setInterval(()=>{hideLegacyMenus();syncCombinedStatus();manageBridge();")
p.write_text(s)
