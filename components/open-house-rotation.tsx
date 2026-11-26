"use client";
import {useState} from "react";
import {stations,leaders,rounds,timePlus} from "@/lib/open-house-rotation";
import styles from "./open-house.module.css";
type Member={id:string;name:string;attendance:string;actual_slot:string|null;coordinator:string|null};
const colors=["#e2eee3","#dce8f6","#f5e7cf","#e9e0f4","#d6eeeb","#f3dedc"];
export default function Rotation({slot,rows}:{slot:string;rows:Member[]}){
 const [start,setStart]=useState(slot),[duration,setDuration]=useState(8),[transition,setTransition]=useState(1),[group,setGroup]=useState("all");
 const columns=leaders.map((name,i)=>({name,i})).filter(c=>group==="all"||c.name===group);
 const actualStart=start||slot;
 const end=timePlus(actualStart,6*(duration+transition));const [hh,mm]=actualStart.split(":").map(Number);const [sh,sm]=slot.split(":").map(Number);const remaining=sh*60+sm+60-(hh*60+mm+6*(duration+transition));
 const names=(leader:string)=>rows.filter(f=>f.attendance==="present"&&f.actual_slot===slot&&f.coordinator===leader);
 return <section className={styles.routePanel}><div className={styles.routeHeading}><p className={styles.kicker}>MILHANO · OPEN HOUSE</p><h2>Recorrido de estaciones · {slot}</h2><p>27 de noviembre de 2026 · Iniciar después de concluir recepción y asignación de familias.</p></div>
 <div className={styles.toolbar}><label>Inicio real de recorrido<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Minutos por estación<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[8,9,10].map(n=><option key={n}>{n}</option>)}</select></label><label>Traslado (min)<select value={transition} onChange={e=>setTransition(Number(e.target.value))}>{[0,1,2].map(n=><option key={n}>{n}</option>)}</select></label><label>Hoja de recorrido<select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">Todos los grupos</option>{leaders.map(x=><option key={x}>{x}</option>)}</select></label><button onClick={()=>window.print()}>Imprimir / guardar PDF</button></div>
 <p className={styles.hint}>Inicio {actualStart} · Estación 7 a las {end}. {duration} min por estación, {transition} min de traslado. La estación 7 no tiene hora de finalización definida.</p>
 {remaining<=0?<p className={styles.error}>Las seis rondas y traslados {remaining<0?"superan el bloque por "+(-remaining)+" min":"ocupan todo el bloque"} antes de iniciar la estación 7.</p>:<p className={styles.hint}>Quedan {remaining} min del bloque nominal de 60 minutos al comenzar la estación 7; el cierre no tiene duración definida.</p>}
 <div className={styles.tableWrap}><table className={styles.rotationTable}><thead><tr><th>Ronda</th><th>Horario</th>{columns.map(c=><th key={c.name}>{c.name}<br/>{names(c.name).length} familias</th>)}</tr></thead><tbody>{rounds.map((r,i)=><tr key={i}><td>{i+1}</td><td>{timePlus(actualStart,i*(duration+transition))}–{timePlus(actualStart,i*(duration+transition)+duration)}</td>{columns.map(c=><td key={c.name} style={{background:colors[r[c.i]],color:"#17372b"}}><strong>{r[c.i]+1}. {stations[r[c.i]]}</strong></td>)}</tr>)}<tr><td>7</td><td>{end} · en adelante</td><td colSpan={columns.length} className={styles.closingCell}>Cierre conjunto · Los tres grupos</td></tr></tbody></table></div>
 <div className={styles.routeRoster}>{columns.map(c=><article key={c.name}><h3>{c.name} · {names(c.name).length} familias presentes</h3>{names(c.name).length?<ol>{names(c.name).map(f=><li key={f.id}>{f.name}</li>)}</ol>:<p>Sin familias asignadas en la última actualización.</p>}</article>)}</div>
 <p className={styles.hint}>Presiona Actualizar en Open House al terminar recepción para obtener la lista vigente antes de imprimir. No se crean consultas automáticas adicionales.</p>
 </section>;
}
