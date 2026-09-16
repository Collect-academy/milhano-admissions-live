import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import Stripe from "stripe";

import { as26Admin } from "@/lib/after-school/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const participants = Array.isArray(payload?.students)
      ? payload.students.length
      : 0;

    if (participants < 1 || participants > 4) {
      return NextResponse.json(
        { ok: false, message: "Cantidad de participantes inválida." },
        { status: 400 },
      );
    }

    const { data, error } = await as26Admin().rpc("as26_register_family", {
      p_payload: payload,
    });

    if (error) throw error;

    const registrationId = data?.registration_id;

    if (!registrationId) {
      throw new Error("No se recibió registration_id.");
    }

    // Notificación inicial a n8n:
    // el registro existe, pero todavía está pendiente de pago.
    const hook = process.env.AS26_N8N_SYNC_WEBHOOK;

    if (hook) {
      after(async () => {
        try {
          await fetch(hook, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              registration_id: registrationId,
            }),
            cache: "no-store",
          });
        } catch (error) {
          console.error("AS26 n8n sync notification failed", error);
        }
      });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_AFTERSCHOOL_PRICE_ID;

    if (!secretKey || !priceId) {
      console.error("Stripe environment variables missing");

      revalidateTag("as26-summary", "max");

      return NextResponse.json(
        {
          ...data,
          stripe_client_secret: null,
          payment_error:
            "El registro quedó guardado, pero Stripe no está configurado correctamente.",
        },
        { status: 201 },
      );
    }

    const stripe = new Stripe(secretKey);

    const embed = req.nextUrl.searchParams.get("embed") === "1";

    const returnUrl =
      `${req.nextUrl.origin}/after-school/gracias` +
      `?session_id={CHECKOUT_SESSION_ID}` +
      `&registration_id=${encodeURIComponent(registrationId)}` +
      (embed ? "&embed=1" : "");

    let stripeSession: Stripe.Checkout.Session | null = null;
    let paymentError: string | null = null;

    try {
      stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",

        line_items: [
          {
            price: priceId,
            quantity: participants,
          },
        ],

        customer_email:
          typeof payload?.tutor?.email === "string"
            ? payload.tutor.email
            : undefined,

        client_reference_id: registrationId,

        metadata: {
          registration_id: registrationId,
          source: "milhano_after_school_2026",
          participants: String(participants),
        },

        payment_intent_data: {
          metadata: {
            registration_id: registrationId,
            source: "milhano_after_school_2026",
            participants: String(participants),
          },
        },

        return_url: returnUrl,
        locale: "es",
      });
    } catch (stripeError: any) {
      console.error("AS26 Stripe session creation failed", stripeError);
      paymentError =
        stripeError?.message || "No se pudo iniciar el pago con Stripe.";
    }

    revalidateTag("as26-summary", "max");

    return NextResponse.json(
      {
        ...data,
        stripe_client_secret: stripeSession?.client_secret ?? null,
        stripe_session_id: stripeSession?.id ?? null,
        payment_error: paymentError,
      },
      { status: 201 },
    );
  } catch (error: any) {
    const message = error?.message || "Registration failed";
    const status = String(message).includes("WORKSHOP_FULL") ? 409 : 400;

    return NextResponse.json(
      { ok: false, message },
      { status },
    );
  }
}
