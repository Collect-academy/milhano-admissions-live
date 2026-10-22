import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';import {event,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const ref=req.nextUrl.searchParams.get('ref')||'';if(!/^[a-f0-9]{64}$/.test(ref))return fail('INVALID_REFERENCE',400);
 const e=await event();const rows=await sql`select * from ticketing.lookup_confirmation(${ref})`;if(!rows.length)return fail('NOT_FOUND',404);const owned=await sql`select 1 from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id where o.id=${rows[0].order_id}::uuid and r.event_id=${e.id}::uuid and o.status='paid' limit 1`;if(!owned.length)return fail('NOT_FOUND',404);
 return noStoreJson({orderId:rows[0].order_id,seats:rows[0].seat_codes,amountCents:rows[0].amount_cents,paidAt:rows[0].paid_at});
}catch{return fail('REQUEST_FAILED',500)}}
