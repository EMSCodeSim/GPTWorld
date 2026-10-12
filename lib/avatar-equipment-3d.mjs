// Equipment meshes are attached to the character's existing animated humanoid rig.
// Only player rigs receive these attachments. No textures or remote asset requests.
const colorFor=key=>/iron|steel|plate|mail|armor|armour/.test(key)?0x8b979c:/leather|hide|fur/.test(key)?0x765039:/royal|gold/.test(key)?0xb39b59:/cloth|robe|tunic|shirt/.test(key)?0x566e80:0x65705a;
function mesh(T,parent,geometry,color,position,options={}){
  const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:options.metal ? 0.4 : 0.78,metalness:options.metal ? 0.68 : 0.03,side:T.DoubleSide}));
  m.position.set(...position);m.castShadow=true;parent.add(m);return m;
}
function wearable(T,root,slot,key,rig){
  const c=colorFor(key),metal=/iron|steel|plate|mail/.test(key);
  if(slot==='head'){
    const g=new T.Group();rig.head.add(g);
    mesh(T,g,new T.SphereGeometry(.323,14,10,0,Math.PI*2,0,Math.PI*.48),c,[0,.065,0],{metal});
    mesh(T,g,new T.TorusGeometry(.295,.035,7,18),c,[0,.045,0],{metal}).rotation.x=Math.PI/2;
    return;
  }
  if(slot==='chest'){
    mesh(T,rig.pelvis,new T.CapsuleGeometry(.36,.52,6,12),c,[0,.43,.015],{metal}).scale.set(1.05,1.04,.86);
    for(const side of [-1,1])mesh(T,side<0?rig.armLPivot:rig.armRPivot,new T.SphereGeometry(.135,9,8),c,[0,-.07,0],{metal}).scale.set(1.22,.8,1.14);
    return;
  }
  if(slot==='legs'){
    for(const pivot of [rig.legLPivot,rig.legRPivot])mesh(T,pivot,new T.CapsuleGeometry(.116,.26,5,10),c,[0,-.21,0],{metal});
    return;
  }
  if(slot==='feet'){
    for(const leg of [rig.legLPivot,rig.legRPivot])mesh(T,leg,new T.BoxGeometry(.27,.19,.37),c,[0,-.72,.09],{metal});
    return;
  }
  if(slot==='back'){
    if(/cloak|cape/.test(key)){
      const cloth=mesh(T,root,new T.ConeGeometry(.45,1.25,9,1,true),c,[0,1.03,-.24]);cloth.rotation.x=Math.PI;cloth.scale.z=.42;
    }else{
      mesh(T,root,new T.BoxGeometry(.59,.7,.27),c,[0,1.32,-.42]);
      for(const x of [-.2,.2])mesh(T,root,new T.BoxGeometry(.07,.59,.055),0x392d24,[x,1.34,-.24]);
    }
    return;
  }
  const left=slot==='offHand';
  const anchor=left?rig.elbowL:rig.elbowR;
  const hand=new T.Group();hand.position.set(0,-.37,.02);anchor.add(hand);
  if(/shield|buckler/.test(key)){
    const shield=mesh(T,hand,new T.SphereGeometry(.36,10,8),c,[0,-.17,.14],{metal});shield.scale.set(.83,1.2,.22);
    mesh(T,hand,new T.SphereGeometry(.11,10,8),0xbca16d,[0,-.17,.27],{metal:true});return;
  }
  if(/bow|crossbow/.test(key)){
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.52,0),new T.Vector3(.16,-.25,0),new T.Vector3(.18,0,0),new T.Vector3(.16,.25,0),new T.Vector3(0,.52,0)]);
    mesh(T,hand,new T.TubeGeometry(curve,18,.035,6,false),0x86552f,[0,0,0]);
    mesh(T,hand,new T.CylinderGeometry(.007,.007,1.04,5),0xe5d8b1,[0,0,0]);return;
  }
  const axe=/axe|hatchet/.test(key),hammer=/hammer|mace/.test(key),spear=/spear|staff/.test(key),blade=/sword|knife|dagger/.test(key);
  const length=spear?1.35:blade?1.02:.8;
  mesh(T,hand,new T.CylinderGeometry(.034,.04,length,8),axe||hammer?0x60442b:blade?0x9b9d9b:0x6d5237,[0,-length*.16,0],{metal:blade});
  if(axe)mesh(T,hand,new T.BoxGeometry(.3,.23,.075),0x879197,[.15,-length*.47,0],{metal:true});
  else if(hammer)mesh(T,hand,new T.BoxGeometry(.3,.15,.16),0x9b9c99,[0,-length*.5,0],{metal:true});
  else if(blade)mesh(T,hand,new T.BoxGeometry(.11,.42,.034),0xc3c6c7,[0,-length*.6,0],{metal:true});
  else if(spear)mesh(T,hand,new T.ConeGeometry(.085,.26,6),0xadb0ad,[0,-length*.6,0],{metal:true}).rotation.z=Math.PI;
}
export function applyAvatarEquipment(T,character,payload){
  const rig=character?.userData?.rig;
  if(!rig||!payload?.slots||!Array.isArray(payload.items))return;
  const prior=character.userData.avatarAttachments||[];
  for(const {node,meshStart} of prior){
    const objects=node.children.slice(meshStart);
    for(const object of objects){node.remove(object);object.traverse?.(part=>{if(part.isMesh){part.geometry?.dispose();part.material?.dispose();}});}
  }
  const roots=[character,rig.head,rig.pelvis,rig.armLPivot,rig.armRPivot,rig.legLPivot,rig.legRPivot,rig.elbowL,rig.elbowR];
  const baseline=roots.map(node=>({node,meshStart:node.children.length}));
  const owned=new Map(payload.items.filter(item=>!item.placed).map(item=>[String(item.id),item]));
  const entries=Object.entries(payload.slots);
  for(const [slot,id] of entries){
    const item=owned.get(String(id));if(item)wearable(T,character,slot,String(item.key||''),rig);
  }
  character.userData.avatarAttachments=baseline;
}
