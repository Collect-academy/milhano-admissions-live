import Link from "next/link";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ADMISSIONS_V2_CUTOVER, getAdmissionsV2MetricLeads } from "@/lib/admissions-v2";
import { dateRangeQuery, resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel } from "@/lib/format";

type SearchParams = Record<string, string | string[] | undefined>;
type Scope = "general" | "setter" | "closer";

const labels: Record<string,string> = {
  new_leads: "New Leads",
  unique_contacted_leads: "Contacted",
  responded_leads: "Responded",
  meaningful_conversations: "Meaningful",
  qualified_leads: "Qualified",
  school_tours_booked: "Tour Booked",
  school_tours_attended: "Tour Attended",
  trial_days_booked: "Pasadía Booked",
  trial_days_showed: "Pasadía Attended",
  closed: "Closed",
};

export default async function V2MetricLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const raw = resolveDateRange(params);
  const range: DateRange = { ...raw, start: raw.start < ADMISSIONS_V2_CUTOVER ? ADMISSIONS_V2_CUTOVER : raw.start };
  const metric = Array.isArray(params.metric) ? params.metric[0] : params.metric ?? "new_leads";
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const scope: Scope = rawScope === "setter" || rawScope === "closer" ? rawScope : "general";
  const allLeads = await getAdmissionsV2MetricLeads(metric, range.start, range.end);
  const leads = scope === "general"
    ? allLeads
    : allLeads.filter((lead) => lead.current_pipeline_role === scope);

  return (
    <DashboardLayout
      eyebrow={`Admissions V2 · ${scope === "general" ? "General" : scope === "setter" ? "Setter" : "Closer"}`}
      title={labels[metric] ?? metric}
      subtitle="Opportunities actuales que cumplen este hito dentro del alcance seleccionado."
      statusLabel={`${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <div className="detail-actions"><Link className="secondary-button" href={`/?${dateRangeQuery(range)}`}>← Volver a V2</Link></div>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Lead / alumno</th><th>Contacto</th><th>Owner actual</th><th>Pipeline</th><th>Stage actual</th><th>Source</th><th>Fecha lead</th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.ghl_opportunity_id}>
                  <td><strong>{lead.lead_name}</strong></td>
                  <td>{lead.contact_name ?? "—"}</td>
                  <td>{lead.operational_owner ?? "—"}</td>
                  <td>{lead.current_pipeline_role ?? "—"}</td>
                  <td>{lead.current_stage ?? "—"}</td>
                  <td>{lead.source ?? "—"}</td>
                  <td>{dateLabel(lead.lead_at.slice(0,10))}</td>
                </tr>
              ))}
              {!leads.length ? <tr><td colSpan={7}>Sin opportunities para este hito.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
