'use client'
import { useState, useTransition } from 'react'

export default function AttendanceTable({sessionId,initialRows}:{sessionId:string,initialRows:any[]}) {
  const [rows,setRows]=useState(initialRows)
  const [pending,startTransition]=useTransition()

  const mark=(participantId:string,attended:boolean)=>{
    setRows(old=>old.map(r=>r.participant_id===participantId?{...r,attended}:r))
    startTransition(async()=>{
      await fetch('/api/after-school/attendance',{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({participant_id:participantId,session_id:sessionId,attended})
      })
    })
  }

  return <div className="asTableWrap" style={{opacity:pending?.98:1}}>
    <table className="asTable">
      <thead><tr><th>Alumno</th><th>Edad</th><th>Grado</th><th>Tutor</th><th>Asistencia</th><th>Notas</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.participant_id}>
        <td><b>{r.full_name}</b></td>
        <td>{r.age}</td>
        <td>{r.grade_raw}</td>
        <td>{r.tutor_name}<br/><span className="asSub">{r.tutor_phone}</span></td>
        <td style={{whiteSpace:'nowrap'}}>
          <button className={`asBtn ${r.attended===true?'primary':''}`} onClick={()=>mark(r.participant_id,true)}>✓ Presente</button>{' '}
          <button className="asBtn" onClick={()=>mark(r.participant_id,false)}>No vino</button>
        </td>
        <td>{r.teacher_notes||'—'}</td>
      </tr>)}</tbody>
    </table>
  </div>
}
