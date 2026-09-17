import { getParticipants } from '@/lib/after-school/queries'
import AllocationTable from '@/components/after-school/AllocationTable'

export const dynamic='force-dynamic'

export default async function AllocationPage(){
  const rows:any[]=await getParticipants('',1,100)
  const actionable=rows.filter(r=>r.allocation_status!=='confirmed')
  return <>
    <div className="asNotice"><b>Auto asignación:</b> usa grado, workshops solicitados, horario, cupo real (20) y evita empalmes. Si no encuentra lugar para todos, deja el alumno en revisión parcial.</div>
    <AllocationTable rows={actionable}/>
  </>
}
