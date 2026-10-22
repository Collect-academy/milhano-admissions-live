import {ticketingCanPurchase} from '@/lib/ticketing/admin-access';
import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';import {token,familyFromToken,event,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const e=await event();const family=await familyFromToken(token(req));
 const f=await sql`select label,is_ticketing_admin from ticketing.families where id=${family}::uuid and event_id=${e.id}::uuid and active=true`;
 if(!f.length)return fail('SESSION_INVALID',401);
 const isAdmin=f[0].is_ticketing_admin===true;
 const masked=e.environment==='live'&&!isAdmin&&(!e.opens_at||new Date(e.db_now).getTime()<new Date(e.opens_at).getTime());
 const children=await sql`select display_name from ticketing.students where family_id=${family}::uuid and eligible=true order by display_name`;
 const paid=masked?[]:await sql`select distinct s.seat_number,s.seat_code from ticketing.reservations r join ticketing.reservation_seats rs on rs.reservation_id=r.id join ticketing.seats s on s.id=rs.seat_id where r.family_id=${family}::uuid and r.event_id=${e.id}::uuid and r.status='paid' order by s.seat_number`;
 const canPurchase=await ticketingCanPurchase(family,String(e.id));
 const cap=isAdmin?await sql`select count(*)::integer as n from ticketing.seats where event_id=${e.id}::uuid and status='available'`:null;
 const maxPerFamily=isAdmin?Number(cap?.[0]?.n||0):Number(e.max_per_family);
 return noStoreJson({canPurchase,isAdmin,masked,maxPerFamily,label:f[0].label,students:children.map(x=>x.display_name),purchasedCount:paid.length,purchasedSeats:paid.map(x=>x.seat_number)});
}catch{return fail('SESSION_INVALID',401)}}
