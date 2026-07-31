import { NextRequest } from "next/server";

import { resolveDateRange } from "@/lib/date-range";
import { getPipelineOperationalData } from "@/lib/data";
import type { PipelineFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const filters: PipelineFilters = {
    q: params.get("q") ?? undefined,
    stage: params.get("stage") ?? undefined,
    owner: params.get("owner") ?? undefined,
    source: params.get("source") ?? undefined,
    status: params.get("status") ?? undefined,
    inactivity: params.get("inactivity") ?? undefined,
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };

  const range = resolveDateRange(
    Object.fromEntries(params.entries()),
  );
  const data = await getPipelineOperationalData(
    filters,
    range,
    false,
  );

  const headers = [
    "Opportunity ID",
    "Opportunity",
    "Contacto",
    "Alumno",
    "Teléfono",
    "Email",
    "Etapa",
    "Status",
    "Asesora",
    "Fuente",
    "Grado de interés",
    "Nivel",
    "Ciclo",
    "Prioridad",
    "Fecha original del lead",
    "Creado",
    "Actualizado",
    "Días sin actualizar",
  ];

  const rows = data.rows.map((row) => [
    row.ghl_opportunity_id,
    row.opportunity_name,
    row.contact_name,
    row.student_name,
    row.phone,
    row.email,
    row.current_stage,
    row.status,
    row.operational_owner,
    row.source,
    row.grade_interest,
    row.level,
    row.school_cycle,
    row.priority,
    row.original_lead_date,
    row.created_at,
    row.updated_at,
    row.days_since_update,
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
  }).format(new Date());

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="milhano-pipeline-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
