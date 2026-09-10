import { NextResponse } from "next/server";

import { requireAdmissionsAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await requireAdmissionsAppUser();

  const baseUrl = process.env.MILHANO_N8N_REFRESH_WEBHOOK_URL;
  const key = process.env.MILHANO_N8N_REFRESH_KEY;

  if (!baseUrl || !key) {
    return NextResponse.json(
      { ok: false, message: "Falta configurar el webhook de actualización en Vercel." },
      { status: 503 },
    );
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("key", key);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "milhano-dashboard-v2" }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: `n8n respondió ${response.status}: ${text.slice(0, 160)}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, message: "Datos actualizados", n8n: text.slice(0, 800) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo contactar n8n." },
      { status: 502 },
    );
  }
}
