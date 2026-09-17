import fs from 'node:fs';
const file='netlify/functions/_sim-core.mjs';
let code=fs.readFileSync(file,'utf8');
const replace=(oldText,newText,label)=>{if(!code.includes(oldText))throw Error(`Missing ${label}; refusing unsafe patch`);code=code.replace(oldText,newText);};
if(code.includes('function animalMemory(')){console.log('Animal herds already integrated');process.exit(0);}
replace('function animalParts(out,s,i,x,z,body,heading,behavior=',`// Stable per-animal memory: deterministic across requests and shared by both world renderers.
function animalMemory(s,i,frame){
 const id=\`\${s.id}:\${i}\`,epoch=Math.floor(frame/480);
 const zones=ecologyHabitatZones(s.habitat,hash01(s.id));
 const safe=zones[Math.floor(hash01(\`\${id}:safe:\${epoch}\`)*zones.length)%zones.length];
 const food=zones[Math.floor(hash01(\`\${id}:food:\${epoch}\`)*zones.length)%zones.length];
 const water=ecologyHabitatZones('riverbank',hash01(s.id))[Math.floor(hash01(\`\${id}:water:\${epoch}\`)*4)%4];
 return {safe:{x:safe.x,z:safe.z},food:{x:food.x,z:food.z},water:{x:water.x,z:water.z},epoch};
}
function herdOffset(s,i,frame){const leader=Math.floor(i/3)*3;const phase=hash01(\`\${s.id}:herd:\${leader}\`)*Math.PI*2;return {leader,dx:Math.cos(phase+i*2.4)*(.5+(i%3)*.35),dz:Math.sin(phase+i*2.4)*(.5+(i%3)*.35)};}
function animalParts(out,s,i,x,z,body,heading,behavior=`, 'animal part insertion');
replace('const base=animalPosition(s,i,frame,weather,forestPressure),nextBase=animalPosition(s,i,frame+1,weather,forestPressure),epoch=', 'const base=animalPosition(s,i,frame,weather,forestPressure),nextBase=animalPosition(s,i,frame+1,weather,forestPressure),memory=animalMemory(s,i,frame),herd=herdOffset(s,i,frame),epoch=', 'herbivore memory');
replace("let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior=base.forestShift>=.2?'migrating':'roaming';", "let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior=base.forestShift>=.2?'migrating':'herding';if(i%3){const leader=animalPosition(s,herd.leader,frame,weather,forestPressure);x=x*.22+(leader.x+herd.dx)*.78;z=z*.22+(leader.z+herd.dz)*.78;nx=x; nz=z;}if(Number(s.needs?.thirst||0)>.65){const p=animalLandRoute({x,z},memory.water,.36,`${s.id}:${i}:water`);x=p.x;z=p.z;behavior='seeking water';}", 'herd formation');
replace("if(target&&local>=18){", "if(target&&local>=18&&Number(s.needs?.thirst||0)<=.65){", 'thirst priority');
replace("const record={s,i,x,z,nx,nz,behavior,target,consumedPlant:target&&local>=58?target.id:null,id:`${s.id}-${i}`};", "const record={s,i,x,z,nx,nz,behavior,target,memory,herdId:`${s.id}-${herd.leader}`,consumedPlant:target&&local>=58?target.id:null,id:`${s.id}-${i}`};", 'herd metadata');
replace("let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior='patrolling';", "let x=base.x,z=base.z,nx=nextBase.x,nz=nextBase.z,behavior='patrolling',successfulHunt=false;const stamina=Number(s.needs?.energy??.85),preyStamina=Number(prey?.s.needs?.energy??.85),huntSuccess=hash01(`${s.id}:${i}:${epoch}:outcome`)<clamp(.43+(stamina-preyStamina)*.3, .12,.8);", 'chase outcome');
replace("behavior=local>=90?'feeding':'stalking';if(local>=98)killedPrey.add(prey.id);", "behavior=local<64?'stalking':local<90?'chasing':huntSuccess?'feeding':'recovering';if(local>=90&&!huntSuccess){const retreat=animalLandRoute({x,z},base,.5,`${s.id}:${i}:retreat`);x=retreat.x;z=retreat.z;}if(local>=98&&huntSuccess){killedPrey.add(prey.id);successfulHunt=true;}", 'chase stages');
replace("animals.push({s,i,x,z,nx,nz,behavior,target:prey?.id||null});", "animals.push({s,i,x,z,nx,nz,behavior,target:prey?.id||null,memory:animalMemory(s,i,frame),successfulHunt});", 'predator metadata');
replace("entity.population=Number(record.s.population||0);", "entity.population=Number(record.s.population||0);entity.memory=record.memory||null;entity.herdId=record.herdId||null;entity.huntSucceeded=Boolean(record.successfulHunt);", 'inspection metadata');
fs.writeFileSync(file,code);
console.log('Integrated deterministic herds, memory, and probabilistic chase outcomes');