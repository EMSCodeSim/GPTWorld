from pathlib import Path
p=Path('main.js'); s=p.read_text()
old="const roads=new THREE.Group();scene.add(roads);\nconst interactables=[]"
new="""const roads=new THREE.Group();scene.add(roads);
// Weather visuals are client-side only; the Weather Sim remains authoritative.
let currentWeather={precipitation:'clear',wind:.2,temperatureC:12,drought:.18};
const rainCount=420,rainGeo=new THREE.BufferGeometry(),rainPos=new Float32Array(rainCount*3);
for(let i=0;i<rainCount;i++){rainPos[i*3]=(Math.random()-.5)*48;rainPos[i*3+1]=2+Math.random()*18;rainPos[i*3+2]=(Math.random()-.5)*48}rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xbfd7e5,size:.07,transparent:true,opacity:.7,depthWrite:false}));rain.visible=false;scene.add(rain);
const weatherClouds=new THREE.Group();for(let i=0;i<7;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(1.7+(i%3)*.45,10,7),new THREE.MeshStandardMaterial({color:0xb8c1c0,roughness:1,transparent:true,opacity:.58}));c.scale.set(2.2,.55,1);c.position.set(-22+i*7,14+(i%2)*1.3,-13+(i%3)*8);weatherClouds.add(c)}weatherClouds.visible=false;scene.add(weatherClouds);
function applyWeatherVisuals(w={}){currentWeather={...currentWeather,...w};const precip=String(currentWeather.precipitation||'clear').toLowerCase(),wet=precip.includes('rain')||precip.includes('storm')||precip.includes('shower'),cloudy=wet||precip.includes('cloud')||precip.includes('overcast')||precip.includes('snow');rain.visible=wet;weatherClouds.visible=cloudy;const foggy=wet||precip.includes('fog');scene.fog.near=foggy?24:38;scene.fog.far=foggy?68:95;scene.background.set(foggy?0x788e91:cloudy?0x81999b:0x8fb1b1);scene.fog.color.copy(scene.background);sun.intensity=wet?1.45:cloudy?1.8:2.5}
function updateWeatherVisuals(dt,t){const wind=Math.max(.05,Number(currentWeather.wind)||.2);weatherClouds.position.x=((t*.00025*wind+28)%56)-28;if(rain.visible){const a=rain.geometry.attributes.position.array;for(let i=0;i<rainCount;i++){a[i*3+1]-=dt*(12+wind*7);a[i*3]+=dt*wind*1.8;if(a[i*3+1]<.2){a[i*3+1]=18+Math.random()*4;a[i*3]=(Math.random()-.5)*48}}rain.geometry.attributes.position.needsUpdate=true}}
const interactables=[]"""
assert old in s,'weather insertion anchor not found';s=s.replace(old,new,1)
old="const crossing=data.world?.western_crossing;setBridgeBuilt(Boolean(crossing?.complete));applyRenderEntities"
new="const crossing=data.world?.western_crossing;setBridgeBuilt(Boolean(crossing?.complete));applyWeatherVisuals(data.world?.weather_sim||data.simulations?.weather||{});applyRenderEntities"
assert old in s,'weather state anchor not found';s=s.replace(old,new,1)
old="updatePlayer(dt,t);updateNPCs(t,dt);updateRemotePlayers(dt,t);updateCreatures(t,dt);updateNearest();"
new="updatePlayer(dt,t);updateNPCs(t,dt);updateRemotePlayers(dt,t);updateCreatures(t,dt);updateWeatherVisuals(dt,t);updateNearest();"
assert old in s,'animation anchor not found';s=s.replace(old,new,1)
p.write_text(s)
ip=Path('index.html');h=ip.read_text();assert './main.js?v=terrain-polish-1' in h,'cache anchor not found';ip.write_text(h.replace('./main.js?v=terrain-polish-1','./main.js?v=weather-visuals-1',1))
