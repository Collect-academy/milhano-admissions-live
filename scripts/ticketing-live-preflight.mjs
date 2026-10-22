/** Milhano Halloween 2026 — read-only preflight. Never creates orders, PaymentIntents or charges. */
import postgres from 'postgres';
import Stripe from 'stripe';
const checks=[];
const check=(name,ok,detail='')=>{checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' — '+detail:''}`)};
const mode=process.env.TICKETING_MODE||'test';
check('Master switch is LIVE',mode==='live',mode);
const secret=process.env.STRIPE_TICKETING_LIVE_SECRET_KEY;
const pub=process.env.NEXT_PUBLIC_STRIPE_TICKETING_LIVE_PUBLISHABLE_KEY;
const webhook=process.env.STRIPE_TICKETING_LIVE_WEBHOOK_SECRET;
check('Live key prefixes',Boolean(secret?.startsWith('sk_live_')&&pub?.startsWith('pk_live_')&&webhook?.startsWith('whsec_')));
check('No TEST keys reused',Boolean(!secret||secret!==process.env.STRIPE_TICKETING_SECRET_KEY));
if(!process.env.DATABASE_URL){check('Database URL configured',false)}
else{
 const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:process.env.DATABASE_URL.includes('localhost')?false:'require'});
 try{
  const rows=await sql`select id,slug,environment,sales_enabled,access_enabled,sale_policy,opens_at,closes_at from ticketing.events where slug='halloween-2026'`;
  const ev=rows[0];check('Live event exists with separate environment',ev?.environment==='live');
  if(ev){
   const counts=await sql`select (select count(*) from ticketing.seats where event_id=${ev.id})::int as seats,(select count(*) from ticketing.families where event_id=${ev.id})::int as families,(select count(*) from ticketing.students s join ticketing.families f on f.id=s.family_id where f.event_id=${ev.id})::int as students,(select count(*) from ticketing.reservations where event_id=${ev.id})::int as reservations,(select count(*) from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id where r.event_id=${ev.id})::int as orders`;
   check('210 LIVE seats',counts[0].seats===210,String(counts[0].seats));
   check('68 LIVE families and 83 students',counts[0].families===68&&counts[0].students===83,`${counts[0].families} families/${counts[0].students} students`);
   check('LIVE inventory starts clean',counts[0].reservations===0&&counts[0].orders===0);
   const admins=await sql`select count(*)::int as total from ticketing.families where event_id=${ev.id} and is_ticketing_admin=true`;
   check('One LIVE admin family',admins[0].total===1);
   check('No fake test families in Live',(await sql`select count(*)::int as n from ticketing.families where event_id=${ev.id} and public_code in ('test-team-a','test-team-b')`)[0].n===0);
   const opening='2026-10-23T00:00:00.000Z',closing='2026-10-26T06:00:00.000Z';
   check('Sale window: Mérida Oct 22 18:00 to Oct 26 00:00',new Date(ev.opens_at).toISOString()===opening&&new Date(ev.closes_at).toISOString()===closing);
   check('Read access enabled',ev.access_enabled===true);
   check('Policy allows normal families only during window',ev.sale_policy==='all');
   // 4 hypothetical timestamps: evaluate the same gate predicate WITHOUT toggling DB flags or writing records.
   const scenarios=[
    {at:'2026-10-22T23:59:59Z',admin:false,expect:false},
    {at:'2026-10-22T23:59:59Z',admin:true,expect:true},
    {at:'2026-10-23T00:00:00Z',admin:false,expect:true},
    {at:'2026-10-26T06:00:00Z',admin:false,expect:false},
    {at:'2026-10-26T06:00:00Z',admin:true,expect:false},
   ];
   for(const s of scenarios){
    const at=new Date(s.at),wouldAllow=at<ev.closes_at&&(s.admin||(ev.sale_policy==='all'&&at>=ev.opens_at));
    check(`Clock gate ${s.at} admin=${s.admin}`,wouldAllow===s.expect);
   }
   const guards=await sql`select proname,position('ticketing.can_purchase' in pg_get_functiondef(p.oid))>0 as gated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ticketing' and proname in ('reserve_seats','create_order')`;
   check('DB prevents bypass of UI checkout/hold',guards.length===2&&guards.every(x=>x.gated));
  }
 }catch(e){check('DB preflight query',false,e instanceof Error?e.message:'unknown')}finally{await sql.end()}
}
if(secret?.startsWith('sk_live_')&&webhook?.startsWith('whsec_')){
 try{
  const stripe=new Stripe(secret);
  const account=await stripe.accounts.retrieve();check('Stripe live account reachable',Boolean(account.id),account.id||'');
  const hooks=await stripe.webhookEndpoints.list({limit:100});
  const url='https://milhano-admissions-live.vercel.app/api/boletos/webhooks/stripe-ticketing';
  const required=['payment_intent.succeeded','payment_intent.canceled','payment_intent.payment_failed'];
  const ok=hooks.data.some(h=>h.url===url&&h.status==='enabled'&&(h.enabled_events.includes('*')||required.every(e=>h.enabled_events.includes(e))));
  check('Live webhook endpoint and events registered',ok);
  const payload=JSON.stringify({id:'evt_preflight_local_only',object:'event',livemode:true,type:'payment_intent.succeeded',data:{object:{id:'pi_not_real'}}});
  const header=stripe.webhooks.generateTestHeaderString({payload,secret:webhook});
  const parsed=stripe.webhooks.constructEvent(payload,header,webhook);
  check('Webhook signature check (local synthetic event, not delivered)',parsed.livemode===true);
 }catch(e){check('Stripe read-only health check',false,e instanceof Error?e.message:'unknown')}
}else{check('Stripe read-only health check',false,'Missing LIVE secrets in this environment')}
console.log(`\n${checks.filter(x=>x.ok).length}/${checks.length} checks passed. NO charges or reservations created.`);
if(checks.some(x=>!x.ok))process.exitCode=1;
