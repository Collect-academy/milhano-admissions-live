"use client";
import { useRouter,useSearchParams } from "next/navigation";
import type { AttendanceRoom } from "@/lib/student-attendance";
export function AttendanceFilter({date,room,rooms,today}:{date:string;room:string;rooms:AttendanceRoom[];today:string}){
 const router=useRouter(),params=useSearchParams();
 function go(d:string,r=room){const q=new URLSearchParams(params.toString());q.set("date",d);r?q.set("room",r):q.delete("room");router.push(`/alumnos/asistencia?${q}`)}
 function shift(n:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);go(d.toISOString().slice(0,10));}
 return <section className="date-filter-shell attendance-filter-simple"><div className="attendance-filter-main"><button className="date-preset" onClick={()=>shift(-1)} type="button">←</button><label><span>Fecha</span><input type="date" value={date} onChange={e=>go(e.target.value)}/></label><button className="date-preset" onClick={()=>shift(1)} type="button">→</button><button className={`date-preset ${date===today?"attendance-today-active":""}`} onClick={()=>go(today)} type="button">Hoy</button></div><label className="student-directory-select attendance-room-select"><span>Salón / grupo</span><select value={room} onChange={e=>go(date,e.target.value)}><option value="">Todos los salones</option>{rooms.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label></section>
}
