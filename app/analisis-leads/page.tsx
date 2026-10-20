import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { elapsed, getLeadTimingRows, getManagementEvidenceRows, managementElapsed } from "@/lib/lead-timing";
import { formatMeridaDateTime } from "@/lib/operational-date";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

type SearchParams = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 20;

export default async function LeadAnalysisIndex({ searchParams }: {searchParams: Promise<SearchParams>}) {
  const params = await searchParams;
  const locale = await getDashboardLocale();
  const pageParam = Number(Array.isArray(params.page) ? params.page[0] : params.page ?? "1");
  const page = Number.isSafeInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam,10000) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const supabase = createSupabaseAdmin();
  const { data: leads, count, error } = await supabase
    .from("milhano_opportunities")
    .select("ghl_opportunity_id,opportunity_name,student_name,contact_name,current_stage,created_at", { count: "exact" })
    .gte("created_at", "2026-09-01T00:00:00Z")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`Unable to list opportunities: ${error.message}`);
  const ids = (leads ?? []).map((item) => item.ghl_opportunity_id);
  const [timings, management] = await Promise.all([
    getLeadTimingRows(ids), getManagementEvidenceRows(ids),
  ]);
  const byId = new Map(timings.map((row) => [row.ghl_opportunity_id, row]));
  const evidenceById = new Map(management.map((row) => [row.ghl_opportunity_id, row]));
  const totalPages = Math.max(1,Math.ceil((count ?? 0) / PAGE_SIZE));

  return <DashboardLayout
    eyebrow="Admissions V2 · Timing"
    title={tr(locale,"Lead timing analysis","Análisis de tiempos por lead")}
    subtitle={tr(locale,"GHL events and first observable management · 20 per page · Mérida","Eventos GHL y primera gestión detectable · 20 por página · Mérida")}
    statusLabel={`${count ?? 0} opportunities`}
  >
    <div className="detail-actions"><Link className="secondary-button" href="/">← {tr(locale,"Back to dashboard","Volver al dashboard")}</Link></div>
    <section className="panel">
      <p className="panel-note">{tr(locale,"First management uses actual stage transitions, appointment booking, or manual outbound communications. ≤ means the action may have occurred earlier. Initial imported stages and automated WhatsApp replies are not human contact.","Primera gestión basada en movimientos reales de stage, agendamiento o mensajes manuales. ≤ significa que el contacto pudo ocurrir antes. No se cuentan stages iniciales importados ni respuestas automáticas como contacto humano.")}</p>
      <div className="table-scroll"><table><thead><tr>
        <th>Lead / alumno</th><th>{tr(locale,"Created","Ingresó")}</th>
        <th>{tr(locale,"First management evidence","Primera gestión detectable")}</th><th>{tr(locale,"First commercial progress","Primer avance comercial")}</th>
        <th>{tr(locale,"Registered outbound calls / No Answer follow-ups","Llamadas GHL / Seguimientos Day2/3")}</th>
        <th>School Tour</th><th>Pasadía</th><th>Closing</th>
      </tr></thead><tbody>
        {(leads ?? []).map((lead) => {
          const row = byId.get(lead.ghl_opportunity_id);
          const evidence = evidenceById.get(lead.ghl_opportunity_id);
          return <tr key={lead.ghl_opportunity_id}>
            <td><Link className="table-primary-link" href={`/analisis-leads/${encodeURIComponent(lead.ghl_opportunity_id)}`}><strong>{lead.student_name || lead.opportunity_name || lead.contact_name || "Lead"}</strong></Link><small style={{display:"block"}}>{lead.current_stage || "—"}</small></td>
            <td>{formatMeridaDateTime(lead.created_at,locale)}</td>
            <td><strong>{managementElapsed(row?.lead_at ?? lead.created_at,evidence)}</strong><small style={{display:"block",opacity:0.7}}>{evidence?.first_management_source === "stage_change" ? "Stage" : evidence?.first_management_source === "appointment_created" ? "Cita (límite superior)" : evidence?.first_management_source === "manual_outbound" ? "Manual" : "—"}</small></td>
            <td>{elapsed(row?.lead_at ?? lead.created_at,evidence?.first_commercial_progress_at)}</td>
            <td>{row ? `${row.manual_call_attempts} / ${evidence?.real_stage_followup_count ?? 0} stages` : "—"}</td>
            <td>{formatMeridaDateTime(row?.school_tour_scheduled_at,locale)}</td>
            <td>{formatMeridaDateTime(row?.trial_day_scheduled_at,locale)}</td>
            <td>{formatMeridaDateTime(row?.closed_at,locale)}</td>
          </tr>;
        })}
        {!leads?.length ? <tr><td colSpan={8}>Sin leads en esta página.</td></tr> : null}
      </tbody></table></div>
      <div className="detail-actions" style={{marginTop:16,justifyContent:"space-between"}}>
        <span>{tr(locale,"Page","Página")} {page} / {totalPages}</span>
        <span style={{display:"flex",gap:12}}>
          {page > 1 ? <Link className="secondary-button" href={`/analisis-leads?page=${page-1}`}>← {tr(locale,"Previous","Anterior")}</Link> : null}
          {page < totalPages ? <Link className="secondary-button" href={`/analisis-leads?page=${page+1}`}>{tr(locale,"Next","Siguiente")} →</Link> : null}
        </span>
      </div>
    </section>
  </DashboardLayout>;
}
