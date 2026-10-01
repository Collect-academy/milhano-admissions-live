import { AttendanceBoard } from "@/components/attendance-board";
import { AttendanceFilter } from "@/components/attendance-filter";
import { AttendanceReport } from "@/components/attendance-report";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getAttendanceDay,getAttendanceRooms,getAttendanceReport } from "@/lib/student-attendance";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
export const dynamic="force-dynamic";
type SearchParams=Promise<Record<string,string|string[]|undefined>>; const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
function todayMerida(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Merida",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function valid(v:string|undefined,f:string){return v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:f}
function monthStart(d:string){return `${d.slice(0,7)}-01`}
function pretty(d:string){return new Intl.DateTimeFormat("es-MX",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${d}T12:00:00Z`))}
export default async function AttendancePage({searchParams}:{searchParams:SearchParams}){
 const p=await searchParams,today=todayMerida(),date=valid(one(p.date),today),room=one(p.room)??"";
 const reportEnd=valid(one(p.reportEnd),date),reportStart=valid(one(p.reportStart),monthStart(reportEnd)),reportLevel=one(p.reportLevel)??"",reportRoom=one(p.reportRoom)??"",reportStudent=one(p.reportStudent)??"";
 const admin=createSupabaseAdmin(); const [students,rooms,report,studentOptions]=await Promise.all([getAttendanceDay(date,room),getAttendanceRooms(),getAttendanceReport(reportStart,reportEnd,reportLevel,reportRoom,reportStudent),admin.from("milhano_students").select("id,full_name").eq("is_active",true).order("full_name")]);
 const selected=rooms.find(r=>r.key===room); const dayTitle=`${pretty(date)}${selected?` · ${selected.label}`:" · Todos los salones"}`;
 return <StudentModuleLayout eyebrow="Alumnos" title="Lista de asistencia" subtitle="Marca ✓, ✕ o deja en blanco. Al terminar, presiona Guardar asistencia." statusLabel={`${date} · ${students.length} alumnos`}><AttendanceFilter date={date} room={room} rooms={rooms} today={today}/><div className={`attendance-day-banner ${date===today?"is-today":""}`}><span>{date===today?"HOY":"FECHA DEL REGISTRO"}</span><strong>{dayTitle}</strong></div><AttendanceBoard date={date} initialStudents={students}/><AttendanceReport start={reportStart} end={reportEnd} level={reportLevel} room={reportRoom} studentId={reportStudent} rooms={rooms} students={(studentOptions.data??[]).map(s=>({id:s.id,name:s.full_name}))} rows={report.rows} days={report.days}/></StudentModuleLayout>
}
