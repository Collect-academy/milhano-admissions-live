import "./sofia.css";
import Link from "next/link";
import { Activity, ArrowRight, Clock3, Coins, MessageCircle, PhoneCall, ShieldAlert, Target, Users, CalendarClock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getSofiaAnalytics } from "@/lib/sofia-analytics";
import { SofiaPerformanceCharts } from "@/components/sofia-performance-charts";

export const dynamic = "force-dynamic";

const number = (n: number) => new Intl.NumberFormat("es-MX", {maximumFractionDigits: 1}).format(n);
const percent = (a: number, b: number) => b > 0 ? number((a / b) * 100) + "%" : "—";

export default async function SofiaPerformancePage() {
  const data = await getSofiaAnalytics();
  const total = (key: "calls_captured" | "human_answers" | "meaningful_conversations" | "qualified" | "booked_verified" | "disqualified" | "callback_requested" | "unresolved_connections") =>
    data.daily.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  const attempts = total("calls_captured");
  const answers = total("human_answers");
  const meaningful = total("meaningful_conversations");
  const qualified = total("qualified");
  const booked = total("booked_verified");
  const disqualified = total("disqualified");
  const credits = data.daily.reduce((sum, row) => sum + Number(row.credits_consumed ?? 0), 0);
  const timed = data.daily.reduce((sum, row) => sum + Number(row.conversation_seconds ?? 0), 0);
  const latencies=[...data.firstCallLatencies].sort((a,b)=>a-b);
  const medianLag=latencies.length ? latencies[Math.floor((latencies.length-1)/2)] : null;
  const kpis = [
    { label: "Llamadas registradas", value: number(attempts), detail: "Eventos nuevos de Sofía", icon: PhoneCall },
    { label: "Contactos que respondieron", value: number(answers), detail: percent(answers, attempts) + " de llamadas", icon: Users },
    { label: "Conversaciones útiles", value: number(meaningful), detail: percent(meaningful, answers) + " de respuestas", icon: MessageCircle },
    { label: "Leads calificados", value: number(qualified), detail: percent(qualified, meaningful) + " de conversaciones útiles", icon: Target },
    { label: "Visitas verificadas", value: number(booked), detail: percent(booked, answers) + " de respuestas", icon: CalendarClock },
    { label: "Descalificados", value: number(disqualified), detail: "Motivos detallados abajo", icon: ShieldAlert },
    { label: "Créditos registrados", value: credits > 0 ? number(credits) : "—", detail: credits > 0 ? number(credits / Math.max(1, attempts)) + " por llamada" : "Sin consumo verificado", icon: Coins },
    { label: "Tiempo de conversación", value: timed ? number(timed / 60) + " min" : "—", detail: "Duración total registrada", icon: Clock3 },
    { label: "Primera llamada de IA", value: medianLag===null ? "—" : number(medianLag)+" h", detail: "Mediana desde creación de oportunidad", icon: Clock3 },
  ];
  return <DashboardLayout
    eyebrow="Sofía IA · Analítica"
    title="Rendimiento de Sofía"
    subtitle="Indicadores operativos, productividad, consumo y razones de calificación. No mezcla datos con agentes humanos."
    statusLabel="Fuente: llamadas registradas en Supabase"
  >
    <div className="sofia-top-actions">
      <Link className="secondary-button" href="/">← V2 Summary</Link>
      <Link className="primary-button" href="/sofia/campanas">Planificar campañas <ArrowRight size={15}/></Link>
    </div>
    <div className="sofia-kpis">
      {kpis.map(k => <article className="sofia-kpi" key={k.label}>
        <div className="sofia-kpi-label"><k.icon size={17}/><span>{k.label}</span></div>
        <strong>{k.value}</strong><small>{k.detail}</small>
      </article>)}
    </div>
    <SofiaPerformanceCharts daily={data.daily} hourly={data.hourly} disqualificationReasons={data.disqualificationReasons} objections={data.objections}/>
    <div className="sofia-two-cols">
      <section className="panel">
        <div className="sofia-panel-title"><h2>Control de calidad</h2><Activity size={18}/></div>
        <p className="subtitle">Distingue errores, llamadas sin respuesta y conversación útil; no atribuimos los errores del sistema a los leads.</p>
        <div className="sofia-metric-line"><span>Sin respuesta confirmada</span><strong>{number(data.daily.reduce((sum,x)=>sum+Number(x.confirmed_no_answers??0),0))}</strong></div>
        <div className="sofia-metric-line"><span>Resultado incierto o falla</span><strong>{number(total("unresolved_connections"))}</strong></div>
        <div className="sofia-metric-line"><span>Solicitudes de devolución de llamada</span><strong>{number(total("callback_requested"))}</strong></div>
        <div className="sofia-metric-line"><span>Créditos proyectados para 100 llamadas</span><strong>{credits > 0 && attempts > 0 ? number(credits / attempts * 100) : "Sin base suficiente"}</strong></div>
      </section>
      <section className="panel">
        <div className="sofia-panel-title"><h2>Últimas conversaciones</h2><Link href="/sofia/campanas">Ver campañas</Link></div>
        {data.calls.length===0 ? <p className="subtitle">Aún no se han incorporado llamadas al nuevo módulo. No se muestran cifras ficticias.</p> :
          <div className="sofia-scroll"><table className="sofia-table"><thead><tr><th>Fecha</th><th>Resultado</th><th>Créditos</th><th>Detalles</th></tr></thead>
          <tbody>{data.calls.slice(0,20).map(c=><tr key={c.conversation_id}>
            <td>{c.started_at ? new Date(c.started_at).toLocaleString("es-MX",{timeZone:"America/Merida",dateStyle:"short",timeStyle:"short"}) : "—"}</td>
            <td>{c.call_outcome ?? c.connection_outcome}</td><td>{c.credits_consumed == null?"—":number(c.credits_consumed)}</td>
            <td><details><summary>Ver datos</summary><p>{c.transcript_summary ?? "Sin resumen"}</p><p>Objeciones: {JSON.stringify(c.objections ?? [])}</p><p>Variables: {JSON.stringify(c.collected_variables ?? {})}</p></details></td>
          </tr>)}</tbody></table></div>}
      </section>
    </div>
    <p className="sofia-caveat">Las tasas corresponden a eventos de Sofía registrados en este módulo, no a todo el historial de llamadas de Milhano. Los créditos y resultados sólo aparecen si ElevenLabs los reportó y fueron capturados. Las reservas requieren confirmación en GHL.</p>
  </DashboardLayout>;
}
