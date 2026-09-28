import "server-only";

import { requireStudentModuleContext } from "@/lib/student-records";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AttendanceStatus = "present" | "absent" | null;
export type AttendanceStudent = {
  student_id: string; full_name: string; level: string | null; grade: string | null; group_name: string | null;
  status: AttendanceStatus; note: string;
};

export async function getAttendanceDay(date: string, grade = ""): Promise<AttendanceStudent[]> {
  await requireStudentModuleContext();
  const admin = createSupabaseAdmin();
  let studentsQuery = admin.from("milhano_students")
    .select("id,full_name,level,grade,group_name")
    .eq("is_active", true)
    .order("level").order("grade").order("group_name").order("full_name");
  if (grade) studentsQuery = studentsQuery.eq("grade", grade);
  const [students, attendance] = await Promise.all([
    studentsQuery,
    admin.from("milhano_student_attendance").select("student_id,status,note").eq("attendance_date", date),
  ]);
  if (students.error) throw new Error(students.error.message);
  if (attendance.error) throw new Error(attendance.error.message);
  const byStudent = new Map((attendance.data ?? []).map((row) => [row.student_id, row]));
  return (students.data ?? []).map((student) => {
    const mark = byStudent.get(student.id);
    return { student_id: student.id, full_name: student.full_name, level: student.level, grade: student.grade, group_name: student.group_name, status: (mark?.status ?? null) as AttendanceStatus, note: mark?.note ?? "" };
  });
}

export async function getAttendanceGrades(): Promise<string[]> {
  await requireStudentModuleContext();
  const admin = createSupabaseAdmin();
  const result = await admin.from("milhano_students").select("grade").eq("is_active", true).limit(500);
  if (result.error) throw new Error(result.error.message);
  return [...new Set((result.data ?? []).map((r) => String(r.grade ?? "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es",{numeric:true}));
}
