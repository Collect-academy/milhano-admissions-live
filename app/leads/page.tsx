import Link from "next/link";
import { ArrowLeft, MessageSquareText, Search } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { getCascadeLeads } from "@/lib/cascade";
import { resolveDateRange } from "@/lib/date-range";
import { dateTimeLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import {
  attendanceLabel,
  cascadeMetricLabel,
  stageLabel,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getDashboardLocale();
  const range = resolveDateRange(params);
  const metric = first(params.metric) || "school_tours_attended";
  const query = first(params.q).toLowerCase();
  const rows = await getCascadeLeads(metric, range);
  const appointmentMetrics = new Set([
    "school_tours_booked",
    "school_tours_attended",
    "school_tours_today",
    "trial_days_booked",
    "trial_days_showed",
  ]);
  const communicationMetrics = new Set([
    "unique_contacted_leads",
    "responded_leads",
    "meaningful_conversations",
    "number_of_dials",
  ]);
  const evidenceLabel = appointmentMetrics.has(metric)
    ? "GHL Appointment"
    : communicationMetrics.has(metric)
      ? "GHL Communication"
      : "GHL CRM";
  const filtered = query
    ? rows.filter((row) =>
        [
          row.lead_name,
          row.phone,
          row.email,
          row.current_stage,
          row.objection_summary,
          row.school_tour_notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : rows;

  return (
    <DashboardLayout
      eyebrow="GHL / SYSTEM"
      title={cascadeMetricLabel(metric, locale)}
      subtitle={tr(locale, "System-evidence drill-down for the selected GHL metric. These rows do not come from manual EOD totals.", "Detalle de evidencia del sistema para la métrica GHL seleccionada. Estas filas no provienen de los totales manuales del EOD.")}
      statusLabel={`${number(filtered.length)} ${tr(locale, "lead rows", "leads")}`}
    >
      <Link className="secondary-button inline-back-link" href="/">
        <ArrowLeft size={16} />
        {tr(locale, "Back to Summary", "Volver al Resumen")}
      </Link>

      <DateRangeFilter
        basePath="/leads"
        preserve={{ metric, q: first(params.q) }}
        range={range}
        locale={locale}
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{range.label}</p>
            <h2>{cascadeMetricLabel(metric, locale)}</h2>
          </div>
          <form className="lead-search-form" method="get">
            <input name="metric" type="hidden" value={metric} />
            <input name="range" type="hidden" value={range.key} />
            {range.key === "custom" ? (
              <>
                <input name="from" type="hidden" value={range.start} />
                <input name="to" type="hidden" value={range.end} />
              </>
            ) : null}
            <Search size={16} />
            <input
              defaultValue={first(params.q)}
              name="q"
              placeholder={tr(locale, "Search name, phone, notes or objection", "Buscar nombre, teléfono, notas u objeción")}
            />
          </form>
        </div>

        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>{tr(locale, "Current Stage", "Stage Actual")}</th>
                  <th>{tr(locale, "Evidence", "Evidencia")}</th>
                  <th>{tr(locale, "Activity", "Actividad")}</th>
                  <th>{appointmentMetrics.has(metric) ? tr(locale, "Appointment", "Cita") : "School Tour"}</th>
                  <th>{tr(locale, "Objection", "Objeción")}</th>
                  <th>{tr(locale, "Notes", "Notas")}</th>
                  <th>{tr(locale, "Owner", "Asesora")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr key={`${row.ghl_opportunity_id ?? row.ghl_contact_id}-${index}`}>
                    <td>
                      {row.ghl_opportunity_id ? (
                        <Link
                          className="lead-name-link"
                          href={`/leads/${encodeURIComponent(row.ghl_opportunity_id)}`}
                        >
                          {row.lead_name}
                        </Link>
                      ) : (
                        <strong>{row.lead_name}</strong>
                      )}
                      <span className="secondary-cell">
                        {row.phone ?? row.email ?? tr(locale, "No contact data", "Sin datos de contacto")}
                      </span>
                    </td>
                    <td>{stageLabel(row.current_stage, locale)}</td>
                    <td><span className="source-ambiguity-badge ghl-evidence-badge">{evidenceLabel}</span></td>
                    <td>
                      {dateTimeLabel(row.activity_at)}
                      {row.activity_count > 1 ? (
                        <span className="secondary-cell">
                          {number(row.activity_count)} {tr(locale, "events", "eventos")}
                        </span>
                      ) : null}
                    </td>
                    <td>{attendanceLabel(row.attendance_status, locale)}</td>
                    <td>
                      {row.has_objection
                        ? row.objection_summary ?? tr(locale, "Objection recorded", "Objeción registrada")
                        : tr(locale, "None recorded", "Ninguna registrada")}
                    </td>
                    <td>
                      {row.school_tour_notes ? (
                        <span className="notes-preview">
                          <MessageSquareText size={14} />
                          {row.school_tour_notes}
                        </span>
                      ) : (
                        row.historical_comments ?? "—"
                      )}
                    </td>
                    <td>{row.operational_owner ?? tr(locale, "Unassigned", "Sin asignar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={tr(locale, "No leads match this scorecard and period.", "No hay leads que coincidan con este scorecard y periodo.")} />
        )}
      </section>
    </DashboardLayout>
  );
}
