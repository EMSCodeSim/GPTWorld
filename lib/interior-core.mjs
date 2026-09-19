/** Shared building-interior rules used by the client and unit tests. */

export const INTERIOR_SPAWN_KEY='gptworld-public-spawn';
export const PRIVATE_INTERIOR_SPAWN_KEY='gptworld-private-spawn';
export const INTERIOR_RESUME_FROM='interior';
export const MIN_ENTER_LEVEL=2;
export const MAX_BUILDING_LEVEL=3;

export const BUILDING_EXTERIORS={
  inn:{x:4,z:-8,width:6,depth:5,label:'the Wayfarer Inn'},
  smithy:{x:11,z:-1,width:5,depth:5,label:'the smithy'},
  storehouse:{x:4,z:7,width:5,depth:6,label:'the storehouse'},
  healer:{x:-5,z:-8,width:4.5,depth:4.5,label:'the healer’s cottage'},
  council:{x:-6,z:5,width:5,depth:4,label:'the council hall'},
  homestead:{x:0,z:3,width:7,depth:6,label:'your homestead'}
};

export const BUILDING_INTERIORS={
  inn:{
    name:'Wayfarer Inn',
    wall:0x9b815c,trim:0x5b3b2d,floor:0x79553a,
    resident:'Mara the Keeper',residentColor:0x7b4f42,
    objects:[
      ['guest bed','bed',-4,-3,'A warm bed waits for a weary traveler.'],
      ['hearth','hearth',4,-3,'The inn hearth gives off a steady warmth.'],
      ['guest ledger','desk',3.5,2.4,'The ledger records travelers who passed through the settlement.']
    ],
    level3Objects:[
      ['extra guest cot','bed',-4,2.2,'A second cot was added when the inn expanded.'],
      ['taproom barrels','crates',4,2.2,'Fresh barrels line the expanded gathering hall.']
    ]
  },
  smithy:{
    name:'Smithy',
    wall:0x8c7254,trim:0x4a3328,floor:0x625044,
    resident:'Tovan the Smith',residentColor:0x455c6b,
    objects:[
      ['forge','hearth',-4,-3,'The forge is hot. Future crafting work will happen here.'],
      ['anvil','anvil',2.8,-1.8,'A heavy iron anvil stands ready for smithing.'],
      ['tool bench','desk',3.8,2.8,'Hammers, tongs, and unfinished tools cover the bench.']
    ],
    level3Objects:[
      ['quench trough','crates',-3.8,2.4,'Water and sand wait beside the expanded forge.'],
      ['ore shelves','shelves',4.2,-3.2,'Sorted ore and scrap metal fill the annex shelves.']
    ]
  },
  storehouse:{
    name:'Storehouse',
    wall:0x9a8865,trim:0x5a4431,floor:0x725940,
    resident:'Storehouse Keeper',residentColor:0x6a5d48,
    objects:[
      ['supply crates','crates',-3.8,-2.8,'These crates hold the settlement’s shared supplies.'],
      ['storage shelves','shelves',4,-2.8,'The shelves are sorted for counting and distribution.'],
      ['inventory ledger','desk',3.3,2.5,'The ledger tracks community resource deposits.']
    ],
    level3Objects:[
      ['reinforced crates','crates',-3.6,2.5,'Reinforced crates expand community storage capacity.'],
      ['counting table','desk',-1.2,-3.1,'Clerks tally shared wood, stone, and herbs here.']
    ]
  },
  healer:{
    name:'Healer’s Cottage',
    wall:0x967b58,trim:0x60402e,floor:0x786148,
    resident:'Edda the Healer',residentColor:0x697348,
    objects:[
      ['treatment bed','bed',-3.8,-2.8,'A clean treatment bed is ready for the next patient.'],
      ['herb cabinet','shelves',4,-2.7,'Dried medicinal herbs fill the cabinet.'],
      ['medicine table','herbs',3.2,2.5,'Remedies and simple instruments are arranged here.']
    ],
    level3Objects:[
      ['clinic cot','bed',-3.6,2.4,'A second treatment bed fills the expanded clinic.'],
      ['apothecary shelf','shelves',4.1,2.4,'Prepared salves and poultices wait for patients.']
    ]
  },
  council:{
    name:'Council Hall',
    wall:0x8b7658,trim:0x4c3529,floor:0x6f553d,
    resident:'Council Steward',residentColor:0x625274,
    objects:[
      ['council table','table',0,-1,'The settlement gathers here to decide what comes next.'],
      ['world map','map',-4.7,-5.8,'A hand-drawn map shows the valley, river, and trails.'],
      ['notice board','board',4.7,-5.8,'Community plans and announcements are pinned here.']
    ],
    level3Objects:[
      ['archive shelves','shelves',-4.2,2.6,'Settlement records fill the expanded council chamber.'],
      ['planning desk','desk',4.2,2.4,'Maps and project notes cover the steward’s desk.']
    ]
  },
  homestead:{
    name:'Basic Homestead',
    wall:0x8f7354,trim:0x5a3d2c,floor:0x6e5238,
    resident:null,residentColor:0x6a5a48,private:true,alwaysOpen:true,
    objects:[
      ['homestead bed','bed',-4,-3,'Your own bed. Rest here between days of building.'],
      ['stone hearth','hearth',4,-3,'A hearth you raised yourself. It warms the cabin.'],
      ['work table','desk',3.4,2.2,'Plans, tools, and notes for your next project.']
    ],
    level3Objects:[
      ['storage corner','crates',-3.6,2.3,'Room for crates and household stores.'],
      ['wall shelves','shelves',4.1,2.3,'Shelves for finished crafts and supplies.']
    ]
  }
};

export function normalizeBuildingLevel(value){
  const level=Number(value);
  if(!Number.isFinite(level))return 1;
  return Math.max(1,Math.min(MAX_BUILDING_LEVEL,Math.floor(level)));
}

export function isKnownBuilding(buildingId){
  return Object.hasOwn(BUILDING_INTERIORS,String(buildingId||''));
}

export function canEnterBuilding(level,buildingId=''){
  if(BUILDING_INTERIORS[buildingId]?.alwaysOpen)return true;
  return normalizeBuildingLevel(level)>=MIN_ENTER_LEVEL;
}

export function outdoorExitPosition(buildingId){
  const exterior=BUILDING_EXTERIORS[buildingId];
  if(!exterior)return {x:0,z:12};
  // Stand just outside the south-facing door used by the public town models.
  return {
    x:Number(exterior.x.toFixed(2)),
    z:Number((exterior.z+exterior.depth/2+2.15).toFixed(2))
  };
}

export function rememberOutdoorPosition(position={},buildingId=''){
  const exterior=BUILDING_EXTERIORS[buildingId];
  const fallback=outdoorExitPosition(buildingId);
  const x=Number(position.x);
  const z=Number(position.z);
  return {
    x:Number.isFinite(x)?Number(x.toFixed(2)):fallback.x,
    z:Number.isFinite(z)?Number(z.toFixed(2)):fallback.z,
    buildingId:exterior?String(buildingId):'',
    from:INTERIOR_RESUME_FROM
  };
}

export function interiorEntryUrl(buildingId,base='./interior.html',extra={}){
  const id=String(buildingId||'');
  if(!isKnownBuilding(id))return null;
  const params=new URLSearchParams({building:id,v:'interior-playable-2',...extra});
  return `${base}?${params.toString()}`;
}

export function interiorExitUrl(base='./index.html',from=INTERIOR_RESUME_FROM){
  return `${base}?from=${encodeURIComponent(from)}`;
}

export function isPrivateInterior(buildingId){
  return Boolean(BUILDING_INTERIORS[buildingId]?.private);
}

export function shouldAutoResumePublicWorld(from){
  return from==='private'||from===INTERIOR_RESUME_FROM;
}

export function resolveInteriorObjects(buildingId,level){
  const config=BUILDING_INTERIORS[buildingId];
  if(!config)return [];
  const objects=[...config.objects];
  if(normalizeBuildingLevel(level)>=3)objects.push(...(config.level3Objects||[]));
  return objects;
}

export function loadingOutcome({buildingId,level,error=null}={}){
  if(error){
    return {
      ok:false,
      closed:false,
      title:'The building would not open',
      message:error==='timeout'
        ?'The settlement took too long to respond. Try again.'
        :'The shared building level could not be verified. Try again.',
      showRetry:true,
      hideLoading:false
    };
  }
  if(!isKnownBuilding(buildingId)){
    return {
      ok:false,
      closed:true,
      title:'Unknown building',
      message:'Return to town upgrades and choose an available building.',
      showRetry:false,
      hideLoading:false
    };
  }
  if(!canEnterBuilding(level,buildingId)){
    const name=BUILDING_INTERIORS[buildingId].name;
    return {
      ok:false,
      closed:true,
      title:`${name} is still closed`,
      message:'Upgrade this building to Level 2 before entering.',
      showRetry:false,
      hideLoading:false
    };
  }
  return {
    ok:true,
    closed:false,
    title:`Opening ${BUILDING_INTERIORS[buildingId].name}…`,
    message:isPrivateInterior(buildingId)
      ?'Preparing your private cabin.'
      :'Checking the settlement’s shared upgrade level.',
    showRetry:false,
    hideLoading:true
  };
}

export function interactionResult(item,{stockpile=null,level=1}={}){
  if(!item)return {type:'none',message:''};
  if(item.name==='exit to world'||item.kind==='exit'){
    return {type:'exit',message:'Leave the building.'};
  }
  if(item.name==='inventory ledger'||item.kind==='stockpile-ledger'){
    const pile={
      wood:Math.max(0,Number(stockpile?.wood||0)),
      stone:Math.max(0,Number(stockpile?.stone||0)),
      herbs:Math.max(0,Number(stockpile?.herbs||0))
    };
    return {
      type:'stockpile',
      message:`Settlement stockpile · wood ${pile.wood} · stone ${pile.stone} · herbs ${pile.herbs}. Deposits happen at the outdoor storehouse.`
    };
  }
  const base=String(item.message||`You examine the ${item.name||'object'}.`);
  if(normalizeBuildingLevel(level)>=3){
    return {type:'inspect',message:`${base} The Level 3 expansion is open and in use.`};
  }
  return {type:'inspect',message:base};
}

export function isInsideExitThreshold(player,{exitX=0,exitZ=5.85,radius=1.4}={}){
  const dx=Number(player?.x)-exitX;
  const dz=Number(player?.z)-exitZ;
  return Math.hypot(dx,dz)<=radius;
}

export function stepInteriorMovement(position,velocity,dt,{blocked}={}){
  const next={x:position.x,z:position.z};
  const nx=position.x+velocity.x*dt;
  const nz=position.z+velocity.z*dt;
  if(typeof blocked!=='function'||!blocked(nx,position.z))next.x=nx;
  if(typeof blocked!=='function'||!blocked(next.x,nz))next.z=nz;
  return next;
}
