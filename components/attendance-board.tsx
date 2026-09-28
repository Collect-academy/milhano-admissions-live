"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { AttendanceStatus, AttendanceStudent } from "@/lib/student-attendance";

type Props = { date: string; initialStudents: AttendanceStudent[] };

function nextStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === null) return "present";
  if (status === "present") return "absent";
  return null;
}

export function AttendanceBoard({ date, initialStudents }: Props) {
  const [rows, setRows] = useState(initialStudents);
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, AttendanceStudent[]>();
    rows.forEach((row) => {
      const key = [row.level, row.grade, row.group_name].filter(Boolean).join(" · ") || "Sin salón";
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    return [...map.entries()];
  }, [rows]);

  async function persist(studentId: string, status: AttendanceStatus, note?: string) {
    const response = await fetch("/api/alumnos/asistencia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, studentId, status, note }) });
    if (!response.ok) throw new Error("No se pudo guardar la asistencia.");
  }

  async function toggle(studentId: string) {
    const current = rows.find((r) => r.student_id === studentId);
    if (!current) return;
    const status = nextStatus(current.status);
    setRows((all) => all.map((r) => r.student_id === studentId ? { ...r, status } : r));
    try { await persist(studentId, status, current.note); } catch { setRows((all) => all.map((r) => r.student_id === studentId ? current : r)); }
  }

  async function markAllPresent(studentIds: string[]) {
    setSaving(true);
    const before = rows;
    setRows((all) => all.map((r) => studentIds.includes(r.student_id) ? { ...r, status: "present" } : r));
    const response = await fetch("/api/alumnos/asistencia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, studentIds, status: "present" }) });
    if (!response.ok) setRows(before);
    setSaving(false);
  }

  async function saveNote(studentId: string, note: string) {
    const row = rows.find((r) => r.student_id === studentId);
    if (!row) return;
    setRows((all) => all.map((r) => r.student_id === studentId ? { ...r, note } : r));
    await persist(studentId, row.status, note);
  }

  return <div className="attendance-groups">
    {groups.map(([group, students]) => <section className="panel attendance-room" key={group}>
      <div className="panel-heading compact-panel-heading attendance-room-heading">
        <div><p className="eyebrow">SALÓN</p><h2>{group}</h2></div>
        <button className="primary-button" disabled={saving} onClick={() => markAllPresent(students.map((s) => s.student_id))} type="button">Todos vinieron</button>
      </div>
      <div className="table-scroll"><table className="attendance-table"><thead><tr><th>Alumno</th><th>Asistencia</th><th>Notas del día</th></tr></thead><tbody>
        {students.map((student) => <tr key={student.student_id}>
          <td><strong>{student.full_name}</strong></td>
          <td><button aria-label={`Cambiar asistencia de ${student.full_name}`} className={`attendance-mark attendance-mark-${student.status ?? "blank"}`} onClick={() => toggle(student.student_id)} type="button">{student.status === "present" ? <Check size={20}/> : student.status === "absent" ? <X size={20}/> : <span />}</button></td>
          <td><input className="attendance-note" defaultValue={student.note} onBlur={(event) => saveNote(student.student_id, event.currentTarget.value)} placeholder="Llegó tarde, salió temprano, faltó a una clase…" /></td>
        </tr>)}
      </tbody></table></div>
    </section>)}
  </div>;
}
