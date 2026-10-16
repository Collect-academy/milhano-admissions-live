import {NextRequest} from 'next/server';
import Stripe from 'stripe';import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {token,familyFromToken,event,sandboxActive,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({reservationId:z.string().uuid()});
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const parsed=Input.safeParse(await req.json());if(!parsed.success)return fail('INVALID_INPUT');
 const e=await event();if(e.environment!=='sandbox'||!sandboxActive())return fail('TEST_ONLY',403);
 const family=await familyFromToken(token(req));const id=parsed.data.reservationId;
 const rows=await sql`select r.id,r.status as reservation_status,o.id as order_id,o.status as order_status,o.provider_checkout_id from ticketing.reservations r left join ticketing.orders o on o.reservation_id=r.id where r.id=${id} and r.family_id=${family} and r.event_id=${e.id}`;
 if(!rows.length)return fail('RESERVATION_NOT_FOUND',404);const r=rows[0];
 if(['paid','payment_review'].includes(String(r.reservation_status))||r.order_status==='paid')return fail('PAYMENT_ALREADY_CONFIRMED_OR_PENDING',409);
 if(r.provider_checkout_id){const key=process.env.STRIPE_TICKETING_SECRET_KEY;if(!key?.startsWith('sk_test_'))return fail('TEST_STRIPE_NOT_CONFIGURED',503);const stripe=new Stripe(key);
 let pi=await stripe.paymentIntents.retrieve(String(r.provider_checkout_id));
 if(pi.status==='succeeded'||pi.status==='processing'||pi.status==='requires_capture')return fail('PAYMENT_ALREADY_CONFIRMED_OR_PENDING',409);
 if(pi.status!=='canceled'){try{pi=await stripe.paymentIntents.cancel(pi.id);}catch{return fail('PAYMENT_CANNOT_BE_CANCELLED',409)}}
 await sql`select ticketing.settle_order(${r.order_id}::uuid,${'manual-cancel-'+pi.id},false,${JSON.stringify({verification:'server_verified',reason:'customer_release'})}::jsonb)`;
 }else if(r.order_id){await sql`update ticketing.orders set status='cancelled',updated_at=now() where id=${r.order_id} and status in ('created','open')`;}
 await sql`update ticketing.reservations set status='cancelled',updated_at=now() where id=${id} and status in ('held','checkout_pending')`;
 return noStoreJson({released:true});
}catch(err){console.error('[ticketing/release]',err instanceof Error?err.message:'error');return safeError(err)}}
