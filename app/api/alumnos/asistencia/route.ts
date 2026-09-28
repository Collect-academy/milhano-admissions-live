import { NextResponse } from "next/server";
import { requireStudentModuleContext } from "@/lib/student-records";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const context = await requireStudentModuleContext();
  const body = await request.json();
  const date = String(body.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  const status = body.status === "present" || body.status === "absent" ? body.status : null;
  const note = String(body.note ?? "").slice(0, 1000);
  const ids = Array.isArray(body.studentIds) ? body.studentIds.map(String) : [String(body.studentId ?? "")].filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "Alumno requerido" }, { status: 400 });
  const admin = createSupabaseAdmin();
  if (status === null && !note) {
    const deleted = await admin.from("milhano_student_attendance").delete().eq("attendance_date", date).in("student_id", ids);
    if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });
  } else {
    const rows = ids.map((studentId: string) => ({ student_id: studentId, attendance_date: date, status, note, marked_by: context.user.id, marked_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    const saved = await admin.from("milhano_student_attendance").upsert(rows, { onConflict: "student_id,attendance_date" });
    if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
