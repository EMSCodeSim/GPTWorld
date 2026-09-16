const DB_NAME='gptworld-private-world-cache';
const DB_VERSION=1;
const SNAPSHOTS='snapshots';
const ACTIONS='actions';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function normalizeCachedPosition(position,fallback={x:0,z:8}){
  return{
    x:Math.max(-33,Math.min(33,finite(position?.x,fallback.x))),
    z:Math.max(-33,Math.min(33,finite(position?.z,fallback.z)))
  };
}

export function createPrivateWorldSnapshot(payload,clientId,savedAt=Date.now()){
  if(!clientId||!payload?.world?.id||!payload.world.terrain||!payload.world.ecology)throw new Error('invalid_private_world_snapshot');
  return{
    version:1,
    clientId:String(clientId),
    savedAt:Number(savedAt),
    world:structuredClone(payload.world),
    session:{position:normalizeCachedPosition(payload.session?.position,payload.world.terrain.spawn)},
  };
}

export function snapshotToPrivateWorldPayload(snapshot){
  if(!snapshot?.clientId||!snapshot?.world?.terrain||!snapshot?.world?.ecology)return null;
  return{
    ok:true,
    world:structuredClone(snapshot.world),
    session:{worldType:'private',position:normalizeCachedPosition(snapshot.session?.position,snapshot.world.terrain.spawn)},
    inventory:null,
    catchUp:{steps:0,capped:false},
    fromCache:true,
    cachedAt:Number(snapshot.savedAt||0)
  };
}

function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('indexeddb_unavailable'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(SNAPSHOTS))database.createObjectStore(SNAPSHOTS,{keyPath:'clientId'});
      if(!database.objectStoreNames.contains(ACTIONS))database.createObjectStore(ACTIONS,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('indexeddb_open_failed'));
    request.onblocked=()=>reject(new Error('indexeddb_blocked'));
  });
}

async function storeRequest(storeName,mode,operation){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction(storeName,mode),store=transaction.objectStore(storeName);
    let request;
    try{request=operation(store);}catch(error){database.close();reject(error);return;}
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('indexeddb_request_failed'));
    transaction.oncomplete=()=>database.close();
    transaction.onerror=()=>{database.close();reject(transaction.error||new Error('indexeddb_transaction_failed'));};
    transaction.onabort=()=>{database.close();reject(transaction.error||new Error('indexeddb_transaction_aborted'));};
  });
}

export async function cachePrivateWorld(payload,clientId){
  const snapshot=createPrivateWorldSnapshot(payload,clientId);
  await storeRequest(SNAPSHOTS,'readwrite',store=>store.put(snapshot));
  return snapshot;
}

export async function getCachedPrivateWorld(clientId){
  if(!clientId)return null;
  const snapshot=await storeRequest(SNAPSHOTS,'readonly',store=>store.get(String(clientId)));
  return snapshotToPrivateWorldPayload(snapshot);
}

export async function queuePrivatePosition(clientId,position,updatedAt=Date.now()){
  if(!clientId)throw new Error('client_id_required');
  const action={id:`${clientId}:save_position`,clientId:String(clientId),type:'save_position',position:normalizeCachedPosition(position),updatedAt:Number(updatedAt)};
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction([ACTIONS,SNAPSHOTS],'readwrite');
    transaction.objectStore(ACTIONS).put(action);
    const snapshotRequest=transaction.objectStore(SNAPSHOTS).get(String(clientId));
    snapshotRequest.onsuccess=()=>{
      const snapshot=snapshotRequest.result;
      if(snapshot){snapshot.session={position:action.position};snapshot.savedAt=action.updatedAt;transaction.objectStore(SNAPSHOTS).put(snapshot);}
    };
    transaction.oncomplete=()=>{database.close();resolve(action);};
    transaction.onerror=()=>{database.close();reject(transaction.error||new Error('indexeddb_transaction_failed'));};
    transaction.onabort=()=>{database.close();reject(transaction.error||new Error('indexeddb_transaction_aborted'));};
  });
}

export async function getQueuedPrivatePosition(clientId){
  if(!clientId)return null;
  return await storeRequest(ACTIONS,'readonly',store=>store.get(`${clientId}:save_position`))||null;
}

export async function clearQueuedPrivatePosition(clientId,expectedUpdatedAt){
  const id=`${clientId}:save_position`,database=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction(ACTIONS,'readwrite'),store=transaction.objectStore(ACTIONS),request=store.get(id);
    let cleared=false;
    request.onsuccess=()=>{
      const current=request.result;
      if(current&&Number(current.updatedAt)===Number(expectedUpdatedAt)){store.delete(id);cleared=true;}
    };
    request.onerror=()=>reject(request.error||new Error('indexeddb_request_failed'));
    transaction.oncomplete=()=>{database.close();resolve(cleared);};
    transaction.onerror=()=>{database.close();reject(transaction.error||new Error('indexeddb_transaction_failed'));};
  });
}
