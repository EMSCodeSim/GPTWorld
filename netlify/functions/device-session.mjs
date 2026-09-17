import {neon} from '@neondatabase/serverless';
import {cleanDeviceValue,cleanTravelerName,cookieValue,deviceCookie,hashSecret,newRecoveryCode,newToken,normalizeRecoveryCode} from '../lib/device-session-core.mjs';

const reply=(body,status=200,token='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(token?{'set-cookie':deviceCookie(token)}:{})}});
const playerView=row=>({clientId:row.client_id,displayName:row.display_name});

async function sessionByDevice(sql,token){
  if(!token)return null;const rows=await sql`
    SELECT session.id,session.player_id,p.client_id,p.display_name
    FROM player_device_sessions session JOIN players p ON p.id=session.player_id
    WHERE session.device_token_hash=${hashSecret(token)} LIMIT 1
  `;return rows[0]||null;
}

async function rotateSession(sql,sessionId){
  const token=newToken(),backupToken=newToken();
  const rows=await sql`
    UPDATE player_device_sessions session SET device_token_hash=${hashSecret(token)},backup_token_hash=${hashSecret(backupToken)},last_seen_at=now(),token_rotated_at=now()
    FROM players p WHERE session.id=${sessionId} AND p.id=session.player_id
    RETURNING p.client_id,p.display_name
  `;
  return rows[0]?{token,backupToken,player:playerView(rows[0])}:null;
}

async function resume(sql,req,legacyClientId,backupToken){
  const cookieToken=cookieValue(req.headers.get('cookie')),current=await sessionByDevice(sql,cookieToken);
  if(current){const refreshedBackup=newToken();await sql`UPDATE player_device_sessions SET backup_token_hash=${hashSecret(refreshedBackup)},last_seen_at=now() WHERE id=${current.id}`;return{ok:true,session:'existing',token:cookieToken,backupToken:refreshedBackup,player:playerView(current)};}
  if(legacyClientId&&backupToken){
    const rows=await sql`
      SELECT session.id FROM player_device_sessions session JOIN players p ON p.id=session.player_id
      WHERE p.client_id=${legacyClientId} AND session.backup_token_hash=${hashSecret(backupToken)} LIMIT 1
    `;
    if(rows.length){const rotated=await rotateSession(sql,rows[0].id);return{ok:true,session:'restored_backup',...rotated};}
  }
  if(legacyClientId){
    const token=newToken(),newBackup=newToken(),recoveryCode=newRecoveryCode();
    const rows=await sql`
      WITH candidate AS (
        SELECT p.id,p.client_id,p.display_name FROM players p
        WHERE p.client_id=${legacyClientId} AND NOT EXISTS(SELECT 1 FROM player_device_sessions existing WHERE existing.player_id=p.id)
        LIMIT 1
      ), claimed AS (
        INSERT INTO player_device_sessions(player_id,device_token_hash,backup_token_hash,recovery_code_hash,claimed_legacy_client_id)
        SELECT id,${hashSecret(token)},${hashSecret(newBackup)},${hashSecret(normalizeRecoveryCode(recoveryCode))},client_id FROM candidate
        ON CONFLICT DO NOTHING RETURNING player_id
      ) SELECT candidate.client_id,candidate.display_name FROM candidate,claimed WHERE claimed.player_id=candidate.id
    `;
    if(rows.length)return{ok:true,session:'claimed_legacy',token,backupToken:newBackup,recoveryCode,player:playerView(rows[0])};
    const existing=await sql`SELECT 1 FROM players p JOIN player_device_sessions session ON session.player_id=p.id WHERE p.client_id=${legacyClientId} LIMIT 1`;
    if(existing.length)return{ok:false,error:'recovery_required',recoveryRequired:true};
  }
  return{ok:false,error:'registration_required',registrationRequired:true};
}

async function register(sql,name,registrationKey){
  if(!registrationKey)return{error:'registration_key_required'};
  const existing=await sql`SELECT id FROM player_device_sessions WHERE registration_key=${registrationKey} LIMIT 1`;
  if(existing.length)return rotateSession(sql,existing[0].id);
  const token=newToken(),backupToken=newToken(),recoveryCode=newRecoveryCode(),clientId=`traveler-${newToken().slice(0,36)}`;
  const rows=await sql`
    WITH player AS (
      INSERT INTO players(client_id,display_name,x,z,last_seen_at) VALUES(${clientId},${name},0,12,now())
      RETURNING id,client_id,display_name
    ), inventory AS (
      INSERT INTO player_inventory(player_id,wood,stone,herbs,updated_at) SELECT id,0,0,0,now() FROM player RETURNING player_id
    ), session AS (
      INSERT INTO player_device_sessions(player_id,device_token_hash,backup_token_hash,recovery_code_hash,registration_key)
      SELECT player.id,${hashSecret(token)},${hashSecret(backupToken)},${hashSecret(normalizeRecoveryCode(recoveryCode))},${registrationKey} FROM player,inventory
      RETURNING player_id
    ) SELECT player.client_id,player.display_name FROM player,session WHERE session.player_id=player.id
  `;
  return rows[0]?{token,backupToken,recoveryCode,player:playerView(rows[0])}:{error:'registration_failed'};
}

async function recover(sql,recoveryCode){
  const normalized=normalizeRecoveryCode(recoveryCode);if(normalized.length!==18)return null;
  const rows=await sql`SELECT id FROM player_device_sessions WHERE recovery_code_hash=${hashSecret(normalized)} LIMIT 1`;
  return rows.length?rotateSession(sql,rows[0].id):null;
}

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const url=new URL(req.url),body=req.method==='POST'?await req.json():{},legacyClientId=cleanDeviceValue(req.method==='GET'?url.searchParams.get('legacyClientId'):body.legacyClientId,80),backupToken=cleanDeviceValue(req.method==='GET'?url.searchParams.get('backupToken'):body.backupToken);
    const resumed=await resume(sql,req,legacyClientId,backupToken);
    if(resumed.ok)return reply({ok:true,session:resumed.session,player:resumed.player,backupToken:resumed.backupToken,recoveryCode:resumed.recoveryCode},200,resumed.token||'');
    if(req.method==='GET')return reply(resumed,200);
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    const action=cleanDeviceValue(body.action,30);
    if(action==='recover'){
      const result=await recover(sql,body.recoveryCode);return result?reply({ok:true,session:'recovered',player:result.player,backupToken:result.backupToken},200,result.token):reply({ok:false,error:'invalid_recovery_code'},404);
    }
    if(action!=='register')return reply({ok:false,error:'invalid_action'},400);
    if(resumed.recoveryRequired)return reply(resumed,409);
    const result=await register(sql,cleanTravelerName(body.name),cleanDeviceValue(body.registrationKey,100));
    return result?.player?reply({ok:true,session:'registered',player:result.player,backupToken:result.backupToken,recoveryCode:result.recoveryCode},201,result.token):reply({ok:false,error:result?.error||'registration_failed'},409);
  }catch(error){
    console.error('GPTWorld device session error',error);
    if(String(error?.message||'').includes('player_device_sessions'))return reply({ok:false,error:'device_session_migration_required'},503);
    return reply({ok:false,error:'device_session_failed'},500);
  }
};
