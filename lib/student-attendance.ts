import "server-only";
import { requireStudentModuleContext } from "@/lib/student-records";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AttendanceStatus = "present" | "absent" | null;
export type AttendanceStudent = { student_id:string; full_name:string; level:string|null; grade:string|null; group_name:string|null; status:AttendanceStatus; note:string };
export type AttendanceRoom = { key:string; label:string; level:string; grade:string; group_name:string };
export type AttendanceReportRow = { student_id:string; full_name:string; level:string; room:string; present:number; absent:number; recorded:number; rate:number };

const clean=(v:unknown)=>String(v??"").trim();
const roomKey=(l:unknown,g:unknown,r:unknown)=>[clean(l),clean(g),clean(r)].join("|");
const roomLabel=(l:unknown,g:unknown,r:unknown)=>[clean(l),clean(g),clean(r)].filter(Boolean).join(" · ") || "Sin salón";

export async function getAttendanceRooms():Promise<AttendanceRoom[]> {
  await requireStudentModuleContext(); const admin=createSupabaseAdmin();
  const q=await admin.from("milhano_students").select("level,grade,group_name").eq("is_active",true).limit(500);
  if(q.error) throw new Error(q.error.message);
  const map=new Map<string,AttendanceRoom>();
  for(const s of q.data??[]){ const key=roomKey(s.level,s.grade,s.group_name); map.set(key,{key,label:roomLabel(s.level,s.grade,s.group_name),level:clean(s.level),grade:clean(s.grade),group_name:clean(s.group_name)}); }
  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true}));
}

export async function getAttendanceDay(date:string, room=""):Promise<AttendanceStudent[]> {
  await requireStudentModuleContext(); const admin=createSupabaseAdmin();
  let sq=admin.from("milhano_students").select("id,full_name,level,grade,group_name").eq("is_active",true).order("level").order("grade").order("group_name").order("full_name");
  if(room){ const [level,grade,group_name]=room.split("|"); if(level)sq=sq.eq("level",level); if(grade)sq=sq.eq("grade",grade); if(group_name)sq=sq.eq("group_name",group_name); }
  const [students,attendance]=await Promise.all([sq,admin.from("milhano_student_attendance").select("student_id,status,notes").eq("attendance_date",date)]);
  if(students.error) throw new Error(students.error.message); if(attendance.error) throw new Error(attendance.error.message);
  const marks=new Map((attendance.data??[]).map(r=>[r.student_id,r]));
  return (students.data??[]).map(s=>{const m=marks.get(s.id);return{student_id:s.id,full_name:s.full_name,level:s.level,grade:s.grade,group_name:s.group_name,status:(m?.status??null) as AttendanceStatus,note:m?.notes??""};});
}

export async function getAttendanceReport(start:string,end:string,level="",room="",studentId=""):Promise<{rows:AttendanceReportRow[]; days:number}> {
  await requireStudentModuleContext(); const admin=createSupabaseAdmin();
  let sq=admin.from("milhano_students").select("id,full_name,level,grade,group_name").eq("is_active",true);
  if(level)sq=sq.eq("level",level); if(studentId)sq=sq.eq("id",studentId);
  if(room){const [l,g,r]=room.split("|");if(l)sq=sq.eq("level",l);if(g)sq=sq.eq("grade",g);if(r)sq=sq.eq("group_name",r);}
  const students=await sq.order("full_name"); if(students.error)throw new Error(students.error.message);
  const ids=(students.data??[]).map(s=>s.id); if(!ids.length)return{rows:[],days:0};
  const marks=await admin.from("milhano_student_attendance").select("student_id,attendance_date,status").gte("attendance_date",start).lte("attendance_date",end).in("student_id",ids).limit(20000);
  if(marks.error)throw new Error(marks.error.message);
  const dates=new Set((marks.data??[]).map(m=>m.attendance_date)); const agg=new Map<string,{p:number;a:number}>();
  for(const m of marks.data??[]){const x=agg.get(m.student_id)??{p:0,a:0};if(m.status==="present")x.p++;if(m.status==="absent")x.a++;agg.set(m.student_id,x);}
  return {days:dates.size,rows:(students.data??[]).map(s=>{const x=agg.get(s.id)??{p:0,a:0};const recorded=x.p+x.a;return{student_id:s.id,full_name:s.full_name,level:clean(s.level),room:roomLabel(s.level,s.grade,s.group_name),present:x.p,absent:x.a,recorded,rate:recorded?Math.round(x.p/recorded*100):0};})};
}
