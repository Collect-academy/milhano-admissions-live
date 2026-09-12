'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function AllocationTable({rows}:{rows:any[]}){
  const router=useRouter()
  const [state,setState]=useState(rows)
  const [pending,startTransition]=useTransition()

  const allocate=(id:string)=>{
    startTransition(async()=>{
      const r=await fetch('/api/after-school/allocation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({participant_id:id})})
      const j=await r.json()
      setState(old=>old.map(x=>x.participant_id===id?{...x,allocation_status:j.confirmed>0?(j.unassigned===0?'confirmed':'partial'):'needs_review'}:x))
      router.refresh()
    })
  }

  return <div className="asTableWrap" style={{opacity:pending?.96:1}}>
    <table className="asTable">
      <thead><tr><th>Alumno</th><th>Grado</th><th>Solicitado</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>{state.map(r=><tr key={r.participant_id}>
        <td><b>{r.full_name}</b><br/><span className="asSub">{r.tutor_name}</span></td>
        <td>{r.grade_raw}</td>
        <td>{(r.requested_workshops||[]).join(' · ')||'Todas compatibles'}</td>
        <td><span className={`asPill ${r.allocation_status==='confirmed'?'':'warn'}`}>{r.allocation_status}</span></td>
        <td><button className="asBtn primary" disabled={pending} onClick={()=>allocate(r.participant_id)}>Auto asignar</button></td>
      </tr>)}</tbody>
    </table>
  </div>
}
