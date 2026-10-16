import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';import {sql} from '@/lib/ticketing/db';
import {event,isOpen,ip,fail,noStoreJson} from '@/lib/ticketing/server';
const Input=z.object({familyId:z.string().uuid(),pin:z.string().regex(/^\d{6}$/)});
export async function POST(req:NextRequest){try{const e=await event();if(!isOpen(e))return fail('SALES_CLOSED',423);
const body=Input.safeParse(await req.json());if(!body.success)return fail('INVALID_INPUT');
const rows=await sql`select session_token,session_expires_at from ticketing.verify_family_pin(${body.data.familyId}::uuid,${body.data.pin},${ip(req)})`;
if(!rows.length || !rows[0].session_token)return fail('INVALID_PIN_OR_LOCKED',401);
const response=noStoreJson({ok:true}); response.cookies.set('milhano_ticket_family',rows[0].session_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/boletos',maxAge:1800});return response;
}catch{return fail('REQUEST_FAILED',500)}}
