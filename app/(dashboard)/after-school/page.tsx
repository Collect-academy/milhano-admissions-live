import { getSummary, getSessions } from '@/lib/after-school/queries'
import Link from 'next/link'

export const revalidate = 15

const mxn = (n:number) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0)

export default async function AfterSchoolPage() {
  const [s,sessions] = await Promise.all([getSummary(), getSessions()])
  const upcoming = sessions.slice(0,6)

  return <>
    <div className="asKpis">
      <div className="asCard"><div className="asKpiLabel">Participantes registrados</div><div className="asKpiValue">{s.registered_students}</div><div className="asKpiMeta">{s.families} familias</div></div>
      <div className="asCard"><div className="asKpiLabel">Ingreso esperado</div><div className="asKpiValue">{mxn(s.expected_revenue)}</div><div className="asKpiMeta">Stripe pendiente de integración</div></div>
      <div className="asCard"><div className="asKpiLabel">Workshops confirmados</div><div className="asKpiValue">{s.confirmed_seats}</div><div className="asKpiMeta">{s.needs_attention} requieren atención</div></div>
      <div className="asCard"><div className="asKpiLabel">Asistencia actual</div><div className="asKpiValue">{s.attendance_rate}%</div><div className="asKpiMeta">Histórico 56% · objetivo pagado 70–80%</div></div>
    </div>

    <div className="asGrid2">
      <div className="asCard">
        <h3 style={{marginTop:0}}>Estado operativo</h3>
        <p><b>{s.payment_pending_orders}</b> registros en pago pendiente</p>
        <p><b>{s.fully_allocated}</b> alumnos con asignación completa</p>
        <p><b>{s.continue_interest}</b> con interés en continuar</p>
        <p><b>{s.school_tour_interest}</b> con interés en School Tour</p>
      </div>
      <div className="asCard">
        <h3 style={{marginTop:0}}>Regla de capacidad</h3>
        <div className="asNotice"><b>20 lugares vendidos por sesión.</b><br/>El dashboard muestra registrados, asistencia real y una proyección operativa al 75% para preparar materiales.</div>
      </div>
    </div>


    <div className="asGrid2">
      <div className="asCard">
        <h3 style={{marginTop:0}}>Flujo de alumnos</h3>
        {(s.stage_counts||[]).length===0 ? <span className="asSub">Sin oportunidades aún.</span> :
          (s.stage_counts||[]).map((x:any)=><div key={x.stage} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #eee'}}><span>{x.stage}</span><b>{x.count}</b></div>)
        }
      </div>
      <div className="asCard">
        <h3 style={{marginTop:0}}>Distribución por grado</h3>
        {(s.grade_breakdown||[]).length===0 ? <span className="asSub">Sin registros aún.</span> :
          (s.grade_breakdown||[]).slice(0,10).map((x:any)=><div key={x.grade} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #eee'}}><span>{x.grade}</span><b>{x.count}</b></div>)
        }
      </div>
    </div>

    <div className="asCard">
      <h3 style={{marginTop:0}}>Demanda por workshop</h3>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {(s.workshop_demand||[]).map((x:any)=><span className="asPill" key={x.workshop}>{x.workshop} · {x.count}</span>)}
      </div>
    </div>

    <div>
      <div className="asTop" style={{marginBottom:10}}>
        <h2 style={{margin:0,fontSize:18}}>Próximas sesiones</h2>
        <Link className="asBtn" href="/after-school/sessions">Ver todas</Link>
      </div>
      <div className="asSessionGrid">
        {upcoming.length===0 ? <div className="asCard">Aún no hay sesiones cargadas. Agrégalas en Configuración.</div> :
          upcoming.map((x:any) => {
            const pct=Math.min(100,Math.round((x.confirmed/x.capacity)*100))
            return <div className="asSession" key={x.id}>
              <h3>{x.workshop_name}</h3>
              <div>{x.session_date} · {String(x.start_time).slice(0,5)}</div>
              <div className="asMeter"><span style={{width:`${pct}%`}}/></div>
              <div><b>{x.confirmed}/{x.capacity}</b> lugares · forecast 75%: {x.expected_attendance_75}</div>
            </div>
          })
        }
      </div>
    </div>
  </>
}
