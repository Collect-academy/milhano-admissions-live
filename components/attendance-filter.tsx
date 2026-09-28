"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AttendanceFilter({ date, grade, grades }: { date: string; grade: string; grades: string[] }) {
  const router = useRouter(); const params = useSearchParams(); const [custom, setCustom] = useState(date);
  function go(nextDate: string, nextGrade = grade) { const q = new URLSearchParams(params.toString()); q.set("date", nextDate); if (nextGrade) q.set("grade", nextGrade); else q.delete("grade"); router.push(`/alumnos/asistencia?${q}`); }
  function shift(days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); go(d.toISOString().slice(0,10)); }
  function periodStart(kind: "week"|"month"|"year") { const d = new Date(`${date}T12:00:00Z`); if(kind==="week"){ const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day); } if(kind==="month") d.setUTCDate(1); if(kind==="year"){d.setUTCMonth(0);d.setUTCDate(1);} go(d.toISOString().slice(0,10)); }
  return <section className="date-filter-shell attendance-filter">
    <div className="attendance-filter-main"><button className="date-preset" onClick={()=>shift(-1)} type="button">←</button><label><span>Fecha</span><input type="date" value={date} onChange={(e)=>go(e.target.value)} /></label><button className="date-preset" onClick={()=>shift(1)} type="button">→</button></div>
    <div className="date-preset-row"><button className="date-preset" onClick={()=>go(new Date().toLocaleDateString("en-CA",{timeZone:"America/Merida"}))} type="button">Hoy</button><button className="date-preset" onClick={()=>periodStart("week")} type="button">Semana</button><button className="date-preset" onClick={()=>periodStart("month")} type="button">Mes</button><button className="date-preset" onClick={()=>periodStart("year")} type="button">Año</button></div>
    <div className="attendance-custom"><label><span>Custom</span><input type="date" value={custom} onChange={(e)=>setCustom(e.target.value)} /></label><button className="date-custom-button" onClick={()=>go(custom)} type="button">Ir</button></div>
    <label className="student-directory-select"><span>Grado</span><select value={grade} onChange={(e)=>go(date,e.target.value)}><option value="">Todos</option>{grades.map((g)=><option key={g}>{g}</option>)}</select></label>
  </section>;
}
