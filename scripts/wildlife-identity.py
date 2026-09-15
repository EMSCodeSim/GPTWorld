from pathlib import Path

p = Path('main.js')
s = p.read_text()

old = "const muzzle=add(new THREE.SphereGeometry(.5,8,6),light,headF+headSize*.58,body*.82,0);muzzle.scale.set(headSize*.45,headSize*.28,headSize*.34);g.rotation.y=-Number(e.heading||0);"
new = "const muzzle=add(new THREE.SphereGeometry(.5,8,6),light,headF+headSize*.58,body*.82,0);muzzle.scale.set(headSize*.45,headSize*.28,headSize*.34);const eyeX=headF+headSize*.34,eyeY=body*.94,eyeZ=headSize*.36;for(const z of[-eyeZ,eyeZ]){const eye=add(new THREE.SphereGeometry(Math.max(.025,body*.035),7,5),0x171512,eyeX,eyeY,z);eye.scale.set(1,.9,.75)}const nose=add(new THREE.SphereGeometry(.5,7,5),predator?0x171512:0x3a3026,headF+headSize*.82,body*.80,0);nose.scale.set(headSize*.20,headSize*.15,headSize*.20);if(predator){const chest=add(new THREE.SphereGeometry(.5,8,6),0x594237,w*.18,body*.68,0);chest.scale.set(body*.45,body*.58,d*.76);for(const z of[-headSize*.42,headSize*.42]){const ear=add(new THREE.ConeGeometry(body*.12,body*.34,5),0x2f251f,headF-body*.05,body*1.28,z);ear.rotation.z=-.08}}else if(runner){for(const z of[-headSize*.34,headSize*.34]){const ear=add(new THREE.ConeGeometry(body*.10,body*.48,6),dark,headF-body*.06,body*1.31,z);ear.rotation.z=-.12}}else{const neck=add(new THREE.CylinderGeometry(body*.16,body*.22,body*.52,6),dark,headF-body*.28,body*.90,0);neck.rotation.z=-.55}g.rotation.y=-Number(e.heading||0);"
assert old in s, 'wildlife face anchor not found'
s = s.replace(old, new, 1)
p.write_text(s)

ip = Path('index.html')
h = ip.read_text()
h = h.replace('./main.js?v=animal-rig-1', './main.js?v=wildlife-identity-1')
h = h.replace('./main.js?v=wildlife-motion-1', './main.js?v=wildlife-identity-1')
ip.write_text(h)
