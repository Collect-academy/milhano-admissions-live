import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sql } from '@/lib/ticketing/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_TICKETING_SECRET_KEY;
  const secret = process.env.STRIPE_TICKETING_WEBHOOK_SECRET;
  // Intentional fail-closed behavior: live charges remain disabled until payment lifecycle is audited.
  if (!key || !secret || !key.startsWith('sk_test_')) return respond({ error: 'TICKETING_TEST_WEBHOOK_NOT_CONFIGURED' }, 503);
  const signature = req.headers.get('stripe-signature');
  if (!signature) return respond({ error: 'MISSING_SIGNATURE' }, 400);
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return respond({ error: 'INVALID_SIGNATURE' }, 400); }

  const handled = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'] as const;
  if (!handled.includes(event.type as typeof handled[number])) return respond({ received: true, ignored: true });
  const incoming = event.data.object as Stripe.Checkout.Session;
  if (incoming.livemode) return respond({ error: 'LIVE_PAYMENTS_DISABLED' }, 403);
  const orderId = incoming.metadata?.order_id;
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return respond({ error: 'MISSING_ORDER_ID' }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(incoming.id);
    if (session.livemode) return respond({ error: 'LIVE_PAYMENTS_DISABLED' }, 403);
    const rows = await sql`
      select o.id, o.amount_cents, o.currency, o.provider_checkout_id, o.provider,
             e.slug, e.environment
      from ticketing.orders o
      join ticketing.reservations r on r.id = o.reservation_id
      join ticketing.events e on e.id = r.event_id
      where o.id = ${orderId}::uuid limit 1`;
    const order = rows[0];
    if (!order || order.provider !== 'stripe' || order.environment !== 'sandbox' ||
        order.slug !== 'halloween-2026-sandbox' || order.provider_checkout_id !== session.id ||
        Number(order.amount_cents) !== session.amount_total ||
        String(order.currency).toLowerCase() !== String(session.currency).toLowerCase() ||
        session.metadata?.order_id !== orderId) return respond({ error: 'ORDER_MISMATCH' }, 400);

    const paid = session.payment_status === 'paid';
    if (!paid && event.type !== 'checkout.session.async_payment_failed') {
      return respond({ received: true, pending: true });
    }
    const settled = await sql`
      select ticketing.settle_order(${orderId}::uuid, ${event.id}, ${paid},
        ${JSON.stringify({ verification: 'server_verified', sessionId: session.id })}::jsonb) as status`;
    return respond({ received: true, status: settled[0]?.status });
  } catch (err) {
    console.error('[ticketing/stripe-webhook] Retryable verification/settlement failure', err instanceof Error ? err.message : 'unknown');
    return respond({ error: 'PROCESSING_FAILED' }, 500);
  }
}
