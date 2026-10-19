import {NextResponse} from 'next/server';
// Legacy Ticketing webhook is retired. After School uses separate routes and is unaffected.
export async function POST(){return NextResponse.json({error:'LEGACY_TICKETING_WEBHOOK_DISABLED'}, {status:410});}
