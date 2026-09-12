import { getSessions } from '@/lib/after-school/queries'
import Link from 'next/link'

export const revalidate=15

export default async function AttendancePage(){
  const sessions:any[]=await getSessions()
  return <div className="asTableWrap"><table className="asTable">
    <thead><tr><th>Fecha</th><th>Workshop</th><th>Profesor</th><th>Registrados</th><th>Asistieron</th><th>Acción</th></tr></thead>
    <tbody>{sessions.map(s=><tr key={s.id}>
      <td>{s.session_date}<br/>{String(s.start_time).slice(0,5)}</td>
      <td><b>{s.workshop_name}</b></td><td>{s.teacher_name||'—'}</td>
      <td>{s.confirmed}/{s.capacity}</td><td>{s.attended}</td>
      <td><Link className="asBtn" href={`/after-school/sessions/${s.id}`}>Pasar lista</Link></td>
    </tr>)}</tbody>
  </table></div>
}
