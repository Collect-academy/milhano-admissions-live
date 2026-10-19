import {event,isOpen,noStoreJson} from '@/lib/ticketing/server';
import {ticketMode,ticketStripeKeys} from '@/lib/ticketing/mode';
export const dynamic='force-dynamic';
export async function GET(){try{const e=await event();const mode=ticketMode();let paymentsEnabled=false,publishableKey='';try{const keys=ticketStripeKeys();paymentsEnabled=true;publishableKey=keys.pub}catch{}return noStoreJson({title:e.title,priceCents:e.price_cents,currency:e.currency,open:isOpen(e),opensAt:e.opens_at,serverTime:e.db_now,environment:e.environment,mode,paymentsEnabled,publishableKey,sandboxEnabled:mode==='test'});}catch(err){console.error('[ticketing/config]',err instanceof Error?err.message:'failed');return noStoreJson({error:'NOT_CONFIGURED',message:'Configuración de boletos no disponible'},503)}}
