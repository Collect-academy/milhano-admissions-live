import { NextResponse } from "next/server";
import { requireStudentModuleContext } from "@/lib/student-records";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const cleanNote = (value: unknown) => String(value ?? "").trim().slice(0, 1000);
const cleanStatus = (value: unknown): "present" | "absent" | null =>
  value === "present" || value === "absent" ? value : null;

export async function POST(request: Request) {
  const context = await requireStudentModuleContext();
  const body = await request.json();
  const date = String(body.date ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const incomingRows = Array.isArray(body.rows)
    ? body.rows.slice(0, 500).map((row: Record<string, unknown>) => ({
        studentId: String(row?.studentId ?? "").trim(),
        status: cleanStatus(row?.status),
        note: cleanNote(row?.note),
      })).filter((row: { studentId: string }) => Boolean(row.studentId))
    : [];

  // Backward compatibility with the previous single/bulk-status request shape.
  const legacyIds = Array.isArray(body.studentIds)
    ? body.studentIds.map(String)
    : [String(body.studentId ?? "")].filter(Boolean);
  const rows = incomingRows.length
    ? incomingRows
    : legacyIds.map((studentId: string) => ({
        studentId,
        status: cleanStatus(body.status),
        note: cleanNote(body.note),
      }));

  if (!rows.length) {
    return NextResponse.json({ error: "Alumno requerido" }, { status: 400 });
  }

  const uniqueRows = [...new Map(rows.map((row) => [row.studentId, row])).values()];
  const toDelete = uniqueRows.filter((row) => row.status === null && !row.note).map((row) => row.studentId);
  const toSave = uniqueRows.filter((row) => row.status !== null || Boolean(row.note));
  const admin = createSupabaseAdmin();

  if (toDelete.length) {
    const deleted = await admin
      .from("milhano_student_attendance")
      .delete()
      .eq("attendance_date", date)
      .in("student_id", toDelete);
    if (deleted.error) {
      return NextResponse.json({ error: deleted.error.message }, { status: 500 });
    }
  }

  if (toSave.length) {
    const now = new Date().toISOString();
    const saved = await admin.from("milhano_student_attendance").upsert(
      toSave.map((row) => ({
        student_id: row.studentId,
        attendance_date: date,
        status: row.status,
        notes: row.note || null,
        marked_by: context.user.id,
        marked_at: now,
        updated_at: now,
      })),
      { onConflict: "student_id,attendance_date" },
    );
    if (saved.error) {
      return NextResponse.json({ error: saved.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    saved: uniqueRows.length,
    upserted: toSave.length,
    deleted: toDelete.length,
  });
}
