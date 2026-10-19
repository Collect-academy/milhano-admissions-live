import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';
import {event,isOpen,token,familyFromToken,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const e=await event();if(!isOpen(e))return fail('SALES_CLOSED',423);const family=await familyFromToken(token(req));const valid=await sql`select 1 from ticketing.families where id=${family} and event_id=${e.id} and active=true`;if(!valid.length)return fail('SESSION_INVALID',401);
const seats=await sql`select s.id,s.seat_code as code,s.row_label as row,s.seat_number as number,s.status,
 case when s.status='blocked' then 'blocked' when exists(select 1 from ticketing.reservation_seats rs join ticketing.reservations r on r.id=rs.reservation_id where rs.seat_id=s.id and r.status='paid') then 'paid'
 when exists(select 1 from ticketing.reservation_seats rs join ticketing.reservations r on r.id=rs.reservation_id where rs.seat_id=s.id and (r.status='payment_review' or (r.status in ('held','checkout_pending') and r.expires_at>now()))) then 'held' else 'available' end as availability
 from ticketing.seats s where s.event_id=${e.id} order by s.seat_number`;
 return noStoreJson({seats,serverTime:new Date().toISOString(),priceCents:e.price_cents,maxPerFamily:e.max_per_family});}catch{return fail('SESSION_INVALID',401)}}
