import {NextRequest} from 'next/server';import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {event,token,ip,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({seatIds:z.array(z.string().uuid()).min(1).max(20),idempotencyKey:z.string().min(12).max(128)});
export async function POST(req:NextRequest){try{const parsed=Input.safeParse(await req.json());if(!parsed.success)return fail('INVALID_INPUT');const e=await event();
 const arr=parsed.data.seatIds;
 const row=await sql`select ticketing.reserve_seats(${token(req)},${e.id}::uuid,${arr}::uuid[],${parsed.data.idempotencyKey},${ip(req)}) as id`;
 const reservationId=row[0].id;
 const r=await sql`select id,expires_at,status from ticketing.reservations where id=${reservationId}`;
 return noStoreJson({reservation:r[0]});
}catch(e){return safeError(e)}}
