'use client'
import { useEffect, useMemo, useState } from 'react'
import styles from './registro.module.css'

type Workshop={id:string,name:string,capacity:number,registered:number,remaining:number}
type Grade={label:string,sort_order:number}
type Options={price_per_student_mxn:number,max_students:number,grades:Grade[],workshops:Workshop[]}
type Student={name:string,age:string,grade_raw:string,school:string,workshop_id:string}
const blank=():Student=>({name:'',age:'',grade_raw:'',school:'',workshop_id:''})

export default function RegistrationForm({embed=false}:{embed?:boolean}){
  const [count,setCount]=useState(1)
  const [students,setStudents]=useState<Student[]>([blank()])
  const [tutor,setTutor]=useState({name:'',phone:'',email:''})
  const [consent,setConsent]=useState(false)
  const [options,setOptions]=useState<Options|null>(null)
  const [loadingOptions,setLoadingOptions]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [status,setStatus]=useState<{type:'ok'|'err',msg:string}|null>(null)
  const price=options?.price_per_student_mxn??50
  const total=useMemo(()=>count*price,[count,price])

  const loadOptions=async()=>{
    setLoadingOptions(true)
    try{
      const r=await fetch('/api/after-school/availability',{cache:'no-store'})
      const j=await r.json()
      if(!r.ok) throw new Error(j.message||'No se pudo consultar disponibilidad.')
      setOptions(j)
      // If a workshop filled while the form was open, clear that selection.
      const activeIds=new Set((j.workshops||[]).map((w:Workshop)=>w.id))
      setStudents(old=>old.map(s=>s.workshop_id&&!activeIds.has(s.workshop_id)?{...s,workshop_id:''}:s))
    }catch(e:any){
      setStatus({type:'err',msg:e?.message||'No se pudo consultar disponibilidad.'})
    }finally{setLoadingOptions(false)}
  }

  useEffect(()=>{ void loadOptions() },[])

  const chooseCount=(n:number)=>{
    setCount(n)
    setStudents(old=>Array.from({length:n},(_,i)=>old[i]??blank()))
  }
  const update=(i:number,p:Partial<Student>)=>setStudents(old=>old.map((s,k)=>k===i?{...s,...p}:s))
  const workshopName=(id:string)=>options?.workshops.find(w=>w.id===id)?.name||'Selecciona taller'

  const submit=async()=>{
    setStatus(null)
    if(!tutor.name||!tutor.email||!tutor.phone||!consent)
      return setStatus({type:'err',msg:'Completa los datos del tutor y la autorización.'})
    for(const s of students){
      if(!s.name||!s.age||!s.grade_raw||!s.school||!s.workshop_id)
        return setStatus({type:'err',msg:'Completa todos los datos y selecciona un taller para cada alumno.'})
    }
    setSubmitting(true)
    try{
      const q=new URLSearchParams(location.search)
      const payload={
        tutor,
        students:students.map((s,i)=>({...s,student_index:i+1,age:Number(s.age)})),
        consent,
        attribution:Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,q.get(k)||'']))
      }
      const r=await fetch('/api/after-school/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
      const j=await r.json()
      if(!r.ok){
        if(String(j.message||'').includes('WORKSHOP_FULL')){
          await loadOptions()
          throw new Error('Uno de los talleres acaba de llenar sus 20 lugares. Ya actualizamos las opciones; selecciona otro taller.')
        }
        throw new Error(j.message||'No se pudo guardar el registro.')
      }

      // Stripe slot: when payment is enabled, the register endpoint will return the checkout flow.
      // For now we land on the prepared thank-you/pending page.
      const next=(j.next_url||`/after-school/gracias?status=pending&registration_id=${encodeURIComponent(j.registration_id)}`)+(embed?'&embed=1':'')
      location.assign(next)
    }catch(e:any){
      setStatus({type:'err',msg:e?.message||'No se pudo completar el registro.'})
    }finally{setSubmitting(false)}
  }

  return <div className={`${styles.grid} ${embed?styles.embedGrid:''}`}>
    <div>
      <div className={styles.card}>
        <h2>1 · Tutor responsable</h2>
        <div className={styles.fields}>
          <label className={styles.full}>Nombre completo<input autoComplete="name" value={tutor.name} onChange={e=>setTutor({...tutor,name:e.target.value})}/></label>
          <label>WhatsApp<input autoComplete="tel" value={tutor.phone} onChange={e=>setTutor({...tutor,phone:e.target.value})}/></label>
          <label>Email<input autoComplete="email" type="email" value={tutor.email} onChange={e=>setTutor({...tutor,email:e.target.value})}/></label>
        </div>
      </div>
      <div className={styles.card}>
        <h2>2 · ¿Cuántos alumnos?</h2>
        <p className={styles.helper}>Cada alumno reserva <b>un taller</b>. Precio: <b>$50 MXN por alumno/taller</b>.</p>
        <div className={styles.count}>{[1,2,3,4].map(n=><button type="button" className={n===count?styles.on:''} onClick={()=>chooseCount(n)} key={n}>{n}</button>)}</div>
        {students.map((s,i)=><div className={styles.student} key={i}>
          <h3>Alumno {i+1}</h3>
          <div className={styles.fields}>
            <label className={styles.full}>Nombre completo<input value={s.name} onChange={e=>update(i,{name:e.target.value})}/></label>
            <label>Edad<select value={s.age} onChange={e=>update(i,{age:e.target.value})}><option value="">Selecciona</option>{Array.from({length:11},(_,k)=>k+6).map(a=><option value={a} key={a}>{a} años</option>)}</select></label>
            <label>Grado<select value={s.grade_raw} onChange={e=>update(i,{grade_raw:e.target.value})} disabled={loadingOptions}><option value="">Selecciona grado</option>{(options?.grades||[]).map(g=><option value={g.label} key={g.label}>{g.label}</option>)}</select></label>
            <label className={styles.full}>Escuela actual<input value={s.school} onChange={e=>update(i,{school:e.target.value})}/></label>
            <label className={styles.full}>Taller que desea probar
              <select value={s.workshop_id} onChange={e=>update(i,{workshop_id:e.target.value})} disabled={loadingOptions}>
                <option value="">{loadingOptions?'Consultando cupos…':'Selecciona un taller'}</option>
                {(options?.workshops||[]).map(w=><option value={w.id} key={w.id}>{w.name} · {w.remaining} lugar{w.remaining===1?'':'es'} disponible{w.remaining===1?'':'s'}</option>)}
              </select>
            </label>
          </div>
        </div>)}
        {!loadingOptions && (options?.workshops?.length??0)===0 && <div className={styles.err}>Por el momento todos los talleres llegaron a su cupo de 20 registros.</div>}
      </div>
      <div className={styles.card}>
        <label className={styles.ws}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto la autorización de participación y el aviso de privacidad aplicable. Reemplazar por el texto legal aprobado antes de Ads.</label>
      </div>
    </div>
    <aside className={styles.summary}>
      <h2>Tu reserva</h2>
      {students.map((s,i)=><div className={styles.line} key={i}><span><b>{s.name||`Alumno ${i+1}`}</b><small>{workshopName(s.workshop_id)}</small></span><b>${price}</b></div>)}
      <div className={styles.total}><span>{count} pase{count>1?'s':''}</span><strong>${total}</strong></div>
      <button className={styles.btn} disabled={submitting||loadingOptions||(options?.workshops?.length??0)===0} onClick={submit}>{submitting?'Guardando…':`Continuar · $${total} MXN`}</button>
      <div className={styles.note}>Cada pase corresponde a un taller de 2 horas por semana para un participante. El total se calcula automáticamente y no se puede editar.</div>
      {status&&<div className={status.type==='ok'?styles.ok:styles.err}>{status.msg}</div>}
    </aside>
  </div>
}
