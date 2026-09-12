import { getRoster, getSession } from '@/lib/after-school/queries'

export const dynamic='force-dynamic'

export default async function RosterPrint({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const [s,rows]=await Promise.all([getSession(id),getRoster(id)])
  return <html><head><title>Lista · {s.workshop_name}</title>
    <style>{`
      @page{size:letter;margin:12mm}body{font-family:Arial,sans-serif;color:#222;margin:0}
      h1{font-size:22px;margin:0;color:#003c32}.meta{font-size:12px;line-height:1.45}
      header{display:flex;justify-content:space-between;border-bottom:3px solid #003c32;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:10.5px}
      th,td{border:1px solid #777;padding:6px;vertical-align:top}th{background:#eee7e3}
      .notes{width:25%}.check{width:50px}.lines{height:55px;border:1px solid #777;margin-top:6px}
      .noprint{margin:10px 0}@media print{.noprint{display:none}}
    `}</style></head><body>
    <div className="noprint">Usa Ctrl+P / Imprimir</div>
    <header><div><h1>{s.workshop_name}</h1><div>Milhano After School Experience</div></div>
      <div className="meta"><b>Fecha:</b> {s.session_date}<br/><b>Horario:</b> {String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}<br/>
      <b>Profesor:</b> {s.teacher_name||'__________'}<br/><b>Salón:</b> {s.room_name||'__________'}<br/><b>Cupo:</b> {s.capacity}</div>
    </header>
    <table><thead><tr><th>#</th><th>Alumno</th><th>Edad</th><th>Grado</th><th>Tutor</th><th>WhatsApp</th><th className="check">Presente</th><th className="notes">Notas</th></tr></thead>
      <tbody>{rows.map((r:any,i:number)=><tr key={r.participant_id}><td>{i+1}</td><td>{r.full_name}</td><td>{r.age}</td><td>{r.grade_raw}</td><td>{r.tutor_name}</td><td>{r.tutor_phone}</td><td>☐</td><td></td></tr>)}</tbody>
    </table>
    <p><b>Asistencia:</b> ____ / {s.capacity}</p><b>Observaciones generales:</b><div className="lines"/>
  </body></html>
}
