import {NextRequest} from 'next/server';import {sql} from '@/lib/ticketing/db';
import {token,familyFromToken,fail,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const family=await familyFromToken(token(req));const reservationId=req.nextUrl.searchParams.get('reservationId');if(!reservationId||!/^[0-9a-f-]{36}$/i.test(reservationId))return fail('INVALID_INPUT');
const rows=await sql`select r.id,r.status,r.expires_at,o.id as order_id,o.status as order_status,o.amount_cents from ticketing.reservations r left join ticketing.orders o on o.reservation_id=r.id where r.id=${reservationId} and r.family_id=${family}`;
if(!rows.length)return fail('NOT_FOUND',404);return noStoreJson(rows[0]);}catch{return fail('SESSION_INVALID',401)}}
