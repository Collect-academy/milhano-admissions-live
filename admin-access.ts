import 'server-only';
import {sql} from '@/lib/ticketing/db';
import {event} from '@/lib/ticketing/server';

// El control de compras se aplica en el servidor, nunca solamente en la interfaz.
// Esta familia de administración es la única que puede reservar o pagar durante el bloqueo.
export async function ticketingCanPurchase(familyId:string):Promise<boolean>{
 const e=await event();
 const rows=await sql`select 1 from ticketing.families where id=${familyId} and event_id=${e.id} and active=true and label='Familia Admin' and public_code=${'MH-ADMIN-4D5D893684F4'} limit 1`;
 return rows.length>0;
}
