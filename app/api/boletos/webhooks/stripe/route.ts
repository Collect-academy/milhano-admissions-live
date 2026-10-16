import {NextRequest} from 'next/server';import Stripe from 'stripe';import {sql} from '@/lib/ticketing/db';import {fail,noStoreJson} from '@/lib/ticketing/server';
export async function POST(req:NextRequest){try{
 if(!process.env.STRIPE_WEBHOOK_SECRET||!process.env.STRIPE_SECRET_KEY||process.env.ENABLE_STRIPE_LIVE!=='true')return fail('STRIPE_DISABLED',503);
 const signature=req.headers.get('stripe-signature');if(!signature)return fail('MISSING_SIGNATURE',400);
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 const evt=stripe.webhooks.constructEvent(await req.text(),signature,process.env.STRIPE_WEBHOOK_SECRET);
 if(evt.type!=='checkout.session.completed'&&evt.type!=='checkout.session.async_payment_succeeded'&&evt.type!=='checkout.session.async_payment_failed')return noStoreJson({received:true,ignored:true});
 const session=evt.data.object as Stripe.Checkout.Session;
 const orderId=session.metadata?.order_id;if(!orderId||!/^[a-f0-9-]{36}$/i.test(orderId))return fail('MISSING_ORDER_ID',400);
 const paid=evt.type==='checkout.session.async_payment_succeeded'||session.payment_status==='paid';
 // Verify against Stripe source, and cross-check DB amount+currency+checkout session before finalizing.
 const liveSession=await stripe.checkout.sessions.retrieve(session.id);
 const rows=await sql`select amount_cents,currency,provider_checkout_id,provider from ticketing.orders where id=${orderId}`;
 if(!rows.length||rows[0].provider!=='stripe'||rows[0].provider_checkout_id!==session.id||Number(rows[0].amount_cents)!==liveSession.amount_total||rows[0].currency.toLowerCase()!==liveSession.currency?.toLowerCase())return fail('ORDER_MISMATCH',400);
 const verified=evt.type==='checkout.session.async_payment_succeeded'||liveSession.payment_status==='paid';
 // Avoid marking a failed session when payment_status is still processing.
 if(!verified&&evt.type!=='checkout.session.async_payment_failed')return noStoreJson({received:true,pending:true});
 const result=await sql`select ticketing.settle_order(${orderId}::uuid,${evt.id},${verified},${JSON.stringify({verification:'server_verified',sessionId:session.id})}::jsonb) as status`;
 return noStoreJson({received:true,status:result[0].status});
}catch{return fail('WEBHOOK_REJECTED',400)}}
