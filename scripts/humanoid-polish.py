from pathlib import Path

p = Path('main.js')
s = p.read_text()

old = "const hairMesh=new THREE.Mesh(new THREE.SphereGeometry(.305,10,7,0,Math.PI*2,0,Math.PI*.52),new THREE.MeshStandardMaterial({color:hair,roughness:1}));hairMesh.position.y=2.05;g.add(hairMesh);const armGeo="
new = "const hairMesh=new THREE.Mesh(new THREE.SphereGeometry(.305,10,7,0,Math.PI*2,0,Math.PI*.52),new THREE.MeshStandardMaterial({color:hair,roughness:1}));hairMesh.position.y=2.05;g.add(hairMesh);const faceMat=new THREE.MeshStandardMaterial({color:0x1d1a17,roughness:1});for(const x of[-.105,.105]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.032,7,5),faceMat);eye.position.set(x,2.00,.286);g.add(eye)}const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,7,5),new THREE.MeshStandardMaterial({color:skin,roughness:1}));nose.scale.set(.75,1,1.15);nose.position.set(0,1.94,.305);g.add(nose);const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.18,7),new THREE.MeshStandardMaterial({color:skin,roughness:1}));neck.position.y=1.69;g.add(neck);const belt=new THREE.Mesh(new THREE.CylinderGeometry(.425,.425,.09,8),new THREE.MeshStandardMaterial({color:0x49392b,roughness:1}));belt.position.y=.88;g.add(belt);const buckle=new THREE.Mesh(new THREE.BoxGeometry(.12,.09,.045),new THREE.MeshStandardMaterial({color:0xb79a62,roughness:.8}));buckle.position.set(0,.88,.42);g.add(buckle);const armGeo="
assert old in s, 'humanoid face anchor not found'
s = s.replace(old, new, 1)

old = "g.userData.rig={armL,armR,legL,legR,torso};return g}function animateHumanoid(g,moving,t,speed=1){const r=g.userData.rig;if(!r)return;const a=moving?Math.sin(t*.012*speed)*.52:0;r.legL.rotation.x=a;r.legR.rotation.x=-a;r.armL.rotation.x=-a*.72;r.armR.rotation.x=a*.72;r.torso.rotation.z=moving?Math.sin(t*.024*speed)*.02:0}"
new = "g.userData.rig={armL,armR,legL,legR,torso,head,hairMesh};return g}function animateHumanoid(g,moving,t,speed=1){const r=g.userData.rig;if(!r)return;const a=moving?Math.sin(t*.012*speed)*.52:0;r.legL.rotation.x=a;r.legR.rotation.x=-a;r.armL.rotation.x=-a*.72;r.armR.rotation.x=a*.72;r.torso.rotation.z=moving?Math.sin(t*.024*speed)*.02:0;r.torso.position.y=1.28+(moving?Math.abs(Math.sin(t*.012*speed))*.018:Math.sin(t*.0025)*.008);if(r.head){r.head.rotation.y=moving?0:Math.sin(t*.0017)*.10;r.head.position.y=1.96+(moving?Math.abs(Math.sin(t*.012*speed))*.012:Math.sin(t*.0025)*.006)}if(r.hairMesh){r.hairMesh.rotation.y=r.head?.rotation.y||0;r.hairMesh.position.y=2.05+(r.head?.position.y-1.96||0)}}"
assert old in s, 'humanoid animation anchor not found'
s = s.replace(old, new, 1)

p.write_text(s)

ip = Path('index.html')
h = ip.read_text()
assert './main.js?v=wildlife-identity-1' in h, 'cache version anchor not found'
ip.write_text(h.replace('./main.js?v=wildlife-identity-1', './main.js?v=humanoid-polish-1', 1))
