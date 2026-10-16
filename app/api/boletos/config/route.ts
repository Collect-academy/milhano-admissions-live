import {event,isOpen,noStoreJson} from '@/lib/ticketing/server';
export const dynamic='force-dynamic';
export async function GET(){try { const e=await event(); return noStoreJson({title:e.title,priceCents:e.price_cents,currency:e.currency,open:isOpen(e),opensAt:e.opens_at,serverTime:e.db_now,environment:e.environment,sandboxEnabled:process.env.VERCEL_ENV!=='production' && process.env.ENABLE_SANDBOX==='true' && process.env.ENABLE_STRIPE_LIVE!=='true'}); }catch{return noStoreJson({error:'NOT_CONFIGURED'},503)}}
