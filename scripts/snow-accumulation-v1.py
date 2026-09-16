from pathlib import Path

SIMS=[Path('netlify/functions/_sim-core.mjs'),Path('netlify/lib/sim-core.mjs')]
for p in SIMS:
    s=p.read_text()
    # Add persistent snowpack to initial weather.
    s=s.replace("drought:0.18,lastTickAt:null", "drought:0.18,snowDepthCm:0,snowCover:0,lastTickAt:null")
    s=s.replace("drought:.18,lastTickAt:null", "drought:.18,snowDepthCm:0,snowCover:0,lastTickAt:null")
    # Advance snowpack once per autonomous weather tick: snowfall accumulates, warmth/rain melts it.
    needle="s.drought=round(clamp((1-s.soilMoisture)*.8+Math.max(0,s.temperatureC-20)/35,.02,1),3);"
    repl=needle+"const oldSnow=Number(s.snowDepthCm||0);const snowfall=s.precipitation==='snow'?s.precipitationRate*4.5:0;const warmMelt=Math.max(0,s.temperatureC)*.38;const rainMelt=s.precipitation.includes('rain')?s.precipitationRate*1.8:0;s.snowDepthCm=round(clamp(oldSnow+snowfall-warmMelt-rainMelt,0,80),1);s.snowCover=round(clamp(s.snowDepthCm/12,0,1),2);"
    if needle not in s: raise SystemExit(f'weather insertion point missing: {p}')
    s=s.replace(needle,repl,1)
    p.write_text(s)

p=Path('main.js');s=p.read_text()
s=s.replace("let currentWeather={precipitation:'clear',wind:.2,temperatureC:12,drought:.18};", "let currentWeather={precipitation:'clear',wind:.2,temperatureC:12,drought:.18,snowDepthCm:0,snowCover:0};")
# Persistent visual snow layer driven only by authoritative Weather Sim snowCover.
anchor="const weatherClouds=new THREE.Group();"
snow="const snowGround=new THREE.Mesh(new THREE.BoxGeometry(69.7,.035,69.7),new THREE.MeshStandardMaterial({color:0xf1f4f3,roughness:1,transparent:true,opacity:0}));snowGround.position.y=.025;snowGround.receiveShadow=true;snowGround.visible=false;scene.add(snowGround);\n"
if anchor not in s: raise SystemExit('cloud anchor missing')
s=s.replace(anchor,snow+anchor,1)
old="function applyWeatherVisuals(w={}){currentWeather={...currentWeather,...w};"
new="function applyWeatherVisuals(w={}){currentWeather={...currentWeather,...w};const snowCover=Math.max(0,Math.min(1,Number(currentWeather.snowCover)||0));snowGround.visible=snowCover>.02;snowGround.material.opacity=Math.min(.92,snowCover*.92);"
if old not in s: raise SystemExit('applyWeatherVisuals anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# Cache bust main module without altering world day.
p=Path('index.html');s=p.read_text();import re
s=re.sub(r'\.\/main\.js\?v=[^\"\']+', './main.js?v=snow-accumulation-1', s)
p.write_text(s)
