/** Shared gatherable resource defaults for public and private worlds. */
export const RESOURCE_DEFAULTS=Object.freeze({
  wood:{max:6,regrowMinutes:60},
  stone:{max:12,regrowMinutes:480},
  herbs:{max:3,regrowMinutes:20}
});

export function resourceDefaultsFor(resource){
  return RESOURCE_DEFAULTS[String(resource||'')]||null;
}

export function privateKindToResource(kind){
  if(kind==='tree')return 'wood';
  if(kind==='rock')return 'stone';
  if(kind==='herbs')return 'herbs';
  return null;
}

const TOWN_BUILDINGS=[
  {x:4,z:-8,r:4.2},{x:11,z:-1,r:3.8},{x:4,z:7,r:4},{x:-5,z:-8,r:3.6},{x:-6,z:5,r:3.6}
];

export function isValidStoneDepositPosition(x,z){
  const px=Number(x),pz=Number(z);
  if(!Number.isFinite(px)||!Number.isFinite(pz))return false;
  if(Math.abs(px)>31||Math.abs(pz)>31)return false;
  if(px>-29&&px<-19)return false;
  if(Math.hypot(px,pz)<8)return false;
  for(const building of TOWN_BUILDINGS){
    if(Math.hypot(px-building.x,pz-building.z)<building.r)return false;
  }
  return true;
}

export function proposeStoneDeposit({seed=1,existing=[],now=Date.now()}={}){
  const stoneNodes=(existing||[]).filter(node=>String(node.resource||node.resourceType||'')==='stone');
  if(stoneNodes.length>=10)return null;
  const dayBucket=Math.floor(Number(now)/86400000);
  const roll=((Math.imul(Number(seed)||1,1103515245)+dayBucket*12345)>>>0)%1000;
  if(roll>18)return null;
  for(let attempt=0;attempt<12;attempt++){
    const a=(((roll+attempt*97)>>>0)%628)/100;
    const r=10+((roll+attempt*41)%190)/10;
    const x=Number((Math.cos(a)*r).toFixed(2)),z=Number((Math.sin(a)*r).toFixed(2));
    if(!isValidStoneDepositPosition(x,z))continue;
    if(stoneNodes.some(node=>Math.hypot(Number(node.x)-x,Number(node.z)-z)<3.5))continue;
    const id=`rock-spawn-${dayBucket}-${attempt}`;
    if(stoneNodes.some(node=>String(node.nodeId||node.id)===id))continue;
    return{
      id,
      type:'resource',
      resource:'stone',
      x,z,
      max:RESOURCE_DEFAULTS.stone.max,
      regrowMinutes:RESOURCE_DEFAULTS.stone.regrowMinutes,
      scale:.85,
      label:'stone outcrop'
    };
  }
  return null;
}
