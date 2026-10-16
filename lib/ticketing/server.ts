import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/ticketing/db';
export const EVENT_SLUG = process.env.ENABLE_SANDBOX==='true' && process.env.VERCEL_ENV!=='production' ? 'halloween-2026-sandbox' : 'halloween-2026';
export function ip(req: NextRequest): string { return (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 100); }
export function token(req: NextRequest): string { return req.cookies.get('milhano_ticket_family')?.value || ''; }
export async function event() {
  const rows = await sql`select id,title,price_cents,currency,max_per_family,hold_seconds,sales_enabled,opens_at,closes_at,environment, now() as db_now from ticketing.events where slug=${EVENT_SLUG} limit 1`;
  if (!rows.length) throw new Error('EVENT_NOT_CONFIGURED'); return rows[0];
}
export function isOpen(e: Record<string, any>):boolean { const now = new Date(e.db_now).getTime(); return Boolean(e.sales_enabled && e.opens_at && new Date(e.opens_at).getTime()<=now && (!e.closes_at || new Date(e.closes_at).getTime()>now)); }
export function fail(code: string, status=400) { return NextResponse.json({error:code}, {status, headers:{'Cache-Control':'no-store'}}); }
export function safeError(e: unknown) { const msg = e instanceof Error ? e.message : ''; const known=['SALES_CLOSED','SESSION_INVALID','FAMILY_LIMIT','SEAT_UNAVAILABLE','INVALID_SEATS','RATE_LIMITED','IDEMPOTENCY_CONFLICT','RESERVATION_EXPIRED','PROVIDER_MODE_MISMATCH','FAMILY_EVENT_MISMATCH','INVALID_IDEMPOTENCY','ORDER_NOT_FOUND','SANDBOX_ONLY'];return fail(known.find(x=>msg.includes(x)) || 'REQUEST_FAILED',known.some(x=>msg.includes(x))?409:500); }
export async function familyFromToken(t: string):Promise<string> { const rows=await sql`select ticketing.authorize_family(${t}) as family_id`; return String(rows[0].family_id); }
export function sandboxActive():boolean { return process.env.VERCEL_ENV!=='production' && process.env.ENABLE_SANDBOX==='true' && process.env.ENABLE_STRIPE_LIVE!=='true'; }
export function noStoreJson(data:unknown,status=200) { return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
