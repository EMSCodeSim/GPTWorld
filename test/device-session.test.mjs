import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cookieValue,deviceCookie,hashSecret,newRecoveryCode,normalizeRecoveryCode} from '../netlify/lib/device-session-core.mjs';

test('device secrets and recovery codes are strong and normalized',()=>{
  const first=newRecoveryCode(),second=newRecoveryCode();
  assert.match(first,/^GW-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
  assert.notEqual(first,second);
  assert.equal(normalizeRecoveryCode(first).length,18);
  assert.equal(hashSecret('secret').length,64);
  assert.notEqual(hashSecret('secret'),hashSecret('different'));
});

test('device cookie is host-only, secure, and inaccessible to client scripts',()=>{
  const header=deviceCookie('opaque-token');
  assert.match(header,/^__Host-gptworld_device=/);
  assert.match(header,/Path=\//);
  assert.match(header,/HttpOnly/);
  assert.match(header,/Secure/);
  assert.match(header,/SameSite=Lax/);
  assert.equal(cookieValue('other=x; __Host-gptworld_device=opaque-token; theme=dark'),'opaque-token');
});

test('device-session migration is additive and enforces one session per player',async()=>{
  const sql=(await readFile(new URL('../migrations/006_device_bound_guest_sessions.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists player_device_sessions/);
  assert.match(sql,/player_id bigint not null unique references players/);
  assert.match(sql,/device_token_hash text not null unique/);
  assert.match(sql,/backup_token_hash text not null unique/);
  assert.match(sql,/recovery_code_hash text not null unique/);
  assert.doesNotMatch(sql,/drop table|truncate|delete from/);
});

test('registration is server controlled and legacy players are claimed safely',async()=>{
  const [endpoint,world,worldV2]=await Promise.all([
    readFile(new URL('../netlify/functions/device-session.mjs',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/world.mjs',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/world-v2.mjs',import.meta.url),'utf8')
  ]);
  assert.match(endpoint,/claimed_legacy_client_id/);
  assert.match(endpoint,/registration_key/);
  assert.match(endpoint,/recovery_required/);
  assert.match(endpoint,/INSERT INTO players\(client_id,display_name/);
  for(const source of[world,worldV2]){
    assert.doesNotMatch(source,/INSERT INTO players/);
    assert.match(source,/UPDATE players SET display_name=/);
    assert.match(source,/player_not_registered/);
    assert.match(source,/ELSE 'public-'\|\|id::text/);
  }
});

test('onboarding exposes one-device resume and recovery without passwords',async()=>{
  const [html,client]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../main.js',import.meta.url),'utf8')
  ]);
  assert.match(html,/Each device keeps one traveler and one personal world/);
  assert.match(html,/id="recoveryNotice"/);
  assert.match(html,/id="recoverTraveler"/);
  assert.doesNotMatch(html,/Create another traveler/);
  assert.match(client,/resolveDeviceSession/);
  assert.match(client,/registerDevice/);
  assert.match(client,/recoverDevice/);
  assert.doesNotMatch(client,/function ensureClientId\(\).*crypto\.randomUUID/);
});
