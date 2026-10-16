import {event,isOpen,fail,noStoreJson} from '@/lib/ticketing/server';
import {sql} from '@/lib/ticketing/db';
export const dynamic='force-dynamic';
export async function GET(){try{const e=await event();if(!isOpen(e))return fail('SALES_CLOSED',423);
 const rows=await sql`select id, label from ticketing.families where event_id=${e.id} and active=true order by label asc`;
 return noStoreJson({families:rows});}catch{return fail('REQUEST_FAILED',500)}}
