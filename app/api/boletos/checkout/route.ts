import {NextRequest} from 'next/server';import {z} from 'zod';import Stripe from 'stripe';
import {sql} from '@/lib/ticketing/db';import {token,familyFromToken,event,sandboxActive,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({reservationId:z.string().uuid()});
export async function POST(req:NextRequest){try{
 const data=Input.safeParse(await req.json());if(!data.success)return fail('INVALID_INPUT');
 const family=await familyFromToken(token(req));const e=await event();
 const provider=e.environment==='sandbox'?'sandbox':'stripe';
 if(provider==='sandbox'&&!sandboxActive())return fail('SANDBOX_DISABLED',403);
 if(provider==='stripe'&&process.env.ENABLE_STRIPE_LIVE!=='true')return fail('STRIPE_NOT_ENABLED',503);
 const r=await sql`select r.id,r.family_id,r.expires_at,r.status from ticketing.reservations r where r.id=${data.data.reservationId}`;
 if(!r.length||String(r[0].family_id)!==family)return fail('RESERVATION_NOT_FOUND',404);
 const rows=await sql`select ticketing.create_order(${token(req)},${data.data.reservationId}::uuid,${provider}) as id`;
 const oid=rows[0].id;const orders=await sql`select id,amount_cents,currency,provider_checkout_id,checkout_expires_at,status from ticketing.orders where id=${oid}`;const order=orders[0];
 if(provider==='sandbox')return noStoreJson({orderId:oid,mode:'sandbox',amountCents:order.amount_cents});
 if(!process.env.STRIPE_SECRET_KEY)return fail('STRIPE_NOT_CONFIGURED',503);
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 // Checkout must be allowed to expire BEFORE the DB hold is released; 30-minute Stripe hosted minimum makes 3-min hard holds unsafe.
 // This endpoint deliberately fails closed until expiry reconciliation worker is implemented and approved.
 return fail('STRIPE_CHECKOUT_PENDING_EXPIRY_RECONCILIATION',503);
}catch(e){return safeError(e)}}
