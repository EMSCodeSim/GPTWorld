from pathlib import Path

p=Path('main.js')
s=p.read_text()
old="const ground=new THREE.Mesh(new THREE.BoxGeometry(70,1,70),new THREE.MeshStandardMaterial({color:0x667d4e,roughness:1}));ground.position.y=-.5;ground.receiveShadow=true;scene.add(ground);\nconst river="
new="""const ground=new THREE.Mesh(new THREE.BoxGeometry(70,1,70),new THREE.MeshStandardMaterial({color:0x667d4e,roughness:1}));ground.position.y=-.5;ground.receiveShadow=true;scene.add(ground);
// Lightweight ground variation: visual-only patches keep the existing flat collision/world layout intact.
const terrainDetail=new THREE.Group();scene.add(terrainDetail);
const patchMat=new THREE.MeshStandardMaterial({color:0x718658,roughness:1});
const dryMat=new THREE.MeshStandardMaterial({color:0x7b8054,roughness:1});
const bankMat=new THREE.MeshStandardMaterial({color:0x667552,roughness:1});
const patchData=[[-15,-17,5.5,3.2,.12],[-8,15,4.8,2.7,-.3],[14,15,5.8,3.4,.24],[20,-15,4.5,2.6,-.18],[-33,13,4.2,2.4,.4],[8,26,5.2,2.8,-.5]];
for(let i=0;i<patchData.length;i++){const [x,z,rx,rz,r]=patchData[i],m=new THREE.Mesh(new THREE.CircleGeometry(1,18),i%3===0?dryMat:patchMat);m.scale.set(rx,rz,1);m.rotation.x=-Math.PI/2;m.rotation.z=r;m.position.set(x,.012,z);m.receiveShadow=true;terrainDetail.add(m)}
for(const x of[-29.6,-18.4]){const bank=new THREE.Mesh(new THREE.BoxGeometry(1.3,.035,70),bankMat);bank.position.set(x,.018,0);bank.receiveShadow=true;terrainDetail.add(bank)}
const river="""
assert old in s,'ground anchor not found'
s=s.replace(old,new,1)
p.write_text(s)

ip=Path('index.html')
h=ip.read_text()
assert './main.js?v=humanoid-polish-1' in h,'cache anchor not found'
ip.write_text(h.replace('./main.js?v=humanoid-polish-1','./main.js?v=terrain-polish-1',1))
