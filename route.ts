import {ticketingCanPurchase} from '@/lib/ticketing/admin-access';
import {NextRequest} from 'next/server';import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {event,token,familyFromToken,ip,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({seatIds:z.array(z.string().uuid()).min(1).max(20),idempotencyKey:z.string().min(12).max(128)});
export async function POST(req:NextRequest){let requestedSeats:string[]=[];try{const parsed=Input.safeParse(await req.json());if(!parsed.success)return fail('INVALID_INPUT');const e=await event();
 const familyId=await familyFromToken(token(req));if(!await ticketingCanPurchase(familyId))return fail('PURCHASES_ADMIN_ONLY',403);
 const arr=parsed.data.seatIds;requestedSeats=arr;
 const row=await sql`select ticketing.reserve_seats(${token(req)},${e.id}::uuid,${arr}::uuid[],${parsed.data.idempotencyKey},${ip(req)}) as id`;
 const reservationId=row[0].id;
 const r=await sql`select id,expires_at,status from ticketing.reservations where id=${reservationId}`;
 return noStoreJson({reservation:r[0]});
}catch(e){
 const message=e instanceof Error?e.message:'';
 if(message.includes('SEAT_UNAVAILABLE')){
   try{
     if(requestedSeats.length){
       const rows=await sql`select s.id,s.seat_code from ticketing.seats s where s.id in ${sql(requestedSeats)} and (s.status='blocked' or exists(select 1 from ticketing.reservation_seats rs join ticketing.reservations r on r.id=rs.reservation_id where rs.seat_id=s.id and (r.status in ('paid','payment_review') or (r.status in ('held','checkout_pending') and r.expires_at>now())))) order by s.seat_number`;
       const codes=rows.map(r=>r.seat_code);
       return noStoreJson({error:'SEAT_UNAVAILABLE',conflictingSeats:codes,message:codes.length?`Los asientos ${codes.join(', ')} de tu selección ya han sido apartados por alguien más, intenta con otros asientos.`:'Algunos asientos ya fueron apartados. Actualiza tu selección.'},409);
     }
   }catch{}
 }
 return safeError(e);
}}
