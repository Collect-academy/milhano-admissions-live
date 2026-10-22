import {ticketingCanPurchase} from '@/lib/ticketing/admin-access';
import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';import {token,familyFromToken,event,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const e=await event();const family=await familyFromToken(token(req));
 const f=await sql`select label from ticketing.families where id=${family}::uuid and event_id=${e.id}::uuid and active=true`;
 if(!f.length)return fail('SESSION_INVALID',401);
 const children=await sql`select display_name from ticketing.students where family_id=${family}::uuid and eligible=true order by display_name`;
 const paid=await sql`select distinct s.seat_number,s.seat_code from ticketing.reservations r join ticketing.reservation_seats rs on rs.reservation_id=r.id join ticketing.seats s on s.id=rs.seat_id where r.family_id=${family}::uuid and r.event_id=${e.id}::uuid and r.status='paid' order by s.seat_number`;
 const canPurchase=await ticketingCanPurchase(family,String(e.id));
 return noStoreJson({canPurchase,label:f[0].label,students:children.map(x=>x.display_name),purchasedCount:paid.length,purchasedSeats:paid.map(x=>x.seat_number)});
}catch{return fail('SESSION_INVALID',401)}}
