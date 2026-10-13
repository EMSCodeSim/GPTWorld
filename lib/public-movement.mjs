// Public-world walking helpers. Pure so mobile movement and boundaries can be regression-tested.
export const WALK_LIMIT=51;
export function walkInputFromScreen(x,y,cameraX=13,cameraZ=13){
 const length=Math.hypot(cameraX,cameraZ)||1;
 const fx=-cameraX/length,fz=-cameraZ/length;
 const rx=-fz,rz=fx;
 const wx=rx*x-fx*y,wz=rz*x-fz*y;
 const strength=Math.min(1,Math.hypot(wx,wz));
 const magnitude=Math.hypot(wx,wz)||1;
 return {x:wx/magnitude*strength,z:wz/magnitude*strength,strength};
}
export function blockedByWorld(x,z,{limit=WALK_LIMIT,bridgeBuilt=false,obstacles=[]}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>limit||Math.abs(z)>limit)return true;
 // A continuous river prevents walking across water away from the bridge.
 if(x>-29&&x<-19&&!(bridgeBuilt&&Math.abs(z)<1.55))return true;
 for(const b of obstacles){const dx=x-b.x,dz=z-b.z;if(dx*dx+dz*dz<b.r*b.r)return true;}
 return false;
}
export function moveWithSlide(x,z,dx,dz,blocked){
 if(!blocked(x+dx,z+dz))return{x:x+dx,z:z+dz};
 if(!blocked(x+dx,z))return{x:x+dx,z};
 if(!blocked(x,z+dz))return{x,z:z+dz};
 return{x,z};
}
