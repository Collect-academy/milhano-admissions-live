"use client";
import {useEffect,useRef,useState} from "react";
import {grades,dateLabel,monthOptions} from "@/lib/open-house-trial-config";
import styles from "./open-house.module.css";
type Day={date:string;remaining:number};
type Confirmation={reference:string;date:string;grade:string};
export default function TrialBooking(){
 const [grade,setGrade]=useState(""),[month,setMonth]=useState(0),[date,setDate]=useState(""),[days,setDays]=useState<Day[]>([]),[child,setChild]=useState(""),[guardian,setGuardian]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[done,setDone]=useState<Confirmation|null>(null),[reload,setReload]=useState(0);
 const requestId=useRef(""),savingRef=useRef(false);
 useEffect(()=>{
  setDays([]);setDate("");if(!grade)return;
  const ctrl=new AbortController();setLoading(true);setError("");
  (async()=>{try{const r=await fetch("/api/open-house/pasadia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"availability",grade}),signal:ctrl.signal});const d=await r.json();if(!r.ok)throw new Error(d.error??"No se pudo consultar.");if(!ctrl.signal.aborted)setDays(d.days??[]);}catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"No se pudo consultar.");}finally{if(!ctrl.signal.aborted)setLoading(false);}})();
  return()=>ctrl.abort();
 },[grade,reload]);
 function change(){requestId.current="";}
 async function book(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!date||!grade||savingRef.current)return;
  if(!requestId.current)requestId.current=crypto.randomUUID();
  savingRef.current=true;setSaving(true);setError("");
  try{
   const r=await fetch("/api/open-house/pasadia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"book",grade,date,child,guardian,phone,email,request_id:requestId.current})});const d=await r.json();
   if(!r.ok||!d.ok){setError(d.error??"No se guardó la reserva.");if(d.code==="full"){setDays(old=>old.map(x=>x.date===date?{...x,remaining:0}:x));setDate("");change();}return;}
   setDone(d);
  }catch{setError("No se pudo confirmar. Vuelve a intentar con los mismos datos; no se duplicará la solicitud.");}finally{savingRef.current=false;setSaving(false);}
 }
 const m=monthOptions[month];
 return <main className={styles.publicShell}><section className={styles.publicCard+" "+styles.trialCard}>
 <div className={styles.brand}>MILHANO <small>INTERNATIONAL SCHOOL</small></div><p className={styles.kicker}>OPEN HOUSE · PASADÍA</p>
 {done?<><div className={styles.successMark}>✓</div><h1>¡Pasadía reservada!</h1><p><strong>{dateLabel(done.date)}</strong><br/>{done.grade}<br/>{child}</p><div className={styles.trialNotice}><strong>Tu llegada:</strong> entrada abierta desde las 6:45 a. m. La primera clase, Bienestar, comienza a las 7:00 a. m. Recomendamos llegar antes de las 7:00 y traer un mat o tapete. Consulta la hora de salida con el equipo de admisiones.</div><p className={styles.hint}>Referencia: {done.reference.slice(0,8).toUpperCase()}. Guarda una captura de esta confirmación. Para cambios, contacta al equipo.</p><button onClick={()=>{setDone(null);setChild("");setGrade("");setDate("");change();}}>Agendar para otro alumno</button></>:<>
 <h1>Agenda tu pasadía</h1><p>Vive un día como parte de nuestra comunidad educativa. Selecciona un grado y una fecha con cupo.</p>
 <form onSubmit={book}>
 <label>Nombre completo del alumno<input required maxLength={150} value={child} onChange={e=>{setChild(e.target.value);change();}} disabled={saving}/></label>
 <label>Grado o semestre<select required value={grade} onChange={e=>{setGrade(e.target.value);setMonth(0);change();}} disabled={saving}><option value="">Selecciona el grado</option>{grades.map(g=><option value={g.code} key={g.code}>{g.label}</option>)}</select></label>
 {grade&&<section className={styles.calendarBox}><div className={styles.calendarTop}><strong>{m.label}</strong><div><button type="button" aria-label="Mes anterior" disabled={month===0||saving} onClick={()=>setMonth(0)}>‹</button><button type="button" aria-label="Mes siguiente" disabled={month===1||saving} onClick={()=>setMonth(1)}>›</button></div></div>
 <div className={styles.calendarGrid}>{["L","M","M","J","V","S","D"].map((x,i)=><span key={"w"+i} className={styles.weekday}>{x}</span>)}{Array.from({length:m.start},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:m.days},(_,i)=>{const d=m.prefix+"-"+String(i+1).padStart(2,"0");const a=days.find(x=>x.date===d);return <button type="button" key={d} disabled={!a||a.remaining<1||loading||saving} aria-pressed={date===d} aria-label={dateLabel(d)+(a?" · "+a.remaining+" lugares":" · No disponible")} onClick={()=>{setDate(d);change();}}><span>{i+1}</span><small>{a?a.remaining+" cupo"+(a.remaining===1?"":"s"):"—"}</small></button>;})}</div>
 <p className={styles.hint}>{loading?"Consultando cupos…":date?"Seleccionaste "+dateLabel(date):"Elige un día disponible. Los días llenos o restringidos no se pueden seleccionar."}</p><button type="button" className={styles.secondaryButton} disabled={loading||saving} onClick={()=>{change();setReload(v=>v+1);}}>Actualizar cupos</button></section>}
 <label>Nombre del padre, madre o tutor<input required value={guardian} maxLength={150} disabled={saving} onChange={e=>{setGuardian(e.target.value);change();}}/></label>
 <label>WhatsApp (10 dígitos)<input required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={phone} disabled={saving} onChange={e=>{setPhone(e.target.value);change();}}/></label>
 <label>Correo (opcional)<input type="email" autoComplete="email" maxLength={254} value={email} disabled={saving} onChange={e=>{setEmail(e.target.value);change();}}/></label>
 <div className={styles.trialNotice}>Entrada a partir de <strong>6:45 a. m.</strong> · Primera clase a las <strong>7:00 a. m. (Bienestar)</strong>. Llega antes de las 7:00 y trae un mat/tapete.</div>
 {error&&<p className={styles.error} role="alert">{error}</p>}
 <button type="submit" disabled={!date||loading||saving||phone.replace(/\D/g,"").length!==10}>{saving?"Reservando…":"Confirmar pasadía"}</button>
 <p className={styles.hint}>Los datos se utilizarán para organizar la pasadía y contactar a tu familia sobre esta visita. Una reserva por alumno; los cupos se confirman al guardar.</p>
 </form></>}
 </section></main>;
}
