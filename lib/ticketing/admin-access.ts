import 'server-only';
import {sql} from '@/lib/ticketing/db';
// Admin flag and time checks are resolved in Postgres using the database clock.
// Reuse this for frontend hint and APIs. reserve_seats/create_order enforce independently.
export async function ticketingCanPurchase(familyId:string,eventId:string):Promise<boolean>{
 const r=await sql`select ticketing.can_purchase(${familyId}::uuid,${eventId}::uuid) as allowed`;
 return r[0]?.allowed===true;
}
