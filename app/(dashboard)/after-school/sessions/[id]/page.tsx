import { getRoster, getSession } from '@/lib/after-school/queries'
import AttendanceTable from '@/components/after-school/AttendanceTable'
import Link from 'next/link'

export const dynamic='force-dynamic'

export default async function SessionDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const [s,rows]=await Promise.all([getSession(id),getRoster(id)])
  return <>
    <div className="asTop">
      <div>
        <h2 style={{margin:0}}>{s.workshop_name}</h2>
        <p className="asSub">{s.session_date} · {String(s.start_time).slice(0,5)} · {s.teacher_name||'Profesor pendiente'} · {s.room_name||'Salón pendiente'}</p>
      </div>
      <Link className="asBtn" href={`/after-school/sessions/${id}/roster`} target="_blank">Imprimir lista</Link>
    </div>
    <AttendanceTable sessionId={id} initialRows={rows}/>
  </>
}
