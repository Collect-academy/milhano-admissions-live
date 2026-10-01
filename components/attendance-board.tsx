"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Save, X } from "lucide-react";
import type { AttendanceStatus, AttendanceStudent } from "@/lib/student-attendance";

type Props = { date: string; initialStudents: AttendanceStudent[] };
type SaveState = "idle" | "saving" | "saved" | "error";

function nextStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === null) return "present";
  if (status === "present") return "absent";
  return null;
}

export function AttendanceBoard({ date, initialStudents }: Props) {
  const [rows, setRows] = useState(initialStudents);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, AttendanceStudent[]>();
    rows.forEach((row) => {
      const key = [row.level, row.grade, row.group_name].filter(Boolean).join(" · ") || "Sin salón";
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    return [...map.entries()];
  }, [rows]);

  const dirtyCount = dirtyIds.size;

  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  function markDirty(studentIds: string[]) {
    setDirtyIds((current) => {
      const next = new Set(current);
      studentIds.forEach((id) => next.add(id));
      return next;
    });
    setSaveState("idle");
    setMessage("");
  }

  function toggle(studentId: string) {
    setRows((all) => all.map((row) => row.student_id === studentId
      ? { ...row, status: nextStatus(row.status) }
      : row));
    markDirty([studentId]);
  }

  function markAllPresent(studentIds: string[]) {
    setRows((all) => all.map((row) => studentIds.includes(row.student_id)
      ? { ...row, status: "present" }
      : row));
    markDirty(studentIds);
  }

  function updateNote(studentId: string, note: string) {
    setRows((all) => all.map((row) => row.student_id === studentId
      ? { ...row, note }
      : row));
    markDirty([studentId]);
  }

  async function saveAll() {
    if (!dirtyCount || saveState === "saving") return;

    const changedRows = rows
      .filter((row) => dirtyIds.has(row.student_id))
      .map((row) => ({
        studentId: row.student_id,
        status: row.status,
        note: row.note,
      }));

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/alumnos/asistencia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, rows: changedRows }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "No se pudo guardar la asistencia.");
      }

      setDirtyIds(new Set());
      setSaveState("saved");
      setMessage(`${result.saved ?? changedRows.length} cambio(s) guardado(s).`);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la asistencia.");
    }
  }

  return <>
    <div className={`attendance-savebar ${dirtyCount ? "has-changes" : ""}`}>
      <div>
        <strong>{dirtyCount ? `${dirtyCount} cambio(s) sin guardar` : "Asistencia al día"}</strong>
        <span>{message || (dirtyCount ? "Revisa las marcas y guarda cuando termines." : "No hay cambios pendientes.")}</span>
      </div>
      <button
        className="primary-button attendance-save-button"
        disabled={!dirtyCount || saveState === "saving"}
        onClick={saveAll}
        type="button"
      >
        <Save size={17} />
        {saveState === "saving" ? "Guardando…" : "Guardar asistencia"}
      </button>
    </div>

    {saveState === "error" ? <p className="attendance-save-error" role="alert">{message}</p> : null}
    {saveState === "saved" ? <p className="attendance-save-success" role="status">{message}</p> : null}

    <div className="attendance-groups">
      {groups.map(([group, students]) => <section className="panel attendance-room" key={group}>
        <div className="panel-heading compact-panel-heading attendance-room-heading">
          <div><p className="eyebrow">SALÓN</p><h2>{group}</h2></div>
          <button
            className="primary-button"
            disabled={saveState === "saving"}
            onClick={() => markAllPresent(students.map((student) => student.student_id))}
            type="button"
          >
            Todos vinieron
          </button>
        </div>
        <div className="table-scroll"><table className="attendance-table"><thead><tr><th>Alumno</th><th>Asistencia</th><th>Notas del día</th></tr></thead><tbody>
          {students.map((student) => <tr className={dirtyIds.has(student.student_id) ? "attendance-row-dirty" : ""} key={student.student_id}>
            <td><strong>{student.full_name}</strong></td>
            <td><button aria-label={`Cambiar asistencia de ${student.full_name}`} className={`attendance-mark attendance-mark-${student.status ?? "blank"}`} onClick={() => toggle(student.student_id)} type="button">{student.status === "present" ? <Check size={20}/> : student.status === "absent" ? <X size={20}/> : <span />}</button></td>
            <td><input className="attendance-note" value={student.note} onChange={(event) => updateNote(student.student_id, event.currentTarget.value)} placeholder="Llegó tarde, salió temprano, faltó a una clase…" /></td>
          </tr>)}
        </tbody></table></div>
      </section>)}
    </div>
  </>;
}
