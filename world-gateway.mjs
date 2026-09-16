export const WORLD_GATEWAY=Object.freeze({x:-30.8,z:0,halfDepth:.9,halfWidth:1.2});

export function isInsideWorldGateway(x,z,gateway=WORLD_GATEWAY){
  const px=Number(x),pz=Number(z);
  if(!Number.isFinite(px)||!Number.isFinite(pz))return false;
  return Math.abs(px-gateway.x)<=gateway.halfDepth&&Math.abs(pz-gateway.z)<=gateway.halfWidth;
}
