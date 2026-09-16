import { NextResponse } from "next/server";

import { requireAdmissionsAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function callN8n(baseUrl: string, key: string, source: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("key", key);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n respondió ${response.status}: ${text.slice(0, 220)}`);
  }

  return text.slice(0, 1200);
}

export async function POST() {
  await requireAdmissionsAppUser();

  const refreshUrl = process.env.MILHANO_N8N_REFRESH_WEBHOOK_URL?.trim();
  const reconciliationUrl = process.env.MILHANO_N8N_RECONCILIATION_WEBHOOK_URL?.trim();
  const key = process.env.MILHANO_N8N_REFRESH_KEY?.trim();

  const missing = [
    !refreshUrl ? "MILHANO_N8N_REFRESH_WEBHOOK_URL" : null,
    !reconciliationUrl ? "MILHANO_N8N_RECONCILIATION_WEBHOOK_URL" : null,
    !key ? "MILHANO_N8N_REFRESH_KEY" : null,
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        message: `Falta configurar en este deployment: ${missing.join(", ")}. Haz Redeploy después de guardar las variables.`,
      },
      { status: 503 },
    );
  }

  const startedAt = Date.now();

  const [activityResult, opportunitiesResult] = await Promise.allSettled([
    callN8n(refreshUrl!, key!, "milhano-dashboard-v19-activity"),
    callN8n(reconciliationUrl!, key!, "milhano-dashboard-v19-opportunities"),
  ]);

  const errors = [
    activityResult.status === "rejected" ? `Actividad: ${activityResult.reason?.message ?? "error"}` : null,
    opportunitiesResult.status === "rejected" ? `Opportunities: ${opportunitiesResult.reason?.message ?? "error"}` : null,
  ].filter(Boolean);

  if (errors.length) {
    return NextResponse.json(
      {
        ok: false,
        message: errors.join(" · "),
        duration_ms: Date.now() - startedAt,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "GHL actualizado: opportunities, citas, llamadas y mensajes.",
    duration_ms: Date.now() - startedAt,
    activity: activityResult.status === "fulfilled" ? activityResult.value : null,
    opportunities: opportunitiesResult.status === "fulfilled" ? opportunitiesResult.value : null,
  });
}
