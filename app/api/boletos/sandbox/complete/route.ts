import {NextRequest} from 'next/server';import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {sandboxActive,event,token,familyFromToken,fail,safeError,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({orderId:z.string().uuid(),success:z.boolean()});
export async function POST(req:NextRequest){try{if(!sandboxActive() || req.headers.get('x-milhano-sandbox-key')!==process.env.TICKETING_SANDBOX_KEY || !process.env.TICKETING_SANDBOX_KEY)return fail('SANDBOX_DISABLED',403);
 const e=await event();if(e.environment!=='sandbox')return fail('SANDBOX_DISABLED',403);
 const family=await familyFromToken(token(req));const data=Input.safeParse(await req.json());if(!data.success)return fail('INVALID_INPUT');
 const o=await sql`select o.id from ticketing.orders o join ticketing.reservations r on r.id=o.reservation_id where o.id=${data.data.orderId} and r.family_id=${family} and o.provider='sandbox'`;
 if(!o.length)return fail('ORDER_NOT_FOUND',404);
 const result=await sql`select ticketing.sandbox_complete_order(${data.data.orderId}::uuid,${data.data.success}) as status`;
 return noStoreJson({status:result[0].status});
}catch(e){return safeError(e)}}
