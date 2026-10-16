import {NextRequest,NextResponse} from 'next/server';import Stripe from 'stripe';import {sql} from '@/lib/ticketing/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const key=process.env.STRIPE_TICKETING_SECRET_KEY,secret=process.env.STRIPE_TICKETING_WEBHOOK_SECRET;
 if(!key?.startsWith('sk_test_')||!secret)return reply({error:'WEBHOOK_NOT_CONFIGURED'},503);
 const signature=req.headers.get('stripe-signature');if(!signature)return reply({error:'MISSING_SIGNATURE'},400);
 const stripe=new Stripe(key);let event:Stripe.Event;
 try{event=stripe.webhooks.constructEvent(await req.text(),signature,secret)}catch{return reply({error:'BAD_SIGNATURE'},400)}
 if(!['payment_intent.succeeded','payment_intent.canceled','payment_intent.payment_failed'].includes(event.type))return reply({received:true,ignored:true});
 const incoming=event.data.object as Stripe.PaymentIntent;
 if(incoming.livemode)return reply({error:'LIVE_DISABLED'},403);
 try{
 const pi=await stripe.paymentIntents.retrieve(incoming.id);
 const orderId=pi.metadata?.order_id;
 if(!orderId||!/^[0-9a-f-]{36}$/i.test(orderId))return reply({error:'ORDER_ID_MISSING'},400);
 const rows=await sql`select o.id,o.amount_cents,o.currency,o.provider,o.provider_checkout_id,e.slug,e.environment from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id join ticketing.events e on e.id=r.event_id where o.id=${orderId}::uuid`;
 const o=rows[0];
 if(!o||o.provider!=='stripe'||o.provider_checkout_id!==pi.id||o.slug!=='halloween-2026-sandbox'||o.environment!=='sandbox'||Number(o.amount_cents)!==pi.amount||String(o.currency).toLowerCase()!==pi.currency||pi.metadata?.event_slug!=='halloween-2026-sandbox')return reply({error:'ORDER_MISMATCH'},400);
 if(event.type==='payment_intent.payment_failed')return reply({received:true,retryAllowed:true});
 const success=pi.status==='succeeded';if(!success&&pi.status!=='canceled')return reply({received:true,pending:true});
 const settled=await sql`select ticketing.settle_order(${orderId}::uuid,${event.id},${success},${JSON.stringify({verification:'server_verified',intentId:pi.id})}::jsonb) as status`;
 return reply({received:true,status:settled[0]?.status});
 }catch(err){console.error('[ticketing/webhook]',err instanceof Error?err.message:'error');return reply({error:'PROCESSING_FAILED'},500)}
}
