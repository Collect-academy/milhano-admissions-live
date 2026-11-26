"use client";
import {useEffect,useState} from "react";
import {flushSync} from "react-dom";
import {stations,leaders,rounds,timePlus} from "@/lib/open-house-rotation";
import styles from "./open-house.module.css";
type Member={id:string;name:string;attendance:string;actual_slot:string|null;coordinator:string|null;fields?:Record<string,unknown>;actual_adults?:number|null;actual_children?:number|null};
const colors=["#e2eee3","#dce8f6","#f5e7cf","#e9e0f4","#d6eeeb","#f3dedc"];
const columns=leaders.map((name,i)=>({name,i}));
type PrintGroup="all"|typeof leaders[number];
export default function Rotation({slot,rows}:{slot:string;rows:Member[]}){
 const [start,setStart]=useState(slot),[duration,setDuration]=useState(8),[transition,setTransition]=useState(1),[printGroup,setPrintGroup]=useState<PrintGroup>("all");
 const actualStart=start||slot;
 const end=timePlus(actualStart,6*(duration+transition));const [hh,mm]=actualStart.split(":").map(Number);const [sh,sm]=slot.split(":").map(Number);const remaining=sh*60+sm+60-(hh*60+mm+6*(duration+transition));
 const names=(leader:string)=>rows.filter(f=>f.attendance==="present"&&f.actual_slot===slot&&f.coordinator===leader);
 useEffect(()=>{const reset=()=>setPrintGroup("all");window.addEventListener("afterprint",reset);return()=>window.removeEventListener("afterprint",reset);},[]);
 function print(group:PrintGroup){flushSync(()=>setPrintGroup(group));window.print();}
 function schedule(cols:typeof columns){
  return <div className={styles.tableWrap}><table className={styles.rotationTable}><thead><tr><th>Ronda</th><th>Horario</th>{cols.map(c=><th key={c.name}>{c.name}<br/>{names(c.name).length} familias</th>)}</tr></thead><tbody>{rounds.map((r,i)=><tr key={i}><td>{i+1}</td><td>{timePlus(actualStart,i*(duration+transition))}–{timePlus(actualStart,i*(duration+transition)+duration)}</td>{cols.map(c=><td key={c.name} style={{background:colors[r[c.i]],color:"#17372b"}}><strong>{r[c.i]+1}. {stations[r[c.i]]}</strong></td>)}</tr>)}<tr><td>7</td><td>{end} · en adelante</td><td colSpan={cols.length} className={styles.closingCell}>Cierre conjunto · Los tres grupos</td></tr></tbody></table></div>;
 }
 function roster(cols:typeof columns){
  return <div className={styles.routeRoster}>{cols.map(c=><article key={c.name}><h3>{c.name} · {names(c.name).length} familias presentes</h3>{names(c.name).length?<ol>{names(c.name).map(f=><li key={f.id}><strong>{f.name}</strong>{f.fields?.nivel!=null&&f.fields.nivel!==""&&<span> · {String(f.fields.nivel)}</span>}{f.actual_adults!=null||f.actual_children!=null?<span> · {f.actual_adults??"—"} adultos / {f.actual_children??"—"} niños</span>:f.fields?.personas!=null&&f.fields.personas!==""?<span> · {String(f.fields.personas)} personas previstas</span>:null}</li>)}</ol>:<p>Sin familias asignadas en la última actualización.</p>}</article>)}</div>;
 }
 return <section className={styles.routePanel}>
 <div className={styles.routeHeading}><p className={styles.kicker}>MILHANO · OPEN HOUSE</p><h2>Recorrido de estaciones · {slot}</h2><p>27 de noviembre de 2026 · Iniciar después de concluir recepción y asignación de familias.</p></div>
 <div className={styles.toolbar}><label>Inicio real de recorrido<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Minutos por estación<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[8,9,10].map(n=><option key={n}>{n}</option>)}</select></label><label>Traslado (min)<select value={transition} onChange={e=>setTransition(Number(e.target.value))}>{[0,1,2].map(n=><option key={n}>{n}</option>)}</select></label></div>
 <div className={styles.routePrintActions}><strong>Imprimir / guardar PDF</strong><div className={styles.actions}><button onClick={()=>print("all")}>Documento general</button>{leaders.map(leader=><button className={styles.individualPrintButton} key={leader} onClick={()=>print(leader)}>{leader}</button>)}</div><small>La vista siempre muestra los tres grupos. Cada hoja individual incluye solo el recorrido y las familias de esa coordinación.</small></div>
 <p className={styles.hint}>Inicio {actualStart} · Estación 7 a las {end}. {duration} min por estación, {transition} min de traslado. La estación 7 no tiene hora de finalización definida.</p>
 {remaining<=0?<p className={styles.error}>Las seis rondas y traslados {remaining<0?"superan el bloque por "+(-remaining)+" min":"ocupan todo el bloque"} antes de iniciar la estación 7.</p>:<p className={styles.hint}>Quedan {remaining} min del bloque nominal de 60 minutos al comenzar la estación 7; el cierre no tiene duración definida.</p>}
 <div className={printGroup==="all"?"":styles.hideOnPrint}>{schedule(columns)}{roster(columns)}</div>
 {printGroup!=="all"&&<div className={styles.printOnly}><h3>Hoja individual · {printGroup}</h3><p>Inicio {actualStart} · {duration} min por estación · {transition} min de traslado · Cierre conjunto a las {end}.</p>{schedule(columns.filter(c=>c.name===printGroup))}{roster(columns.filter(c=>c.name===printGroup))}</div>}
 <p className={styles.hint}>Verifica que la lista de familias esté actualizada al terminar recepción, antes de imprimir. Usa Actualizar si es necesario.</p>
 </section>;
}
