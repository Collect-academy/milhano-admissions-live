"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus, NotebookPen } from "lucide-react";
import { useRouter } from "next/navigation";

import { createStudentNote } from "@/app/alumnos/actions";
import type { StudentNote } from "@/lib/student-records";

const categoryLabels: Record<StudentNote["category"], string> = {
  convivencia: "Convivencia / incidente",
  clase: "Reporte de clase",
  personal: "Situación personal",
  academico: "Académico",
  otro: "Otro",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

export function StudentNotesPanel({ studentId, notes, canWrite }: { studentId: string; notes: StudentNote[]; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    startTransition(() => {
      void (async () => {
      try {
        await createStudentNote({
          studentId,
          occurredOn: String(formData.get("occurred_on") ?? ""),
          category: String(formData.get("category") ?? "otro") as StudentNote["category"],
          title: String(formData.get("title") ?? ""),
          note: String(formData.get("note") ?? ""),
        });
        setOpen(false);
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar la nota.");
      }
      })();
    });
  }

  return (
    <div className="student-cycle-notes">
      <div className="student-cycle-notes-heading">
        <div>
          <p className="eyebrow">Bitácora del ciclo</p>
          <h3>Situaciones extraordinarias y notas</h3>
          <p>Registro breve para contexto escolar. El seguimiento detallado permanece en los formatos psicopedagógicos.</p>
        </div>
        {canWrite ? (
          <button className="secondary-button no-print" onClick={() => setOpen((value) => !value)} type="button">
            <MessageSquarePlus size={16} /> {open ? "Cerrar" : "Nueva nota"}
          </button>
        ) : null}
      </div>

      {open ? (
        <form className="student-note-form no-print" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
          <label><span>Fecha</span><input defaultValue={new Date().toISOString().slice(0, 10)} name="occurred_on" required type="date" /></label>
          <label><span>Tipo</span><select defaultValue="convivencia" name="category"><option value="convivencia">Convivencia / incidente</option><option value="clase">Reporte de clase</option><option value="personal">Situación personal</option><option value="academico">Académico</option><option value="otro">Otro</option></select></label>
          <label className="student-note-title"><span>Título breve <small>(opcional)</small></span><input maxLength={120} name="title" placeholder="Ej. Conflicto durante recreo" /></label>
          <label className="student-note-body"><span>Nota</span><textarea maxLength={2000} name="note" placeholder="Describe brevemente lo ocurrido y el contexto relevante." required /></label>
          {error ? <div className="student-note-error">{error}</div> : null}
          <div className="student-note-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar nota"}</button></div>
        </form>
      ) : null}

      {notes.length ? (
        <div className="student-note-list">
          {notes.map((note) => (
            <article className="student-note-item" key={note.id}>
              <div className="student-note-icon"><NotebookPen size={17} /></div>
              <div className="student-note-content">
                <div className="student-note-meta"><span>{categoryLabels[note.category]}</span><span>{formatDate(note.occurred_on)}</span><span>{note.author_label}</span></div>
                {note.title ? <strong>{note.title}</strong> : null}
                <p>{note.note}</p>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="student-note-empty"><NotebookPen size={19} /><span>Sin notas registradas durante el ciclo.</span></div>}
    </div>
  );
}
