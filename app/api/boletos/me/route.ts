import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';import {token,familyFromToken,event,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const family=await familyFromToken(token(req));const e=await event();const f=await sql`select label from ticketing.families where id=${family} and event_id=${e.id}`;if(!f.length)return fail('NOT_FOUND',404);
 const children=await sql`select display_name from ticketing.students where family_id=${family} and eligible=true order by display_name`;
 const paid=await sql`select distinct s.seat_number,s.seat_code from ticketing.reservations r join ticketing.reservation_seats rs on rs.reservation_id=r.id join ticketing.seats s on s.id=rs.seat_id where r.family_id=${family} and r.event_id=${e.id} and r.status='paid' order by s.seat_number`;
 return noStoreJson({label:f[0].label,students:children.map(x=>x.display_name),purchasedCount:paid.length,purchasedSeats:paid.map(x=>x.seat_number)});
}catch{return fail('SESSION_INVALID',401)}}
