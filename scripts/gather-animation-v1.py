from pathlib import Path
p=Path('main.js');s=p.read_text()
anchor="async function gatherResource(item){if(gathering||item.depleted)return;"
helper="""function animateGather(item){
  if(!item?.object)return;
  const target=item.object.position.clone(),dx=target.x-player.position.x,dz=target.z-player.position.z;
  player.rotation.y=Math.atan2(dx,dz);
  const rig=player.userData.rig,resource=item.resource,start=performance.now(),duration=resource==='herbs'?720:1050;
  const originalScale=item.object.scale.clone();
  const icon=new THREE.Mesh(resource==='wood'?new THREE.BoxGeometry(.18,.42,.18):resource==='stone'?new THREE.DodecahedronGeometry(.18,0):new THREE.SphereGeometry(.14,7,5),new THREE.MeshStandardMaterial({color:resource==='wood'?0x8a5d35:resource==='stone'?0x9a9b92:0x7aa35a,roughness:1}));
  icon.position.copy(target).add(new THREE.Vector3(0,resource==='wood'?1.3:.65,0));scene.add(icon);
  function frame(now){const q=Math.min(1,(now-start)/duration),swing=Math.sin(q*Math.PI*(resource==='herbs'?2:4));
    if(rig){rig.armR.rotation.x=-.35-swing*1.35;rig.armL.rotation.x=.15+swing*.35;rig.torso.rotation.z=swing*.045;}
    if(resource==='wood')item.object.rotation.z=swing*.035;else if(resource==='stone')item.object.rotation.y+=.035;else item.object.scale.set(originalScale.x*(1-swing*.05),originalScale.y*(1+swing*.08),originalScale.z*(1-swing*.05));
    if(q>.48){const k=(q-.48)/.52,dest=player.position.clone().add(new THREE.Vector3(0,1.25,0));icon.position.lerp(dest,Math.min(1,k*.16));icon.scale.setScalar(Math.max(.15,1-k*.75));}
    if(q<1)requestAnimationFrame(frame);else{if(rig){rig.armR.rotation.x=0;rig.armL.rotation.x=0;rig.torso.rotation.z=0;}item.object.rotation.z=0;item.object.scale.copy(originalScale);scene.remove(icon);icon.geometry.dispose();icon.material.dispose();}}
  requestAnimationFrame(frame);
}
"""
assert anchor in s
s=s.replace(anchor,helper+anchor,1)
s=s.replace("gathering=true;try{const response=await fetch(RESOURCE_API", "gathering=true;animateGather(item);try{const response=await fetch(RESOURCE_API",1)
p.write_text(s)

p=Path('index.html');s=p.read_text();import re
s=re.sub(r'\.\/main\.js\?v=[^\"\']+','./main.js?v=gather-motion-1',s,1);p.write_text(s)
