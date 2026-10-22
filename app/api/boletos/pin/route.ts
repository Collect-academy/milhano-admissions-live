import {NextRequest} from 'next/server';
import {z} from 'zod';
import {sql} from '@/lib/ticketing/db';
import {event,ip,fail,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({code:z.string().trim().min(8).max(80)});
export async function POST(req:NextRequest){try{
 const e=await event();if(!e.access_enabled)return fail('ACCESS_CLOSED',423);
 const body=Input.safeParse(await req.json());if(!body.success)return fail('INVALID_INPUT');
 const rows=await sql`select session_token,session_expires_at from ticketing.verify_family_code(${e.id}::uuid,${body.data.code},${ip(req)})`;
 if(!rows.length||!rows[0].session_token)return fail('INVALID_CODE_OR_LOCKED',401);
 const response=noStoreJson({ok:true});response.cookies.set('milhano_ticket_family',rows[0].session_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/boletos',maxAge:21600});return response;
}catch(err){console.error('[ticketing/code]',err instanceof Error?err.message:'failed');return fail('INVALID_CODE_OR_LOCKED',401)}}
