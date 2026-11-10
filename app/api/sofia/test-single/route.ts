import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const TEST_OPPORTUNITY = "4DAoiAeCm5WBc1VtkJFD";
const TEST_CONTACT = "FBZaamMSEDYI15g7LAjR";
const TEST_TABLE = "milhano_ai_dashboard_test_dispatches";
const INDIVIDUAL_FEED = "https://collectacademy.app.n8n.cloud/webhook/milhano-ai-feed-individual-9bf29b585b7f5ea3";
const CONVERSATION = /^conv_[A-Za-z0-9]+$/;

export async function GET() {
  const user = await requireAdmissionsAppUser();
  if (user.role !== "admin") return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from(TEST_TABLE)
    .select("status,provider_status,conversation_id,requested_at,updated_at")
    .eq("ghl_opportunity_id", TEST_OPPORTUNITY).maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo consultar la prueba." }, { status: 503 });
  return NextResponse.json({ opportunity_name: "Manquito Testing", sent: data ?? null });
}

export async function POST(request: Request) {
  const user = await requireAdmissionsAppUser();
  if (user.role !== "admin") return NextResponse.json({ error: "Sólo administradores pueden iniciar la prueba." }, { status: 403 });

  // Require an authenticated same-origin browser action. No arbitrary contact/phone is accepted.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host)
    return NextResponse.json({ error: "Origen de solicitud no autorizado." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "ENVIAR_PRUEBA_MANQUITO")
    return NextResponse.json({ error: "Confirmación de prueba requerida." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: claimed, error: claimError } = await admin.from(TEST_TABLE)
    .insert({
      ghl_opportunity_id: TEST_OPPORTUNITY,
      ghl_contact_id: TEST_CONTACT,
      requested_by: user.id,
      status: "claimed",
    }).select("id,status").single();
  if (claimError || !claimed) {
    // No implicit retry: on uncertainty the first attempt might already have sent permission.
    if (claimError?.code === "23505")
      return NextResponse.json({ error: "Esta oportunidad ya tiene una solicitud de prueba registrada. No se reenviará." }, { status: 409 });
    return NextResponse.json({ error: "No se pudo reservar la prueba; no se enviaron solicitudes desde este endpoint." }, { status: 503 });
  }

  let status: "permission_requested" | "blocked" | "needs_review" = "needs_review";
  let conversationId: string | null = null;
  let providerStatus: string | null = null;
  let errorCode: string | null = null;
  try {
    const response = await fetch(INDIVIDUAL_FEED, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: TEST_CONTACT,
        opportunity_id: TEST_OPPORTUNITY,
        source: "sofia_dashboard_single_test",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      errorCode = "N8N_RESPONSE_HTTP_" + response.status;
    } else {
      const raw = await response.json() as Record<string, unknown>;
      const nested = (raw.webhook_response ?? (raw.result as Record<string, unknown> | undefined)?.webhook_response ?? raw) as Record<string, unknown>;
      providerStatus = typeof nested.status === "string" ? nested.status : "UNKNOWN";
      const id = typeof nested.conversation_id === "string" ? nested.conversation_id : null;
      if (nested.success === true && providerStatus === "DISPATCHED" && id && CONVERSATION.test(id)) {
        status = "permission_requested";
        conversationId = id;
      } else if (nested.success === false && ["BLOCKED", "INVALID_TRIGGER", "DUPLICATE"].includes(providerStatus)) {
        status = "blocked";
        errorCode = "WF03_" + providerStatus;
      } else {
        errorCode = "UNVERIFIED_WF03_RESULT";
      }
    }
  } catch {
    // The HTTP request might have reached n8n. Keep it in review, never retry automatically.
    errorCode = "WF03_NETWORK_OR_TIMEOUT_UNKNOWN";
  }
  const { error: updateError } = await admin.from(TEST_TABLE)
    .update({
      status,
      conversation_id: conversationId,
      provider_status: providerStatus,
      last_error: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimed.id).eq("status", "claimed");
  if (updateError) return NextResponse.json({ error: "Resultado incierto. Consulta n8n antes de cualquier reintento." }, { status: 503 });
  if (status === "permission_requested")
    return NextResponse.json({ ok: true, status, conversation_id: conversationId, message: "ElevenLabs aceptó la solicitud. La llamada dependerá de la autorización de WhatsApp." });
  return NextResponse.json({ ok: false, status, error: status === "blocked"
    ? "GHL o el workflow bloquearon el envío. No se hará otro intento automáticamente."
    : "No se confirmó el envío. Revisa la ejecución en n8n antes de intentar otra vez." }, { status: 409 });
}
