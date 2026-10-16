import {NextResponse} from 'next/server';
export async function POST(){const res=NextResponse.json({ok:true});res.cookies.set('milhano_ticket_family','',{path:'/api/boletos',maxAge:0,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});return res;}
