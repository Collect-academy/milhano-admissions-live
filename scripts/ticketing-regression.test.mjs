// Structural regression tests that run with built-in Node.js only (no Stripe calls / charges).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all imported modules exist at their real Next.js paths',()=>{
 for(const f of ['lib/ticketing/admin-access.ts','lib/ticketing/mode.ts','lib/ticketing/server.ts','app/boletos/page.tsx','app/api/boletos/reserve/route.ts','app/api/boletos/checkout/route.ts','app/api/boletos/me/route.ts']) assert.ok(existsSync(new URL('../'+f,import.meta.url)),f);
 for(const f of ['route.ts','route (1).ts','page.tsx','admin-access.ts'])assert.ok(!existsSync(new URL('../'+f,import.meta.url)),'Stray root file '+f);
});
test('access independent of sale window',()=>{
 assert.match(file('app/api/boletos/pin/route.ts'),/e\.access_enabled/);
 assert.doesNotMatch(file('app/api/boletos/pin/route.ts'),/isOpen\(e\)/);
 assert.match(file('app/api/boletos/seats/route.ts'),/e\.access_enabled/);
});
test('server gates reserve and checkout, not just UI',()=>{
 for(const f of ['reserve','checkout'])assert.match(file('app/api/boletos/'+f+'/route.ts'),/ticketingCanPurchase/);
 assert.match(file('lib/ticketing/admin-access.ts'),/ticketing\.can_purchase/);
});
test('Stripe must have webhook signing secret to open checkout',()=>{
 const m=file('lib/ticketing/mode.ts');assert.match(m,/whsec_/);assert.match(m,/STRIPE_TICKETING_LIVE_WEBHOOK_SECRET/);
});
test('webhook accepts TEST and LIVE independently, verifies event mode and refunds late payment',()=>{
 const w=file('app/api/boletos/webhooks/stripe-ticketing/route.ts');
 assert.match(w,/STRIPE_TICKETING_LIVE_WEBHOOK_SECRET/);
 assert.match(w,/STRIPE_TICKETING_WEBHOOK_SECRET/);
 assert.match(w,/stripe\.webhooks\.constructEvent/);
 assert.match(w,/pi\.livemode/);
 assert.match(w,/o\.environment!==config\.environment/);
 assert.match(w,/stripe\.refunds\.create/);
 assert.match(w,/sql\.json\(\{verification:'server_verified'/);
});
test('Live release cancels PaymentIntent before freeing reservation',()=>{
 const r=file('app/api/boletos/release/route.ts');
 assert.doesNotMatch(r,/TEST_ONLY/);
 assert.match(r,/paymentIntents\.cancel/);
 assert.match(r,/PAYMENT_ALREADY_CONFIRMED_OR_PENDING/);
});
test('old public family names endpoint disabled and orders filter by event',()=>{
 assert.match(file('app/api/boletos/families/route.ts'),/DIRECTORY_DISABLED/);
 assert.match(file('app/api/boletos/order/route.ts'),/r\.event_id=\$\{e\.id\}/);
});
test('UI preserves stage, PDF, optional email, family logout, visual seat map',()=>{
 const ui=file('app/boletos/page.tsx');
 for(const value of ['Volver al inicio','no elimina los boletos','ticketingMyTickets','/api/boletos/pdf','/api/boletos/email','PASILLO','ESCENARIO','Cuenta regresiva'])assert.ok(ui.includes(value),value);
});
