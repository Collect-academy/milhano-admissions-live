import { getParticipants } from '@/lib/after-school/queries'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ParticipantsPage({searchParams}:{searchParams:Promise<{q?:string,page?:string}>}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const page = Math.max(1,Number(sp.page ?? 1) || 1)
  const rows:any[] = await getParticipants(q,page,50)
  const total = Number(rows[0]?.total_count ?? 0)
  const pages = Math.max(1,Math.ceil(total/50))

  return <>
    <div className="asTop">
      <form className="asSearch">
        <input name="q" defaultValue={q} placeholder="Alumno, tutor o grado"/>
        <button className="asBtn" type="submit">Buscar</button>
      </form>
      <div className="asSub">{total} participantes</div>
    </div>

    <div className="asTableWrap">
      <table className="asTable">
        <thead><tr><th>Alumno</th><th>Tutor</th><th>Edad / grado</th><th>Escuela</th><th>Workshops</th><th>Pago</th><th>Asignación</th></tr></thead>
        <tbody>
          {rows.map(r=><tr key={r.participant_id}>
            <td><b>{r.full_name}</b></td>
            <td>{r.tutor_name}<br/><span className="asSub">{r.tutor_phone}</span></td>
            <td>{r.age} · {r.grade_raw}</td>
            <td>{r.current_school}</td>
            <td>{(r.requested_workshops||[]).join(' · ') || '—'}</td>
            <td><span className={`asPill ${r.payment_status==='paid'?'':'warn'}`}>{r.payment_status}</span></td>
            <td><span className={`asPill ${r.allocation_status==='confirmed'?'':'warn'}`}>{r.allocation_status}</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
      {page>1 && <Link className="asBtn" href={`?q=${encodeURIComponent(q)}&page=${page-1}`}>Anterior</Link>}
      <span className="asBtn">{page}/{pages}</span>
      {page<pages && <Link className="asBtn" href={`?q=${encodeURIComponent(q)}&page=${page+1}`}>Siguiente</Link>}
    </div>
  </>
}
