import 'server-only';
import {sql} from '@/lib/ticketing/db';

// Bloqueo por defecto: solo la familia administradora del evento activo puede
// reservar o crear pagos. La comprobacion usa la sesion autorizada del servidor.
export async function ticketingCanPurchase(familyId: string, eventId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from ticketing.families
    where id=${familyId}::uuid
      and event_id=${eventId}::uuid
      and active=true
      and label='Familia Admin'
      and public_code='MH-ADMIN-4D5D893684F4'
    limit 1
  `;
  return rows.length > 0;
}
