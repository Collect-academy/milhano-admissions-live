"use client";
import { useEffect,useRef,useState } from "react";
import styles from "./open-house.module.css";
type Match={id:string;label:string;slots:string[];present:boolean};
export default function OpenHouseCheckin(){
 const [phone,setPhone]=useState(""),[name,setName]=useState(""),[email,setEmail]=useState("");
 const [matches,setMatches]=useState<Match[]>([]),[selected,setSelected]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 const seq=useRef(0);
 const digits=phone.replace(/\D/g,"");
 const valid=digits.length===10||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
 useEffect(()=>{
   const requestId=++seq.current;setMatches([]);setSelected("");setMessage("");
   if(!valid||done)return;
   const controller=new AbortController();
   const timer=setTimeout(async()=>{setBusy(true);try{
     const r=await fetch("/api/open-house/public",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"lookup",phone:digits,name,email}),signal:controller.signal});
     const data=await r.json();if(requestId!==seq.current)return;
     setMatches(data.matches??[]);if(data.matches?.length===1)setSelected(data.matches[0].id);
     setMessage(data.error??(data.matches?.length?"":"No encontramos tu registro. Acércate al equipo si necesitas ayuda."));
   }catch{if(!controller.signal.aborted&&requestId===seq.current)setMessage("No se pudo conectar. Intenta de nuevo.");}finally{if(requestId===seq.current)setBusy(false);}},450);
   return ()=>{clearTimeout(timer);controller.abort();setBusy(false);};
 },[digits,name,email,valid,done]);
 async function confirm(){setBusy(true);setMessage("");try{
   const r=await fetch("/api/open-house/public",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"confirm",id:selected,phone:digits,name,email})});
   const data=await r.json();if(data.ok)setDone(true);else setMessage(data.error??"No se pudo confirmar.");
 }catch{setMessage("No se pudo conectar. Acércate al equipo.");}finally{setBusy(false);}}
 return <main className={styles.publicShell}><section className={styles.publicCard}>
 <div className={styles.brand}>MILHANO <small>INTERNATIONAL SCHOOL</small></div>
 <p className={styles.kicker}>OPEN HOUSE · 27 NOV 2026</p>
 {done?<><div className={styles.successMark}>✓</div><h1>¡Bienvenidos a Milhano!</h1><p>Tu asistencia está registrada. Nuestro equipo te indicará el siguiente paso.</p></>:<>
 <h1>Registra tu asistencia</h1><p>Busca tu reserva con tu WhatsApp o correo. Confirma con tu nombre completo o con ambos datos de contacto.</p>
 <label>WhatsApp (10 dígitos)<input inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="999 000 0000" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label>Nombre y apellido<input autoComplete="name" maxLength={150} placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Correo electrónico<input type="email" autoComplete="email" maxLength={254} placeholder="correo@ejemplo.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {!valid&&name.length>=3&&<p className={styles.hint}>Por privacidad, añade tu WhatsApp o correo para buscar por nombre.</p>}
 {busy&&<p role="status">Consultando…</p>}
 <div className={styles.results}>{matches.map(m=><label key={m.id} className={styles.match}><input type="radio" name="match" checked={selected===m.id} onChange={()=>setSelected(m.id)}/><span><strong>{m.label}</strong><br/>{m.slots.join(" / ")||"Sin reserva"}{m.present?" · Asistencia confirmada":""}</span></label>)}</div>
 {message&&<p role="status" className={styles.hint}>{message}</p>}
 <button type="button" disabled={!selected||busy||(!name.trim()&&!(digits.length===10&&email.trim()))} onClick={confirm}>Registrar asistencia</button>
 <p className={styles.hint}>¿No encuentras tu registro? Nuestro equipo puede ayudarte.</p>
 </>}
 </section></main>;
}
