'use client'
import { useMemo, useState } from 'react'
import styles from './registro.module.css'

const WS=['Danza','Box','Voleibol','Running Club','Club de Matemáticas','Club de Español','Arte','Club de Inglés']
type Student={name:string,age:string,grade_raw:string,school:string,workshops:string[],all_compatible:boolean}
const blank=():Student=>({name:'',age:'',grade_raw:'',school:'',workshops:[],all_compatible:false})

export default function RegistrationForm(){
  const [count,setCount]=useState(1)
  const [students,setStudents]=useState<Student[]>([blank()])
  const [tutor,setTutor]=useState({name:'',phone:'',email:''})
  const [consent,setConsent]=useState(false)
  const [status,setStatus]=useState<{type:'ok'|'err',msg:string}|null>(null)
  const total=useMemo(()=>count*50,[count])

  const chooseCount=(n:number)=>{
    setCount(n)
    setStudents(old=>Array.from({length:n},(_,i)=>old[i]??blank()))
  }
  const update=(i:number,p:Partial<Student>)=>setStudents(old=>old.map((s,k)=>k===i?{...s,...p}:s))
  const toggleWS=(i:number,w:string)=>{
    const s=students[i], has=s.workshops.includes(w)
    update(i,{workshops:has?s.workshops.filter(x=>x!==w):[...s.workshops,w]})
  }
  const submit=async()=>{
    setStatus(null)
    if(!tutor.name||!tutor.email||!tutor.phone||!consent) return setStatus({type:'err',msg:'Completa los datos del tutor y la autorización.'})
    for(const s of students) if(!s.name||!s.age||!s.grade_raw||!s.school||(!s.workshops.length&&!s.all_compatible))
      return setStatus({type:'err',msg:'Completa los datos y al menos una selección para cada alumno.'})
    const q=new URLSearchParams(location.search)
    const payload={
      tutor,students:students.map((s,i)=>({...s,student_index:i+1,age:Number(s.age)})),
      consent,
      attribution:Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,q.get(k)||'']))
    }
    const r=await fetch('/api/after-school/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
    const j=await r.json()
    if(!r.ok) return setStatus({type:'err',msg:j.message||'No se pudo guardar el registro.'})
    setStatus({type:'ok',msg:`Registro guardado para ${j.student_count} alumno(s). Total previsto: $${j.expected_total_mxn} MXN. Pago pendiente de habilitar Stripe.`})
  }

  return <div className={styles.grid}>
    <div>
      <div className={styles.card}>
        <h2>1 · Tutor responsable</h2>
        <div className={styles.fields}>
          <label className={styles.full}>Nombre completo<input value={tutor.name} onChange={e=>setTutor({...tutor,name:e.target.value})}/></label>
          <label>WhatsApp<input value={tutor.phone} onChange={e=>setTutor({...tutor,phone:e.target.value})}/></label>
          <label>Email<input type="email" value={tutor.email} onChange={e=>setTutor({...tutor,email:e.target.value})}/></label>
        </div>
      </div>
      <div className={styles.card}>
        <h2>2 · ¿Cuántos alumnos?</h2>
        <div className={styles.count}>{[1,2,3,4].map(n=><button type="button" className={n===count?styles.on:''} onClick={()=>chooseCount(n)} key={n}>{n}</button>)}</div>
        {students.map((s,i)=><div className={styles.student} key={i}>
          <h3>Alumno {i+1}</h3>
          <div className={styles.fields}>
            <label className={styles.full}>Nombre completo<input value={s.name} onChange={e=>update(i,{name:e.target.value})}/></label>
            <label>Edad<select value={s.age} onChange={e=>update(i,{age:e.target.value})}><option value="">Selecciona</option>{Array.from({length:11},(_,k)=>k+6).map(a=><option key={a}>{a}</option>)}</select></label>
            <label>Grado actual<input placeholder="Ej. 4° primaria" value={s.grade_raw} onChange={e=>update(i,{grade_raw:e.target.value})}/></label>
            <label className={styles.full}>Escuela actual<input value={s.school} onChange={e=>update(i,{school:e.target.value})}/></label>
            <div className={styles.full}>
              <div style={{fontSize:12,fontWeight:800,color:'#315d4d',marginBottom:7}}>Actividades que le interesan</div>
              <div className={styles.workshops}>{WS.map(w=><label className={styles.ws} key={w}><input type="checkbox" checked={s.workshops.includes(w)} onChange={()=>toggleWS(i,w)}/>{w}</label>)}</div>
              <label className={styles.ws} style={{marginTop:9}}><input type="checkbox" checked={s.all_compatible} onChange={e=>update(i,{all_compatible:e.target.checked})}/>Quiero considerar todas las actividades compatibles</label>
            </div>
          </div>
        </div>)}
      </div>
      <div className={styles.card}>
        <label className={styles.ws}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto la autorización de participación y el aviso de privacidad aplicable. Reemplazar por el texto legal aprobado antes de Ads.</label>
      </div>
    </div>
    <aside className={styles.summary}>
      <h2>Tu reserva</h2>
      {students.map((s,i)=><div className={styles.line} key={i}><span>{s.name||`Alumno ${i+1}`}</span><b>$50</b></div>)}
      <div className={styles.total}><span>{count} participante{count>1?'s':''}</span><strong>${total}</strong></div>
      <button className={styles.btn} onClick={submit}>Registrar participantes</button>
      <div className={styles.note}>El carrito ya está amarrado al número de alumnos. En el update de Stripe, este botón se convertirá en “Pagar ${total}”. No habrá quantity editable.</div>
      {status&&<div className={status.type==='ok'?styles.ok:styles.err}>{status.msg}</div>}
    </aside>
  </div>
}
