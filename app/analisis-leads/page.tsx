import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { LeadTimingLab } from "@/components/lead-timing-lab";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { dateRangeParams, resolveDateRange } from "@/lib/date-range";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { formatMeridaDateTime } from "@/lib/operational-date";
import { durationMinutes, dhm, TIMING_METRICS, type TimingMetricKey, type TimingV3Row } from "@/lib/timing-v3-metrics";
import { requireAdmissionsAppUser } from "@/lib/auth";
import "./timing-v3.css";

type SearchParams = Record<string,string|string[]|undefined>;
const PAGE_SIZE = 50;
const one=(s:string|string[]|undefined)=>Array.isArray(s)?s[0]??"":s??"";
const safe=(s:string)=>s.trim().slice(0,130);
const metricFor=(s:string):TimingMetricKey=>TIMING_METRICS.some(m=>m.key===s)?s as TimingMetricKey:"first_management";

export const dynamic="force-dynamic";
export default async function LeadAnalysisIndex({searchParams}:{searchParams:Promise<SearchParams>}){
  const [params,locale] = await Promise.all([searchParams,getDashboardLocale()]);
  await requireAdmissionsAppUser();
  const range=resolveDateRange(params);
  const scope=["setter","closer"].includes(one(params.scope))?one(params.scope):"general";
  const stage=safe(one(params.stage));
  const owner=safe(one(params.owner));
  const status=["open","won","lost","abandoned"].includes(one(params.status))?one(params.status):"";
  const mode=one(params.mode)==="event"?"event":"cohort";
  const stageMode=one(params.stage_mode)==="historical"?"historical":"current";
  const quality=["exact","estimated","missing","invalid"].includes(one(params.quality))?one(params.quality):"all";
  const keyword=safe(one(params.q)).toLowerCase();
  const metric=metricFor(one(params.metric));
  const requestedPage=Number(one(params.page) || "1");
  const page=Math.max(1,Number.isSafeInteger(requestedPage)?Math.min(10000,requestedPage):1);
  const supabase=createSupabaseAdmin();
  const [result,optionsResult]=await Promise.all([
    supabase.rpc("milhano_get_timing_analytics_v3",{
      p_start:range.start,p_end:range.end,p_scope:scope,p_stage:stage||null,
      p_owner:owner||null,p_status:status||null,p_mode:mode,p_stage_mode:stageMode,
    }),
    supabase.from("milhano_opportunities").select("current_stage,assigned_user,historical_advisor").gte("created_at","2026-09-01T00:00:00Z").order("created_at",{ascending:false}).limit(1000),
  ]);
  if(result.error)throw new Error(`Timing V3 read model failed: ${result.error.message}`);
  const all=(result.data??[]) as unknown as TimingV3Row[];
  const filtered=all.filter(r=>{
    if(keyword && !`${r.lead_name} ${r.ghl_opportunity_id} ${r.owner_name}`.toLowerCase().includes(keyword))return false;
    const negative=(r.school_tour_booked_at && r.school_tour_scheduled_at && durationMinutes(r.school_tour_booked_at,r.school_tour_scheduled_at)===null)
      ||(r.trial_day_booked_at && r.trial_day_scheduled_at && durationMinutes(r.trial_day_booked_at,r.trial_day_scheduled_at)===null);
    if(quality==="invalid")return Boolean(negative);
    if(quality==="exact")return r.first_management_source==="manual_outbound";
    if(quality==="estimated")return r.first_management_source==="appointment_created"||r.first_management_source==="stage_change";
    if(quality==="missing")return !r.first_management_at;
    return true;
  });
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const visiblePage=Math.min(page,totalPages);
  const pageRows=filtered.slice((visiblePage-1)*PAGE_SIZE,visiblePage*PAGE_SIZE);
  const options=optionsResult.data??[];
  const stageOptions=[...new Set([...options.map(r=>r.current_stage).filter((x):x is string=>Boolean(x)),...(stage?[stage]:[])])].sort((a,b)=>a.localeCompare(b,"es"));
  const ownerOptions=[...new Set([...options.map(r=>r.assigned_user?.trim()||r.historical_advisor?.trim()||"Sin asignar"),...(owner?[owner]:[])])].sort((a,b)=>a.localeCompare(b,"es"));
  const preserve={scope,stage:stage||undefined,owner:owner||undefined,status:status||undefined,mode,stage_mode:stageMode,quality:quality!=="all"?quality:undefined,metric,q:keyword||undefined};
  const queryForPage=(next:number)=>{
    const q=new URLSearchParams({...dateRangeParams(range),...Object.fromEntries(Object.entries(preserve).filter((e):e is [string,string]=>Boolean(e[1]))),page:String(next)});
    return `/analisis-leads?${q.toString()}`;
  };
  return <DashboardLayout eyebrow="ADMISSIONS · ANÁLISIS INDEPENDIENTE V3"
    title={tr(locale,"Lead timing analysis","Análisis de tiempos por lead")}
    subtitle={tr(locale,"CRM activity, stage dwell times, tour / trial-day attendance and statistical exploration.","Gestión CRM, tiempos por etapa, asistencia a citas y exploración estadística.")}
    statusLabel={`${filtered.length} opportunities · ${range.start} – ${range.end}`}>
    <div className="detail-actions"><Link className="secondary-button" href={`/?${new URLSearchParams(dateRangeParams(range))}`}>← {tr(locale,"Back to V2","Volver a V2")}</Link><span className="panel-note">Solo lectura · No altera V2, EOD ni Agentes</span></div>
    <DateRangeFilter basePath="/analisis-leads" range={range} locale={locale} preserve={preserve}/>
    <section className="panel timing-v3-filter-shell">
      <div className="timing-v3-heading"><div><h2>Filtros de investigación</h2><p className="panel-note">Aplican a la tabla y a todos los gráficos. Las citas programadas se analizan por fecha real (Mérida). Esta vista usa fecha calendario; no modifica ni replica el corte operativo 2:30 p. m. de los KPIs oficiales V2.</p></div></div>
      <form action="/analisis-leads" method="get" className="timing-v3-filter-form">
        {Object.entries(dateRangeParams(range)).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
        <label>Fecha de referencia<select name="mode" defaultValue={mode}><option value="cohort">Cohorte: ingreso del lead</option><option value="event">Eventos del periodo</option></select></label>
        <label>Pipeline<select name="scope" defaultValue={scope}><option value="general">Todos</option><option value="setter">Setter</option><option value="closer">Closer</option></select></label>
        <label>Stage<select name="stage" defaultValue={stage}><option value="">Todos</option>{stageOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Filtro de stage<select name="stage_mode" defaultValue={stageMode}><option value="current">Stage actual</option><option value="historical">Pasó por este stage</option></select></label>
        <label>Owner<select name="owner" defaultValue={owner}><option value="">Todos</option>{ownerOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Resultado de opp<select name="status" defaultValue={status}><option value="">Todos</option><option value="open">Open</option><option value="lost">Lost</option><option value="won">Won</option><option value="abandoned">Abandoned</option></select></label>
        <label>Calidad de evidencia<select name="quality" defaultValue={quality}><option value="all">Todas</option><option value="exact">Comunicación manual registrada</option><option value="estimated">Gestión indirecta ≤</option><option value="missing">Sin evidencia</option><option value="invalid">Cita con fechas inconsistentes</option></select></label>
        <label>Buscar lead<input name="q" defaultValue={keyword} placeholder="Nombre o ID"/></label>
        <input type="hidden" name="metric" value={metric}/>
        <button className="date-custom-button" type="submit">Aplicar filtros</button>
        <Link className="secondary-button" href={`/analisis-leads?${new URLSearchParams(dateRangeParams(range))}`}>Limpiar</Link>
      </form>
    </section>
    <section className="panel">
      <div className="timing-v3-heading"><div><h2>Opportunities del periodo</h2><p className="panel-note">50 por página · Ordenadas por fecha de ingreso descendente · Entradas iniciales de stage excluidas de los intervalos.</p></div><strong>{filtered.length} leads · Página {visiblePage}/{totalPages}</strong></div>
      <div className="table-scroll"><table><thead><tr><th>Lead / alumno</th><th>Ingresó (Mérida)</th><th>Stage / Owner</th><th>Primera gestión</th><th>Seguimientos D2/D3</th><th>ST (fecha prevista)</th><th>Pasadía (fecha prevista)</th><th>Resultado</th></tr></thead><tbody>
        {pageRows.map(r=><tr key={r.ghl_opportunity_id}>
          <td><Link className="table-primary-link" href={`/analisis-leads/${encodeURIComponent(r.ghl_opportunity_id)}`}><strong>{r.lead_name}</strong></Link>{r.contact_opportunity_count>1?<small style={{display:"block"}}>Contacto compartido</small>:null}</td>
          <td>{formatMeridaDateTime(r.lead_at,locale)}</td>
          <td>{r.current_stage||"—"}<small style={{display:"block",opacity:.65}}>{r.owner_name} · {r.pipeline_role}</small></td>
          <td><strong>{r.first_management_at?`${r.first_management_source==="manual_outbound"?"":"≤ "}${dhm(durationMinutes(r.lead_at,r.first_management_at))}`:"Sin evidencia"}</strong></td>
          <td>{r.real_stage_followup_count??0}</td>
          <td>{formatMeridaDateTime(r.school_tour_scheduled_at,locale)}<small style={{display:"block"}}>{r.school_tour_status||"—"}</small></td>
          <td>{formatMeridaDateTime(r.trial_day_scheduled_at,locale)}<small style={{display:"block"}}>{r.trial_day_status||"—"}</small></td>
          <td>{r.opportunity_status||"—"}</td>
        </tr>)}
        {!pageRows.length?<tr><td colSpan={8}>No hay opportunities con estos filtros.</td></tr>:null}
      </tbody></table></div>
      <div className="detail-actions" style={{justifyContent:"space-between",marginTop:14}}><span className="panel-note">{filtered.length?`${(visiblePage-1)*PAGE_SIZE+1}–${Math.min(visiblePage*PAGE_SIZE,filtered.length)} de ${filtered.length}`:"0 resultados"}</span><div className="detail-actions">{visiblePage>1?<Link className="secondary-button" href={queryForPage(visiblePage-1)}>← Anterior</Link>:null}{visiblePage<totalPages?<Link className="secondary-button" href={queryForPage(visiblePage+1)}>Siguiente →</Link>:null}</div></div>
    </section>
    <LeadTimingLab rows={filtered} locale={locale} metric={metric} start={range.start} end={range.end} mode={mode}/>
  </DashboardLayout>;
}
