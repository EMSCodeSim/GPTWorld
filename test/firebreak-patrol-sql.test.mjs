import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('firebreak patrol SQL explicitly types JSON parameters and stays atomic',()=>{
  const source=readFileSync(new URL('../netlify/functions/world-v2.mjs',import.meta.url),'utf8');
  const start=source.indexOf("if (body.action === 'patrol_firebreak')");
  const end=source.indexOf("if (body.action === 'contribute_firebreak')",start);
  assert.ok(start>=0&&end>start);
  const patrol=source.slice(start,end);
  assert.match(patrol,/CAST\(\$\{name\} AS text\)/);
  assert.match(patrol,/\$\{playerId\}::bigint/);
  assert.match(patrol,/\$\{x\}::double precision/);
  assert.match(patrol,/\$\{z\}::double precision/);
  assert.match(patrol,/ON CONFLICT\(key\) DO UPDATE/);
  assert.match(patrol,/interval '60 minutes'/);
  assert.match(patrol,/INSERT INTO world_events/);
  assert.match(patrol,/FROM updated RETURNING id/);
});
