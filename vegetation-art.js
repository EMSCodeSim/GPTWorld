// Visual-only vegetation upgrade for GPTWorld. No harvesting or ecology state lives here.
// Pass the existing THREE import to avoid loading another Three.js instance.
export function createPineArt(THREE, scale = 1) {
  const group = new THREE.Group();
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.20*scale,.36*scale,2.3*scale,7),material(0x705034));
  trunk.position.y = 1.15*scale; trunk.castShadow = true; group.add(trunk);
  for (const [y,r,h,color] of [[2.15,1.22,1.65,0x244b32],[2.85,1.08,1.72,0x315f3a],[3.55,.78,1.55,0x427348]]) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(r*scale,h*scale,8),material(color));
    b.position.y=y*scale; b.castShadow=true; b.receiveShadow=true; group.add(b);
  }
  for (const [x,z] of [[-.22,.19],[.19,-.18]]) {
    const root = new THREE.Mesh(new THREE.BoxGeometry(.23*scale,.17*scale,.52*scale),material(0x62432b));
    root.position.set(x*scale,.09*scale,z*scale); root.castShadow=true; group.add(root);
  }
  // Keep trunk and canopy references compatible with existing depletion visuals.
  const crown = new THREE.Group();
  for (const child of [...group.children]) if (child !== trunk && child.geometry?.type === 'ConeGeometry') {group.remove(child);crown.add(child);}
  group.add(crown);
  return {group,trunk,crown};
}

export function createHerbArt(THREE, scale=1, variant=0) {
  const group=new THREE.Group();
  const stemMat=new THREE.MeshStandardMaterial({color:0x426f39,roughness:1,flatShading:true});
  const leafMats=[0x70a34f,0x91b65e,0x507f48].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide,flatShading:true}));
  const flowerMat=new THREE.MeshStandardMaterial({color:variant%2?0xe7d78b:0xb99ccf,roughness:1});
  for(let i=0;i<7;i++) {
    const angle=i*Math.PI*2/7, radius=.16+(i%3)*.12, height=(.42+(i%3)*.12)*scale;
    const x=Math.cos(angle)*radius*scale,z=Math.sin(angle)*radius*scale;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018*scale,.035*scale,height,5),stemMat);
    stem.position.set(x,height/2,z);stem.rotation.z=Math.sin(angle)*.2;group.add(stem);
    for(const side of [-1,1]) {
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18*scale,6,4),leafMats[(i+side+3)%leafMats.length]);
      leaf.scale.set(1,.17,.48);leaf.position.set(x+side*.12*scale,height*.65,z+side*.05*scale);leaf.rotation.y=angle;group.add(leaf);
    }
    if(i%3===0){const bloom=new THREE.Mesh(new THREE.IcosahedronGeometry(.075*scale,0),flowerMat);bloom.position.set(x,height+.03*scale,z);group.add(bloom);}
  }
  return group;
}
