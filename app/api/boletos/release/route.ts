import {NextRequest} from 'next/server';
import Stripe from 'stripe';import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {ticketStripeKeys} from '@/lib/ticketing/mode';
import {token,familyFromToken,event,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({reservationId:z.string().uuid()});
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const parsed=Input.safeParse(await req.json());if(!parsed.success)return fail('INVALID_INPUT');
 const e=await event(),family=await familyFromToken(token(req)),id=parsed.data.reservationId;
 const rows=await sql`select r.id,r.status as reservation_status,o.id as order_id,o.status as order_status,o.provider_checkout_id from ticketing.reservations r left join ticketing.orders o on o.reservation_id=r.id where r.id=${id}::uuid and r.family_id=${family}::uuid and r.event_id=${e.id}::uuid`;
 if(!rows.length)return fail('RESERVATION_NOT_FOUND',404);
 const r=rows[0];if(['paid','payment_review'].includes(String(r.reservation_status))||['paid','refund_required','refunded'].includes(String(r.order_status)))return fail('PAYMENT_ALREADY_CONFIRMED_OR_PENDING',409);
 if(r.provider_checkout_id){
  const keys=ticketStripeKeys(),stripe=new Stripe(keys.secret);
  let pi=await stripe.paymentIntents.retrieve(String(r.provider_checkout_id));
  if(pi.livemode!==(keys.mode==='live')||pi.metadata?.order_id!==String(r.order_id)||pi.metadata?.event_slug!==(keys.mode==='live'?'halloween-2026':'halloween-2026-sandbox'))return fail('PAYMENT_INTENT_MISMATCH',409);
  if(['succeeded','processing','requires_capture'].includes(pi.status))return fail('PAYMENT_ALREADY_CONFIRMED_OR_PENDING',409);
  if(pi.status!=='canceled'){try{pi=await stripe.paymentIntents.cancel(pi.id)}catch{return fail('PAYMENT_CANNOT_BE_CANCELLED',409)}}
  // The remote intent is canceled before releasing seats.
  await sql`select ticketing.settle_order(${r.order_id}::uuid,${'manual-cancel-'+pi.id},false,${sql.json({verification:'server_verified',reason:'customer_release',intentId:pi.id})}::jsonb)`;
 }else if(r.order_id){await sql`update ticketing.orders set status='cancelled',updated_at=now() where id=${r.order_id} and status in ('created','open')`}
 await sql`update ticketing.reservations set status='cancelled',updated_at=now() where id=${id}::uuid and status in ('held','checkout_pending')`;
 return noStoreJson({released:true});
}catch(err){console.error('[ticketing/release]',err instanceof Error?err.message:'error');return safeError(err)}}
