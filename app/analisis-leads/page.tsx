import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { elapsed, getLeadTimingRows } from "@/lib/lead-timing";
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
  const timings = await getLeadTimingRows((leads ?? []).map((item) => item.ghl_opportunity_id));
  const byId = new Map(timings.map((row) => [row.ghl_opportunity_id, row]));
  const totalPages = Math.max(1,Math.ceil((count ?? 0) / PAGE_SIZE));

  return <DashboardLayout
    eyebrow="Admissions V2 · Timing"
    title={tr(locale,"Lead timing analysis","Análisis de tiempos por lead")}
    subtitle={tr(locale,"Actual GHL events · 20 opportunities per page · Mérida time","Eventos reales de GHL · 20 oportunidades por página · horario Mérida")}
    statusLabel={`${count ?? 0} opportunities`}
  >
    <div className="detail-actions"><Link className="secondary-button" href="/">← {tr(locale,"Back to dashboard","Volver al dashboard")}</Link></div>
    <section className="panel">
      <p className="panel-note">{tr(locale,"First attempt = first non-automated outgoing call or WhatsApp. Response = incoming message or connected call. Call follow-ups exclude the first unanswered outbound attempt. Some appointments share the same GHL contact.","Primer intento = primera llamada o WhatsApp saliente no automatizado. Respuesta = mensaje entrante o llamada contestada. Los seguimientos telefónicos excluyen el primer intento sin respuesta. Algunas citas comparten contacto en GHL.")}</p>
      <div className="table-scroll"><table><thead><tr>
        <th>Lead / alumno</th><th>{tr(locale,"Created","Ingresó")}</th>
        <th>{tr(locale,"First human attempt","1er intento humano")}</th><th>{tr(locale,"First response","1a respuesta")}</th>
        <th>{tr(locale,"Unanswered call follow-ups","Seguimientos sin respuesta")}</th>
        <th>School Tour</th><th>Pasadía</th><th>Closing</th>
      </tr></thead><tbody>
        {(leads ?? []).map((lead) => {
          const row = byId.get(lead.ghl_opportunity_id);
          return <tr key={lead.ghl_opportunity_id}>
            <td><Link className="table-primary-link" href={`/analisis-leads/${encodeURIComponent(lead.ghl_opportunity_id)}`}><strong>{lead.student_name || lead.opportunity_name || lead.contact_name || "Lead"}</strong></Link><small style={{display:"block"}}>{lead.current_stage || "—"}</small></td>
            <td>{formatMeridaDateTime(lead.created_at,locale)}</td>
            <td><strong>{elapsed(row?.lead_at,row?.first_human_attempt_at)}</strong></td>
            <td>{elapsed(row?.lead_at,row?.first_response_at)}</td>
            <td>{row ? `${row.unanswered_call_followups} / ${row.no_answer_stage_followups} stages` : "—"}</td>
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
