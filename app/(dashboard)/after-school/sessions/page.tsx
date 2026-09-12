import { getSessions } from '@/lib/after-school/queries'
import Link from 'next/link'

export const revalidate = 15

export default async function SessionsPage() {
  const sessions:any[] = await getSessions()
  return <div className="asSessionGrid">
    {sessions.length===0 ? <div className="asCard">No hay sesiones. Crea la primera en Configuración.</div> :
      sessions.map(s=>{
        const pct=Math.min(100,Math.round((s.confirmed/s.capacity)*100))
        const full=s.confirmed>=s.capacity
        return <article className="asSession" key={s.id}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10}}>
            <h3>{s.workshop_name}</h3>
            <span className={`asPill ${full?'danger':''}`}>{full?'LLENO':`${s.available} libres`}</span>
          </div>
          <div>{s.session_date} · {String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</div>
          <div className="asSub">{s.teacher_name||'Profesor pendiente'} · {s.room_name||'Salón pendiente'}</div>
          <div className="asMeter"><span style={{width:`${pct}%`}}/></div>
          <div><b>{s.confirmed}/{s.capacity}</b> vendidos · forecast 75%: {s.expected_attendance_75}</div>
          <div style={{display:'flex',gap:7,marginTop:12}}>
            <Link className="asBtn" href={`/after-school/sessions/${s.id}`}>Asistencia</Link>
            <Link className="asBtn" href={`/after-school/sessions/${s.id}/roster`} target="_blank">Imprimir lista</Link>
          </div>
        </article>
      })
    }
  </div>
}
