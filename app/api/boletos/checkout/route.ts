import {NextRequest} from 'next/server';
import Stripe from 'stripe';
import {z} from 'zod';
import {sql} from '@/lib/ticketing/db';
import {token,familyFromToken,event,sandboxActive,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({reservationId:z.string().uuid()});
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const parsed=Input.safeParse(await req.json());if(!parsed.success)return fail('INVALID_INPUT');
 const e=await event();if(e.environment!=='sandbox'||!sandboxActive())return fail('TICKETING_TEST_ONLY',403);
 const key=process.env.STRIPE_TICKETING_SECRET_KEY;if(!key?.startsWith('sk_test_'))return fail('TEST_STRIPE_NOT_CONFIGURED',503);
 const family=await familyFromToken(token(req));const id=parsed.data.reservationId;
 const reservation=await sql`select id,expires_at,status from ticketing.reservations where id=${id} and family_id=${family} and event_id=${e.id}`;
 if(!reservation.length)return fail('RESERVATION_NOT_FOUND',404);
 if(!['held','checkout_pending'].includes(String(reservation[0].status)) || new Date(reservation[0].expires_at).getTime()<=Date.now()+30000)return fail('RESERVATION_EXPIRED',409);
 // DB function creates an idempotent sandbox order. It is converted to a Stripe TEST order only for this test event.
 const newOrder=await sql`select ticketing.create_order(${token(req)},${id}::uuid,'sandbox') as id`;
 const orderId=String(newOrder[0].id);
 const updated=await sql`update ticketing.orders set provider='stripe',updated_at=now() where id=${orderId} and provider='sandbox' and provider_checkout_id is null returning id`;
 const orders=await sql`select id,provider,status,amount_cents,currency,provider_checkout_id,checkout_expires_at from ticketing.orders where id=${orderId}`;
 const o=orders[0];if(!o||o.provider!=='stripe'||!['created','open'].includes(String(o.status)))return fail('ORDER_NOT_PAYABLE',409);
 const stripe=new Stripe(key);
 let intent:Stripe.PaymentIntent;
 if(o.provider_checkout_id){intent=await stripe.paymentIntents.retrieve(String(o.provider_checkout_id));}
 else{
  intent=await stripe.paymentIntents.create({amount:Number(o.amount_cents),currency:String(o.currency).toLowerCase(),payment_method_types:['card'],metadata:{order_id:orderId,event_slug:'halloween-2026-sandbox'},description:'Milhano Halloween 2026 — Boletos de prueba'}, {idempotencyKey:'milhano-ticketing-pi-'+orderId});
  await sql`update ticketing.orders set provider_checkout_id=${intent.id},status='open',updated_at=now() where id=${orderId} and provider_checkout_id is null`;
 }
 if(intent.livemode||intent.status==='succeeded'||intent.status==='canceled'||!intent.client_secret)return fail('PAYMENT_INTENT_UNAVAILABLE',409);
 return noStoreJson({orderId,clientSecret:intent.client_secret,expiresAt:o.checkout_expires_at,amountCents:o.amount_cents});
}catch(err){console.error('[ticketing/checkout]',err instanceof Error?err.message:'error');return safeError(err)}}
