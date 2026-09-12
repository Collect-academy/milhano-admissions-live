'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SessionCreator({workshops}:{workshops:any[]}) {
  const router=useRouter()
  const [msg,setMsg]=useState('')
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); setMsg('Guardando…')
    const f=new FormData(e.currentTarget)
    const payload=Object.fromEntries(f.entries())
    const r=await fetch('/api/after-school/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
    const j=await r.json()
    setMsg(j.ok?'Sesión creada.':'Error: '+(j.message||'No se pudo guardar'))
    if(j.ok){ e.currentTarget.reset(); router.refresh() }
  }
  return <form className="asCard" onSubmit={submit}>
    <h3 style={{marginTop:0}}>Nueva sesión</h3>
    <div className="asFormGrid">
      <div className="asField"><label>Workshop</label><select name="workshop_id" required><option value="">Selecciona</option>{workshops.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <div className="asField"><label>Fecha</label><input name="session_date" type="date" required/></div>
      <div className="asField"><label>Inicio</label><input name="start_time" type="time" required/></div>
      <div className="asField"><label>Fin</label><input name="end_time" type="time" required/></div>
      <div className="asField"><label>Profesor</label><input name="teacher_name"/></div>
      <div className="asField"><label>Salón</label><input name="room_name"/></div>
      <div className="asField"><label>Cupo</label><input name="capacity" type="number" min="1" max="60" defaultValue="20" required/></div>
      <div className="asField"><label>Grados permitidos</label><input name="allowed_grades" placeholder="Ej. 4° primaria,5° primaria"/></div>
    </div>
    <div style={{display:'flex',gap:10,alignItems:'center',marginTop:12}}><button className="asBtn primary">Crear sesión</button><span className="asSub">{msg}</span></div>
  </form>
}
