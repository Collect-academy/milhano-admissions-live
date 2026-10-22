// Read-only regression checks: no Stripe calls, no purchases, no Supabase mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('before 18:00 masked API branch does not consult orders or reservations',()=>{
 const source=file('app/api/boletos/seats/route.ts');
 const start=source.indexOf('if(masked){'); const end=source.indexOf('const seats=await sql`select',start);
 assert.ok(start>0&&end>start);
 const masked=source.slice(start,end);
 assert.match(masked,/available'::text as availability/);
 assert.doesNotMatch(masked,/reservations|reservation_seats|orders|paid|held|blocked/);
 assert.match(source,/new Date\(e\.db_now\)/);
 assert.match(source,/!isAdmin/);
});
test('parent own purchased seats/count hidden before opening',()=>{
 const m=file('app/api/boletos/me/route.ts');
 assert.match(m,/const paid=masked\?\[\]:await sql/);
 assert.match(m,/is_ticketing_admin/);
 assert.match(m,/maxPerFamily/);
});
test('admin selects up to saleable inventory, parent stays limited to 20',()=>{
 const r=file('app/api/boletos/reserve/route.ts');
 const p=file('app/boletos/page.tsx');
 assert.match(r,/\.max\(210\)/);
 assert.match(r,/is_ticketing_admin&&arr\.length>/);
 assert.match(p,/profile\?\.maxPerFamily\|\|20/);
});
test('mask cannot be bypassed by changing browser clock',()=>{
 const s=file('app/api/boletos/seats/route.ts');
 assert.match(s,/new Date\(e\.db_now\)\.getTime\(\)/);
 assert.doesNotMatch(s,/req\.headers\.get\(['"]date['"]\)/);
 assert.match(s,/masked:true/);
 assert.match(s,/masked:false/);
});
test('UI transparently labels as preview, status is not announced as available',()=>{
 const p=file('app/boletos/page.tsx');
 assert.match(p,/Vista previa: todos los asientos se muestran verdes/);
 assert.match(p,/setMaskActive\(x\.masked===true\)/);
 assert.match(p,/profile\?\.canPurchase!==true/);
});
