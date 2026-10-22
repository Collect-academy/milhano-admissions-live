import {NextRequest,NextResponse} from 'next/server';
import Stripe from 'stripe';import {sql} from '@/lib/ticketing/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const signature=req.headers.get('stripe-signature');if(!signature)return reply({error:'MISSING_SIGNATURE'},400);
 const body=await req.text();
 const configs=[
  {mode:'test',key:process.env.STRIPE_TICKETING_SECRET_KEY,secret:process.env.STRIPE_TICKETING_WEBHOOK_SECRET,slug:'halloween-2026-sandbox',environment:'sandbox'},
  {mode:'live',key:process.env.STRIPE_TICKETING_LIVE_SECRET_KEY,secret:process.env.STRIPE_TICKETING_LIVE_WEBHOOK_SECRET,slug:'halloween-2026',environment:'live'},
 ] as const;
 let verified:{stripe:Stripe,event:Stripe.Event,config:(typeof configs)[number]}|null=null;
 for(const config of configs){
  if(!config.key?.startsWith(config.mode==='live'?'sk_live_':'sk_test_')||!config.secret?.startsWith('whsec_'))continue;
  const stripe=new Stripe(config.key);
  try{const stripeEvent=stripe.webhooks.constructEvent(body,signature,config.secret);if(stripeEvent.livemode===(config.mode==='live')){verified={stripe,event:stripeEvent,config};break}}catch{}
 }
 if(!verified)return reply({error:'BAD_SIGNATURE_OR_WEBHOOK_NOT_CONFIGURED'},400);
 const {stripe,event,config}=verified;
 if(!['payment_intent.succeeded','payment_intent.canceled','payment_intent.payment_failed'].includes(event.type))return reply({received:true,ignored:true});
 const incoming=event.data.object as Stripe.PaymentIntent;
 if(incoming.livemode!==(config.mode==='live'))return reply({error:'EVENT_MODE_MISMATCH'},400);
 try{
  const pi=await stripe.paymentIntents.retrieve(incoming.id),orderId=pi.metadata?.order_id;
  if(pi.livemode!==(config.mode==='live')||!orderId||!/^[0-9a-f-]{36}$/i.test(orderId))return reply({error:'ORDER_ID_MISSING_OR_MODE_MISMATCH'},400);
  const rows=await sql`select o.id,o.amount_cents,o.currency,o.provider,o.provider_checkout_id,e.slug,e.environment from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id join ticketing.events e on e.id=r.event_id where o.id=${orderId}::uuid`;
  const o=rows[0];
  if(!o||o.provider!=='stripe'||o.provider_checkout_id!==pi.id||o.slug!==config.slug||o.environment!==config.environment||Number(o.amount_cents)!==pi.amount||String(o.currency).toLowerCase()!==pi.currency||pi.metadata?.event_slug!==config.slug)return reply({error:'ORDER_MISMATCH'},400);
  if(event.type==='payment_intent.payment_failed')return reply({received:true,retryAllowed:true});
  const success=pi.status==='succeeded';if(!success&&pi.status!=='canceled')return reply({received:true,pending:true});
  const settled=await sql`select ticketing.settle_order(${orderId}::uuid,${event.id},${success},${sql.json({verification:'server_verified',intentId:pi.id,mode:config.mode,stripeEventCreated:event.created})}::jsonb) as status`;
  const state=String(settled[0]?.status||'');
  if(success&&state==='refund_required'){
   try{
    // Stripe idempotency ensures webhook retries never refund twice.
    const refund=await stripe.refunds.create({payment_intent:pi.id,reason:'requested_by_customer'},{idempotencyKey:'milhano-ticketing-late-refund-'+orderId});
    if(refund.status==='succeeded'){
     await sql`update ticketing.orders set status='refunded',updated_at=now() where id=${orderId}::uuid and status='refund_required'`;
     await sql`insert into ticketing.audit_log(event_id,family_id,reservation_id,action,details)
       select r.event_id,r.family_id,r.id,'late_payment_auto_refund',${sql.json({refundId:refund.id,status:refund.status})}::jsonb
       from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id where o.id=${orderId}::uuid`;
     return reply({received:true,status:'refunded'});
    }
    console.error('[ticketing/webhook] refund needs reconciliation',refund.id,refund.status);
    return reply({received:true,status:'refund_required',refundStatus:refund.status});
   }catch(error){console.error('[ticketing/webhook] refund creation failed',error instanceof Error?error.message:'unknown');return reply({error:'REFUND_RETRY_REQUIRED'},500)}
  }
  return reply({received:true,status:state});
 }catch(err){console.error('[ticketing/webhook]',err instanceof Error?err.message:'error');return reply({error:'PROCESSING_FAILED'},500)}
}
