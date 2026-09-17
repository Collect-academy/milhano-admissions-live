import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { as26Admin } from "@/lib/after-school/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AS26_SOURCE = "milhano_after_school_2026";

function stripeObjectId(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function registrationIdFromSession(
  session: Stripe.Checkout.Session,
): string | null {
  return (
    session.metadata?.registration_id ||
    session.client_reference_id ||
    null
  );
}

function isAfterSchoolSession(
  session: Stripe.Checkout.Session,
): boolean {
  return session.metadata?.source === AS26_SOURCE;
}

async function confirmPaid(
  session: Stripe.Checkout.Session,
) {
  const registrationId = registrationIdFromSession(session);

  if (!registrationId || !isAfterSchoolSession(session)) {
    return {
      ignored: true,
      reason: "not_as26_checkout",
    };
  }

  // Atomic + idempotent:
  // this is the ONLY operation that changes the registration to `paid`.
  // Workshop availability counts only paid registrations, so capacity
  // is consumed only after this RPC succeeds.
  const { data: paymentResult, error: paymentError } =
    await as26Admin().rpc("as26_confirm_payment", {
      p_registration_id: registrationId,
    });

  if (paymentError) {
    console.error("AS26 Stripe: confirm payment failed", {
      registrationId,
      message: paymentError.message,
    });
    throw paymentError;
  }

  const paidTotalMxn =
    typeof session.amount_total === "number"
      ? session.amount_total / 100
      : null;

  const paymentIntentId = stripeObjectId(
    session.payment_intent as
      | string
      | { id?: string | null }
      | null,
  );

  const customerId = stripeObjectId(
    session.customer as
      | string
      | { id?: string | null }
      | null,
  );

  const update: Record<string, unknown> = {
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };

  if (paidTotalMxn !== null) {
    update.paid_total_mxn = paidTotalMxn;
  }

  const { error: updateError } = await as26Admin()
    .from("as26_registrations")
    .update(update)
    .eq("id", registrationId);

  if (updateError) {
    console.error("AS26 Stripe: Stripe IDs update failed", {
      registrationId,
      message: updateError.message,
    });
    throw updateError;
  }

  revalidateTag("as26-summary", "max");
  revalidateTag("as26-sessions", "max");

  return {
    ignored: false,
    registration_id: registrationId,
    payment: paymentResult,
  };
}

async function markFailed(
  session: Stripe.Checkout.Session,
) {
  const registrationId = registrationIdFromSession(session);

  if (!registrationId || !isAfterSchoolSession(session)) {
    return;
  }

  // Never overwrite a successful payment.
  const { error } = await as26Admin()
    .from("as26_registrations")
    .update({
      payment_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .neq("payment_status", "paid");

  if (error) {
    console.error("AS26 Stripe: failed/expired update failed", {
      registrationId,
      message: error.message,
    });
    throw error;
  }

  revalidateTag("as26-summary", "max");
  revalidateTag("as26-sessions", "max");
}

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error(
      "AS26 Stripe webhook missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET",
    );

    return NextResponse.json(
      {
        received: false,
        error: "Stripe webhook is not configured.",
      },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        received: false,
        error: "Missing Stripe-Signature header.",
      },
      { status: 400 },
    );
  }

  // IMPORTANT: verify Stripe against the untouched raw request body.
  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error: any) {
    console.error(
      "AS26 Stripe webhook signature verification failed",
      error?.message || error,
    );

    return NextResponse.json(
      {
        received: false,
        error: "Invalid Stripe signature.",
      },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        // Immediate methods such as cards are normally `paid` here.
        // Delayed methods wait for async_payment_succeeded.
        if (session.payment_status !== "paid") {
          return NextResponse.json({
            received: true,
            event_id: event.id,
            pending: true,
          });
        }

        const result = await confirmPaid(session);

        return NextResponse.json({
          received: true,
          event_id: event.id,
          ...result,
        });
      }

      case "checkout.session.async_payment_succeeded": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        const result = await confirmPaid(session);

        return NextResponse.json({
          received: true,
          event_id: event.id,
          ...result,
        });
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        await markFailed(session);

        return NextResponse.json({
          received: true,
          event_id: event.id,
          payment_failed: true,
        });
      }

      default:
        return NextResponse.json({
          received: true,
          event_id: event.id,
          ignored: true,
          event_type: event.type,
        });
    }
  } catch (error: any) {
    // HTTP 500 tells Stripe to retry this event.
    console.error("AS26 Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error?.message || String(error),
    });

    return NextResponse.json(
      {
        received: false,
        event_id: event.id,
        error: "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
