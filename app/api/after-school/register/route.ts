import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import Stripe from "stripe";

import { as26Admin } from "@/lib/after-school/supabase-admin";

export const runtime = "nodejs";

function normalizeWhatsappPhone(
  raw: unknown,
  dialCode: unknown,
) {
  const value = typeof raw === "string" ? raw.trim() : "";
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  if (value.startsWith("+")) {
    return `+${digits}`;
  }

  if (value.startsWith("00")) {
    return `+${digits.replace(/^00/, "")}`;
  }

  const dialDigits =
    typeof dialCode === "string"
      ? dialCode.replace(/\D/g, "")
      : "52";

  if (digits.startsWith(dialDigits) && digits.length > 10) {
    return `+${digits}`;
  }

  return `+${dialDigits}${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.json();

    const participants = Array.isArray(incoming?.students)
      ? incoming.students.length
      : 0;

    if (participants < 1 || participants > 4) {
      return NextResponse.json(
        { ok: false, message: "Cantidad de participantes inválida." },
        { status: 400 },
      );
    }

    const tutorName =
      typeof incoming?.tutor?.name === "string"
        ? incoming.tutor.name.trim()
        : "";

    const tutorEmail =
      typeof incoming?.tutor?.email === "string"
        ? incoming.tutor.email.trim().toLowerCase()
        : "";

    const tutorPhone = normalizeWhatsappPhone(
      incoming?.tutor?.phone,
      incoming?.tutor?.phone_dial_code,
    );

    const phoneDigits = tutorPhone.replace(/\D/g, "");

    if (
      !tutorName ||
      !tutorEmail ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15
    ) {
      return NextResponse.json(
        { ok: false, message: "Revisa los datos del tutor responsable." },
        { status: 400 },
      );
    }

    const students = incoming.students.map((student: any, index: number) => ({
      ...student,
      student_index: index + 1,
      age: Number(student?.age),
      workshop_ids: Array.isArray(student?.workshop_ids)
        ? Array.from(
            new Set(
              student.workshop_ids
                .filter((value: unknown) => typeof value === "string")
                .map((value: string) => value.trim())
                .filter(Boolean),
            ),
          )
        : [],
    }));

    if (students.some((student: any) => student.workshop_ids.length === 0)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Selecciona al menos un taller para cada alumno.",
        },
        { status: 400 },
      );
    }

    const payload = {
      ...incoming,
      tutor: {
        ...incoming.tutor,
        name: tutorName,
        phone: tutorPhone,
        email: tutorEmail,
      },
      students,
    };

    const { data, error } = await as26Admin().rpc("as26_register_family", {
      p_payload: payload,
    });

    if (error) throw error;

    const registrationId = data?.registration_id;

    if (!registrationId) {
      throw new Error("No se recibió registration_id.");
    }

    // Initial n8n notification. `ghl_contact` intentionally uses only
    // GoHighLevel core Contact fields: name, phone and email.
    // Extra fields are additive, so the existing workflow can continue
    // consuming registration_id while the Upsert Tutor node is updated.
    const hook = process.env.AS26_N8N_SYNC_WEBHOOK;

    if (hook) {
      after(async () => {
        try {
          await fetch(hook, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              registration_id: registrationId,
              ghl_contact: {
                name: tutorName,
                phone: tutorPhone,
                email: tutorEmail,
              },
              students: students.map((student: any) => ({
                student_index: student.student_index,
                name: student.name,
                workshop_ids: student.workshop_ids,
              })),
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

        customer_email: tutorEmail,

        client_reference_id: registrationId,

        metadata: {
          registration_id: registrationId,
          source: "milhano_after_school_2026",
          participants: String(participants),
          offer: "week_pass_all_workshops",
        },

        payment_intent_data: {
          metadata: {
            registration_id: registrationId,
            source: "milhano_after_school_2026",
            participants: String(participants),
            offer: "week_pass_all_workshops",
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
