import Link from "next/link";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ADMISSIONS_V2_CUTOVER, getAdmissionsV2MetricLeads } from "@/lib/admissions-v2";
import { dateRangeQuery, resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { formatMeridaDateTime, opportunityOperationalDate } from "@/lib/operational-date";

type SearchParams = Record<string, string | string[] | undefined>;
type Scope = "general" | "setter" | "closer";

function metricLabel(metric: string, locale: "en" | "es") {
  const labels: Record<string, [string, string]> = {
    new_leads: ["New Leads", "Nuevos Leads"],
    unique_contacted_leads: ["Contacted", "Contactados"],
    responded_leads: ["Responded", "Respondieron"],
    meaningful_conversations: ["Meaningful", "Conversación Significativa"],
    qualified_leads: ["Qualified", "Calificados"],
    school_tours_booked: ["Tour Booked", "Tour Agendado"],
    school_tours_attended: ["Tour Attended", "Tour Asistido"],
    trial_days_booked: ["Pasadía Booked", "Pasadía Agendada"],
    trial_days_showed: ["Pasadía Attended", "Pasadía Asistida"],
    closed: ["Closed", "Inscritos / Closed"],
    no_answer: ["No Answer", "No Answer"],
    disqualified: ["Disqualified", "Descalificados"],
  };
  const pair = labels[metric] ?? [metric, metric];
  return locale === "es" ? pair[1] : pair[0];
}

export default async function V2MetricLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locale = await getDashboardLocale();
  const raw = resolveDateRange(params);
  const range: DateRange = { ...raw, start: raw.start < ADMISSIONS_V2_CUTOVER ? ADMISSIONS_V2_CUTOVER : raw.start };
  const metric = Array.isArray(params.metric) ? params.metric[0] : params.metric ?? "new_leads";
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const scope: Scope = rawScope === "setter" || rawScope === "closer" ? rawScope : "general";
  const leads = await getAdmissionsV2MetricLeads(metric, scope, range.start, range.end);

  return (
    <DashboardLayout
      eyebrow={`Admissions V2 · ${scope === "general" ? "General" : scope === "setter" ? "Setter" : "Closer"}`}
      title={metricLabel(metric, locale)}
      subtitle={tr(locale,
        "Opportunities included in this milestone under the selected cascade logic.",
        "Opportunities incluidas en este hito según la lógica de la cascada seleccionada.")}
      statusLabel={`${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <div className="detail-actions">
        <Link className="secondary-button" href={`/?${dateRangeQuery(range)}`}>
          ← {tr(locale, "Back to V2", "Volver a V2")}
        </Link>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr(locale, "Lead / student", "Lead / alumno")}</th>
                <th>{tr(locale, "Contact", "Contacto")}</th>
                <th>{tr(locale, "Current owner", "Owner actual")}</th>
                <th>Pipeline</th>
                <th>{tr(locale, "Current stage", "Stage actual")}</th>
                <th>{tr(locale, "Status", "Estatus")}</th>
                <th>Source</th>
                <th>{tr(locale, "Opportunity created (Mérida)", "Opportunity creada (Mérida)")}</th>
                <th>{tr(locale, "Opportunity cycle", "Ciclo de opportunity")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.ghl_opportunity_id}>
                  <td><Link className="table-primary-link" href={`/leads/${encodeURIComponent(lead.ghl_opportunity_id)}`}><strong>{lead.lead_name}</strong></Link></td>
                  <td>{lead.contact_name ?? "—"}</td>
                  <td>{lead.operational_owner ?? "—"}</td>
                  <td>{lead.pipeline_name ?? lead.current_pipeline_role ?? "—"}</td>
                  <td>{lead.current_stage ?? "—"}</td>
                  <td>{lead.opportunity_status ?? "—"}{lead.lost_reason ? ` · ${lead.lost_reason}` : ""}</td>
                  <td>{lead.source ?? "—"}</td>
                  <td>{formatMeridaDateTime(lead.lead_at, locale)}</td>
                  <td>{dateLabel(opportunityOperationalDate(lead.lead_at) ?? lead.lead_at.slice(0, 10))}</td>
                </tr>
              ))}
              {!leads.length ? (
                <tr><td colSpan={9}>{tr(locale, "No opportunities for this milestone.", "Sin opportunities para este hito.")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
